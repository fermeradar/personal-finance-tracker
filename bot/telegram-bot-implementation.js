// src/bot/index.js
require('dotenv').config();
const { Telegraf, session, Scenes } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Import services
const languageHandler = require('../services/languageHandler');
const currencyConverter = require('../services/currencyConverter');
const productNormalizer = require('../services/productNormalizer');
const documentSourceHandler = require('../services/documentSourceHandler');
const expenseHandlers = require('../handlers/expenseManagementHandlers');
const expenseDuplicateHandler = require('../handlers/expenseDuplicateHandler');

// Initialize database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Set up session middleware
bot.use(session());

// Import scenes
const addExpenseScene = require('./scenes/addExpenseScene');
const viewExpensesScene = require('./scenes/viewExpensesScene');
const settingsScene = require('./scenes/settingsScene');
const receiptProcessingScene = require('./scenes/receiptProcessingScene');
const utilityBillScene = require('./scenes/utilityBillScene');

// Create scene manager
const stage = new Scenes.Stage([
  addExpenseScene,
  viewExpensesScene,
  settingsScene,
  receiptProcessingScene,
  utilityBillScene
]);
bot.use(stage.middleware());

// Middleware to ensure user is registered
bot.use(async (ctx, next) => {
  try {
    const userId = ctx.from.id.toString();
    
    // Check if user exists
    const userResult = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      // Create new user
      await pool.query(`
        INSERT INTO users (
          user_id, first_name, username, join_date, 
          time_zone, currency, language
        ) 
        VALUES ($1, $2, $3, NOW(), $4, $5, $6)
      `, [
        userId,
        ctx.from.first_name || 'User',
        ctx.from.username || null,
        'UTC',
        'EUR',
        ctx.from.language_code || 'en'
      ]);
      
      ctx.session = {
        userId,
        language: ctx.from.language_code || 'en',
        currency: 'EUR',
        isNewUser: true
      };
    } else {
      // Set session data
      ctx.session = {
        userId,
        language: userResult.rows[0].preferred_language || ctx.from.language_code || 'en',
        currency: userResult.rows[0].currency || 'EUR',
        isNewUser: false
      };
    }
    
    return next();
  } catch (error) {
    console.error('User registration middleware error:', error);
    return next();
  }
});

// Multilingual response middleware
bot.use(async (ctx, next) => {
  // Extend context with translation helper
  ctx.i18n = async (englishText, russianText = null) => {
    return await languageHandler.formatUserMessage(
      ctx.session.userId,
      englishText,
      russianText
    );
  };
  
  return next();
});

// Start command
bot.start(async (ctx) => {
  if (ctx.session.isNewUser) {
    await ctx.reply(await ctx.i18n(
      '👋 Welcome to Personal Finance Tracker! I\'ll help you track and analyze your expenses.',
      '👋 Добро пожаловать в Personal Finance Tracker! Я помогу вам отслеживать и анализировать ваши расходы.'
    ));
    
    // Start onboarding
    await ctx.reply(await ctx.i18n(
      'Let\'s set up your profile. What currency would you like to use? (e.g., EUR, USD, RUB)',
      'Давайте настроим ваш профиль. Какую валюту вы хотели бы использовать? (например, EUR, USD, RUB)'
    ));
    
    ctx.session.onboardingStep = 'currency';
  } else {
    await ctx.reply(await ctx.i18n(
      '👋 Welcome back to Personal Finance Tracker!',
      '👋 С возвращением в Personal Finance Tracker!'
    ));
    
    // Show main menu
    await showMainMenu(ctx);
  }
});

// Help command
bot.help(async (ctx) => {
  const helpText = await ctx.i18n(
    `Here's what I can do:
    
/add - Add a new expense
/view - View recent expenses
/settings - Adjust your preferences
/report - Generate expense reports
/stats - View spending statistics

You can also send me a photo of a receipt to scan it automatically, or just tell me about an expense in natural language.`,

    `Вот что я могу сделать:
    
/add - Добавить новый расход
/view - Просмотреть недавние расходы
/settings - Настроить предпочтения
/report - Сформировать отчет о расходах
/stats - Просмотреть статистику трат

Вы также можете отправить мне фото чека для автоматического сканирования или просто рассказать о расходе на обычном языке.`
  );
  
  await ctx.reply(helpText);
});

// Add expense command
bot.command('add', (ctx) => ctx.scene.enter('addExpense'));

// View expenses command
bot.command('view', (ctx) => ctx.scene.enter('viewExpenses'));

// Settings command
bot.command('settings', (ctx) => ctx.scene.enter('settings'));

