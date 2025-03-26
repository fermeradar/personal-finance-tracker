let $2;
// src/scenes/addExpenseScene.js
const { Scenes, Markup } = require('telegraf');
const { Pool } = require('pg');
const { getUserLanguage } = require('../services/core/user-manager');
const _currencyConverter = require($2);
const logger = require('../utils/logger');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const addExpenseScene = new Scenes.WizardScene(
  'addExpense',
  // Step 1: Ask for amount
  async (ctx) => {
    try {
      const userId = ctx.from.id.toString();
      const userLanguage = await getUserLanguage(userId);
      
      // Store expense data in session
      ctx.scene.session.expenseData = {
        user_id: userId,
        currency: await getUserCurrency(userId)
      };
      
      // Ask for expense amount
      const message = userLanguage === 'en'
        ? `Please enter the expense amount in ${ctx.scene.session.expenseData.currency}:`
        : `Пожалуйста, введите сумму расхода в ${ctx.scene.session.expenseData.currency}:`;
      
      await ctx.reply(message, Markup.keyboard([
        [Markup.button.text(userLanguage === 'en' ? 'Cancel' : 'Отмена')]
      ]).resize());
      
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error in add expense step 1:', error);
      await ctx.reply('Sorry, an error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  
  // Step 2: Process amount and ask for date
  async (ctx) => {
    try {
      const userId = ctx.from.id.toString();
      const userLanguage = await getUserLanguage(userId);
      
      // Check for cancel
      if (ctx.message.text === 'Cancel' || ctx.message.text === 'Отмена') {
        await ctx.reply(userLanguage === 'en' ? 'Operation cancelled.' : 'Операция отменена.');
        return ctx.scene.leave();
      }
      
      // Parse amount
      const amount = parseFloat(ctx.message.text.replace(',', '.'));
      
      if (isNaN(amount) || amount <= 0) {
        const errorMsg = userLanguage === 'en'
          ? 'Please enter a valid positive number.'
          : 'Пожалуйста, введите положительное число.';
        
        await ctx.reply(errorMsg);
        return; // Stay on same step
      }
      
      // Store amount
      ctx.scene.session.expenseData.amount = amount;
      
      // Ask for date (default to today)
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      const dateMessage = userLanguage === 'en'
        ? `What's the date of the expense? (format: YYYY-MM-DD, default: ${today})`
        : `Какова дата расхода? (формат: ГГГГ-ММ-ДД, по умолчанию: ${today})`;
      
      await ctx.reply(dateMessage, Markup.keyboard([
        [Markup.button.text(today)],
        [Markup.button.text(userLanguage === 'en' ? 'Cancel' : 'Отмена')]
      ]).resize());
      
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error in add expense step 2:', error);
      await ctx.reply('Sorry, an error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  
  // Step 3: Process date and ask for category
  async (ctx) => {
    try {
      const userId = ctx.from.id.toString();
      const userLanguage = await getUserLanguage(userId);
      
      // Check for cancel
      if (ctx.message.text === 'Cancel' || ctx.message.text === 'Отмена') {
        await ctx.reply(userLanguage === 'en' ? 'Operation cancelled.' : 'Операция отменена.');
        return ctx.scene.leave();
      }
      
      // Parse date
      let expenseDate;
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (ctx.message.text === today) {
        expenseDate = new Date();
      } else {
        // Try to parse user input
        const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
        if (!datePattern.test(ctx.message.text)) {
          const errorMsg = userLanguage === 'en'
            ? 'Please enter a valid date in YYYY-MM-DD format.'
            : 'Пожалуйста, введите дату в формате ГГГГ-ММ-ДД.';
          
          await ctx.reply(errorMsg);
          return; // Stay on same step
        }
        
        expenseDate = new Date(ctx.message.text);
        
        // Validate parsed date
        if (isNaN(expenseDate.getTime())) {
          const errorMsg = userLanguage === 'en'
            ? 'Please enter a valid date.'
            : 'Пожалуйста, введите корректную дату.';
          
          await ctx.reply(errorMsg);
          return; // Stay on same step
        }
      }
      
      // Store date
      ctx.scene.session.expenseData.expense_date = expenseDate;
      
      // Get categories
      const categories = await getCategories(userId);
      
      // Create keyboard with categories
      const keyboard = [];
      const buttonsPerRow = 2;
      
      for (let i = 0; i < categories.length; i += buttonsPerRow) {
        const row = [];
        
        for (let j = 0; j < buttonsPerRow && i + j < categories.length; j++) {
          const category = categories[i + j];
          const buttonText = `${category.icon || ''} ${category.name}`;
          row.push(Markup.button.text(buttonText));
        }
        
        keyboard.push(row);
      }
      
      // Add cancel button
      keyboard.push([Markup.button.text(userLanguage === 'en' ? 'Cancel' : 'Отмена')]);
      
      const categoryMessage = userLanguage === 'en'
        ? 'Select a category for this expense:'
        : 'Выберите категорию для этого расхода:';
      
      await ctx.reply(categoryMessage, Markup.keyboard(keyboard).resize());
      
      // Store categories for reference
      ctx.scene.session.categories = categories;
      
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error in add expense step 3:', error);
      await ctx.reply('Sorry, an error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  
  // Step 4: Process category and ask for description
  async (ctx) => {
    try {
      const userId = ctx.from.id.toString();
      const userLanguage = await getUserLanguage(userId);
      
      // Check for cancel
      if (ctx.message.text === 'Cancel' || ctx.message.text === 'Отмена') {
        await ctx.reply(userLanguage === 'en' ? 'Operation cancelled.' : 'Операция отменена.');
        return ctx.scene.leave();
      }
      
      // Find selected category
      const selectedCategoryText = ctx.message.text;
      const selectedCategory = ctx.scene.session.categories.find(
        category => `${category.icon || ''} ${category.name}` === selectedCategoryText
      );
      
      if (!selectedCategory) {
        const errorMsg = userLanguage === 'en'
          ? 'Please select a valid category from the keyboard.'
          : 'Пожалуйста, выберите корректную категорию из клавиатуры.';
        
        await ctx.reply(errorMsg);
        return; // Stay on same step
      }
      
      // Store category ID
      ctx.scene.session.expenseData.category_id = selectedCategory.category_id;
      
      // Ask for description (optional)
      const descriptionMessage = userLanguage === 'en'
        ? 'Enter a description for this expense (optional):'
        : 'Введите описание для этого расхода (необязательно):';
      
      await ctx.reply(descriptionMessage, Markup.keyboard([
        [Markup.button.text(userLanguage === 'en' ? 'Skip' : 'Пропустить')],
        [Markup.button.text(userLanguage === 'en' ? 'Cancel' : 'Отмена')]
      ]).resize());
      
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error in add expense step 4:', error);
      await ctx.reply('Sorry, an error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  
  // Step 5: Process description and ask for merchant
  async (ctx) => {
    try {
      const userId = ctx.from.id.toString();
      const userLanguage = await getUserLanguage(userId);
      
      // Check for cancel
      if (ctx.message.text === 'Cancel' || ctx.message.text === 'Отмена') {
        await ctx.reply(userLanguage === 'en' ? 'Operation cancelled.' : 'Операция отменена.');
        return ctx.scene.leave();
      }
      
      // Store description if provided
      if (ctx.message.text !== 'Skip' && ctx.message.text !== 'Пропустить') {
        ctx.scene.session.expenseData.description = ctx.message.text;
      }
      
      // Ask for merchant (optional)
      const merchantMessage = userLanguage === 'en'
        ? 'Enter the merchant or vendor name (optional):'
        : 'Введите название продавца или поставщика (необязательно):';
      
      await ctx.reply(merchantMessage, Markup.keyboard([
        [Markup.button.text(userLanguage === 'en' ? 'Skip' : 'Пропустить')],
        [Markup.button.text(userLanguage === 'en' ? 'Cancel' : 'Отмена')]
      ]).resize());
      
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error in add expense step 5:', error);
      await ctx.reply('Sorry, an error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  
  // Step 6: Process merchant and save expense
  async (ctx) => {
    try {
      const userId = ctx.from.id.toString();
      const userLanguage = await getUserLanguage(userId);
      
      // Check for cancel
      if (ctx.message.text === 'Cancel' || ctx.message.text === 'Отмена') {
        await ctx.reply(userLanguage === 'en' ? 'Operation cancelled.' : 'Операция отменена.');
        return ctx.scene.leave();
      }
      
      // Store merchant if provided
      if (ctx.message.text !== 'Skip' && ctx.message.text !== 'Пропустить') {
        ctx.scene.session.expenseData.merchant_name = ctx.message.text;
      }
      
      // Set source
      ctx.scene.session.expenseData.data_source = 'manual';
      
      // Set verification status to verified (since user entered it manually)
      ctx.scene.session.expenseData.verification_status = 'verified';
      ctx.scene.session.expenseData.verified_by_user = true;
      
      // Save the expense
      const expense = await saveExpense(ctx.scene.session.expenseData);
      
      // Format currency amount
      const formattedAmount = new Intl.NumberFormat(userLanguage === 'ru' ? 'ru-RU' : 'en-US', {
        style: 'currency',
        currency: ctx.scene.session.expenseData.currency
      }).format(ctx.scene.session.expenseData.amount);
      
      // Success message
      const successMessage = userLanguage === 'en'
        ? `Expense of ${formattedAmount} added successfully!`
        : `Расход на сумму ${formattedAmount} успешно добавлен!`;
      
      await ctx.reply(successMessage, Markup.removeKeyboard());
      
      // Show expense summary
      const summary = await formatExpenseSummary(expense, userLanguage);
      await ctx.reply(summary);
      
      // Exit scene
      return ctx.scene.leave();
    } catch (error) {
      logger.error('Error in add expense step 6:', error);
      await ctx.reply('Sorry, an error occurred. Please try again.');
      return ctx.scene.leave();
    }
  }
);

// Add "cancel" handler to each step
addExpenseScene.hears(['Cancel', 'Отмена'], async (ctx) => {
  const userLanguage = await getUserLanguage(ctx.from.id.toString());
  await ctx.reply(
    userLanguage === 'en' ? 'Operation cancelled.' : 'Операция отменена.',
    Markup.removeKeyboard()
  );
  return ctx.scene.leave();
});

/**
 * Get user's preferred currency
 * @param {String} userId - User ID
 * @returns {Promise<String>} - Currency code
 */
async function getUserCurrency(userId) {
  try {
    const result = await pool.query(
      'SELECT currency FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length > 0 && result.rows[0].currency) {
      return result.rows[0].currency;
    }
    
    return 'EUR'; // Default
  } catch (error) {
    logger.error('Error getting user currency:', error);
    return 'EUR'; // Default on error
  }
}

/**
 * Get categories available to the user
 * @param {String} userId - User ID
 * @returns {Promise<Array>} - List of categories
 */
async function getCategories(userId) {
  try {
    const result = await pool.query(`
      SELECT category_id, name, icon
      FROM categories
      WHERE is_system = true OR user_id = $1
      ORDER BY name
    `, [userId]);
    
    return result.rows;
  } catch (error) {
    logger.error('Error getting categories:', error);
    return []; // Empty array on error
  }
}

/**
 * Save expense to database
 * @param {Object} expenseData - Expense data
 * @returns {Promise<Object>} - Saved expense
 */
async function saveExpense(expenseData) {
  try {
    // Create insert query dynamically based on available fields
    const fields = Object.keys(expenseData);
    const values = Object.values(expenseData);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(',');
    
    const query = `
      INSERT INTO expenses(${fields.join(',')}, created_at, updated_at)
      VALUES(${placeholders}, NOW(), NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    logger.error('Error saving expense:', error);
    throw error;
  }
}

/**
 * Format expense summary for display
 * @param {Object} expense - Expense data
 * @param {String} language - User language
 * @returns {Promise<String>} - Formatted summary
 */
async function formatExpenseSummary(expense, language) {
  try {
    // Get category name
    const categoryResult = await pool.query(
      'SELECT name FROM categories WHERE category_id = $1',
      [expense.category_id]
    );
    
    const categoryName = categoryResult.rows.length > 0
      ? categoryResult.rows[0].name
      : 'Uncategorized';
    
    // Format date
    const formattedDate = new Date(expense.expense_date).toLocaleDateString(
      language === 'ru' ? 'ru-RU' : 'en-US'
    );
    
    // Format amount
    const formattedAmount = new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
      style: 'currency',
      currency: expense.currency
    }).format(expense.amount);
    
    // Create summary based on language
    if (language === 'ru') {
      let summary = `📝 Сводка расхода:\n\n`;
      summary += `💰 Сумма: ${formattedAmount}\n`;
      summary += `📅 Дата: ${formattedDate}\n`;
      summary += `📂 Категория: ${categoryName}\n`;
      
      if (expense.description) {
        summary += `📝 Описание: ${expense.description}\n`;
      }
      
      if (expense.merchant_name) {
        summary += `🏪 Продавец: ${expense.merchant_name}\n`;
      }
      
      return summary;
    } else {
      let summary = `📝 Expense Summary:\n\n`;
      summary += `💰 Amount: ${formattedAmount}\n`;
      summary += `📅 Date: ${formattedDate}\n`;
      summary += `📂 Category: ${categoryName}\n`;
      
      if (expense.description) {
        summary += `📝 Description: ${expense.description}\n`;
      }
      
      if (expense.merchant_name) {
        summary += `🏪 Merchant: ${expense.merchant_name}\n`;
      }
      
      return summary;
    }
  } catch (error) {
    logger.error('Error formatting expense summary:', error);
    
    // Return simple summary in case of error
    return language === 'ru'
      ? `Расход успешно добавлен!`
      : `Expense added successfully!`;
  }
}

module.exports = addExpenseScene;