// Process receipt photos
bot.on('photo', (ctx) => ctx.scene.enter('receiptProcessing'));

// Process document uploads (PDFs)
bot.on('document', async (ctx) => {
  // Check if document is a PDF or image
  const mime = ctx.message.document.mime_type;
  
  if (mime.startsWith('image/') || mime === 'application/pdf') {
    await ctx.reply(await ctx.i18n(
      'I\'ll process this document for you.',
      'Я обработаю этот документ для вас.'
    ));
    
    ctx.scene.enter('receiptProcessing', { documentId: ctx.message.document.file_id });
  } else {
    await ctx.reply(await ctx.i18n(
      'I can only process images and PDF documents.',
      'Я могу обрабатывать только изображения и PDF-документы.'
    ));
  }
});

// Natural language expense entry
bot.on('text', async (ctx) => {
  // Skip if inside a scene
  if (ctx.session?.__scenes?.current) return;
  
  // Skip if in onboarding
  if (ctx.session.onboardingStep) {
    await handleOnboarding(ctx);
    return;
  }
  
  // Detect if the text might be an expense
  const text = ctx.message.text;
  
  if (looksLikeExpense(text)) {
    await ctx.reply(await ctx.i18n(
      'This looks like an expense. Let me process it...',
      'Похоже на расход. Обрабатываю...'
    ));
    
    // Process the potential expense
    await processNaturalLanguageExpense(ctx, text);
  } else {
    await ctx.reply(await ctx.i18n(
      'I\'m not sure what you want to do. Try using a command like /add or /help.',
      'Я не уверен, что вы хотите сделать. Попробуйте использовать команду, например, /add или /help.'
    ));
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Bot error for ${ctx.updateType}`, err);
  ctx.reply('An error occurred. Please try again later.').catch(e => {});
});

/**
 * Show main menu with inline keyboard
 * @param {Object} ctx - Telegram context
 */
async function showMainMenu(ctx) {
  await ctx.reply(
    await ctx.i18n('What would you like to do?', 'Что бы вы хотели сделать?'),
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: await ctx.i18n('➕ Add Expense', '➕ Добавить расход'), callback_data: 'add_expense' },
            { text: await ctx.i18n('📋 View Expenses', '📋 Просмотреть расходы'), callback_data: 'view_expenses' }
          ],
          [
            { text: await ctx.i18n('📊 Reports', '📊 Отчеты'), callback_data: 'reports' },
            { text: await ctx.i18n('⚙️ Settings', '⚙️ Настройки'), callback_data: 'settings' }
          ]
        ]
      }
    }
  );
}

/**
 * Handle user onboarding steps
 * @param {Object} ctx - Telegram context
 */
async function handleOnboarding(ctx) {
  const text = ctx.message.text;
  
  switch (ctx.session.onboardingStep) {
    case 'currency':
      // Validate and save currency
      const currency = text.trim().toUpperCase();
      
      if (/^[A-Z]{3}$/.test(currency)) {
        // Update user preference
        await pool.query(
          'UPDATE users SET currency = $1 WHERE user_id = $2',
          [currency, ctx.session.userId]
        );
        
        ctx.session.currency = currency;
        
        // Move to language step
        await ctx.reply(await ctx.i18n(
          'Great! Now, what language would you prefer? (en for English, ru for Russian)',
          'Отлично! Теперь, какой язык вы предпочитаете? (en для английского, ru для русского)'
        ));
        
        ctx.session.onboardingStep = 'language';
      } else {
        await ctx.reply(await ctx.i18n(
          'Please enter a valid 3-letter currency code (e.g., EUR, USD, RUB).',
          'Пожалуйста, введите действительный 3-буквенный код валюты (например, EUR, USD, RUB).'
        ));
      }
      break;
      
    case 'language':
      // Validate and save language
      const language = text.trim().toLowerCase();
      
      if (language === 'en' || language === 'ru') {
        // Update user preference
        await pool.query(
          'UPDATE users SET preferred_language = $1 WHERE user_id = $2',
          [language, ctx.session.userId]
        );
        
        ctx.session.language = language;
        
        // Finish onboarding
        await ctx.reply(await ctx.i18n(
          'Perfect! Your profile is set up. You can change these settings anytime with /settings.',
          'Отлично! Ваш профиль настроен. Вы можете изменить эти настройки в любое время с помощью /settings.'
        ));
        
        delete ctx.session.onboardingStep;
        ctx.session.isNewUser = false;
        
        // Show main menu
        await showMainMenu(ctx);
      } else {
        await ctx.reply(await ctx.i18n(
          'Please enter a valid language code (en or ru).',
          'Пожалуйста, введите правильный код языка (