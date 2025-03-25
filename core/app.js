// src/app.js
require('dotenv').config();
const { Telegraf, session, Scenes } = require('telegraf');
const { Pool } = require('pg');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

// Import middleware
const {
  rateLimitMiddleware,
  authMiddleware,
  loggingMiddleware,
  loadSessionMiddleware
} = require('./middleware/securityMiddleware');

// Import services
const backupService = require('../services/core/backup-service');
const deploymentService = require('../services/core/deployment-service');
const logger = require('./utils/logger');

// Initialize database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Telegram bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Set up session middleware
bot.use(session());

// Import scenes
const addExpenseScene = require('../bot/scenes/addExpenseScene');
const viewExpensesScene = require('../bot/scenes/viewExpensesScene');
const settingsScene = require('../bot/scenes/settingsScene');
const receiptProcessingScene = require('../bot/scenes/receiptProcessingScene');
const utilityBillScene = require('../bot/scenes/utilityBillScene');
const benchmarkScene = require('../bot/scenes/benchmarkScene');

// Create scene manager
const stage = new Scenes.Stage([
  addExpenseScene,
  viewExpensesScene,
  settingsScene,
  receiptProcessingScene,
  utilityBillScene,
  benchmarkScene
]);

// Apply middleware
bot.use(rateLimitMiddleware);
bot.use(loadSessionMiddleware);
bot.use(authMiddleware);
bot.use(loggingMiddleware);
bot.use(stage.middleware());

// Import command handlers
const expenseHandlers = require('./handlers/expenseManagementHandlers');
const adminHandlers = require('./handlers/adminHandlers');

// Check database connection
async function checkDatabase() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection established');
    return true;
  } catch (error) {
    logger.error('Database connection error:', error);
    return false;
  }
}

// Set up commands
function setupBotCommands() {
  // Register commands with telegram
  bot.telegram.setMyCommands([
    { command: 'start', description: 'Start the bot' },
    { command: 'help', description: 'Show help' },
    { command: 'add', description: 'Add a new expense' },
    { command: 'view', description: 'View recent expenses' },
    { command: 'stats', description: 'View expense statistics' },
    { command: 'settings', description: 'Change settings' },
    { command: 'benchmark', description: 'Compare your spending with others' },
  ]);

  // Register command handlers
  bot.start(async (ctx) => {
    const message = await ctx.i18n('Welcome to the Personal Finance Tracker!', 'Добро пожаловать в Трекер личных финансов!');
    await ctx.reply(message);
    // Show help message to get users started
    ctx.command.help(ctx);
  });

  bot.help(async (ctx) => {
    const helpText = await ctx.i18n(
      `Here's what I can do:
      
/add - Add a new expense
/view - View recent expenses
/settings - Adjust your preferences
/stats - View spending statistics
/benchmark - Compare your spending with others

You can also send me a photo of a receipt to scan it automatically, or just tell me about an expense in natural language.`,

      `Вот что я могу сделать:
      
/add - Добавить новый расход
/view - Просмотреть недавние расходы
/settings - Настроить предпочтения
/stats - Просмотреть статистику трат
/benchmark - Сравнить ваши траты с другими

Вы также можете отправить мне фото чека для автоматического сканирования или просто рассказать о расходе на обычном языке.`
    );
    
    await ctx.reply(helpText);
  });

  // Register other commands
  bot.command('add', (ctx) => ctx.scene.enter('addExpense'));
  bot.command('view', (ctx) => ctx.scene.enter('viewExpenses'));
  bot.command('settings', (ctx) => ctx.scene.enter('settings'));
  bot.command('stats', expenseHandlers.handleStatsCommand);
  bot.command('benchmark', (ctx) => ctx.scene.enter('benchmark'));
  bot.command('admin', adminHandlers.handleAdminCommand);

  // Handle photos (receipts)
  bot.on('photo', (ctx) => ctx.scene.enter('receiptProcessing'));

  // Handle documents (PDFs, etc.)
  bot.on(['document'], async (ctx) => {
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

  // Handle natural language expense entries
  bot.on('text', expenseHandlers.handleTextInput);

  // Set up callback query handlers
  bot.action(/view_expense:(.+)/, expenseHandlers.handleViewExpense);
  bot.action(/edit_expense:(.+)/, expenseHandlers.handleEditExpense);
  bot.action(/delete_expense:(.+)/, expenseHandlers.handleDeleteExpense);
  bot.action(/confirm_delete:(.+)/, expenseHandlers.handleConfirmDelete);
  bot.action(/edit_field:(.+):(.+)/, expenseHandlers.handleEditField);
  bot.action(/set_category:(.+):(.+)/, expenseHandlers.handleSetCategory);
  bot.action(/view_items:(.+)/, expenseHandlers.handleViewItems);
  bot.action(/delete_item:(.+):(.+)/, expenseHandlers.handleDeleteItem);
  bot.action(/confirm_delete_item:(.+):(.+)/, expenseHandlers.handleConfirmDeleteItem);
  
  // Admin action handlers
  bot.action('admin_users', adminHandlers.handleAdminUsers);
  bot.action('admin_backups', adminHandlers.handleAdminBackups);
  bot.action('admin_status', adminHandlers.handleSystemStatus);
  bot.action('admin_create_backup', adminHandlers.handleCreateBackup);
  bot.action('admin_view_all_backups', adminHandlers.handleViewAllBackups);
  bot.action('admin_clean_old_backups', adminHandlers.handleCleanOldBackups);
  bot.action('admin_menu', adminHandlers.handleBackToAdminMenu);

  logger.info('Bot commands registered');
}

// Set up scheduled tasks
function setupScheduledTasks() {
  // Schedule daily backup at 3 AM
  cron.schedule('0 3 * * *', async () => {
    logger.info('Running scheduled backup');
    try {
      const result = await backupService.createBackup('Scheduled daily backup');
      if (result.success) {
        logger.info(`Backup created successfully: ${result.path}`);
      } else {
        logger.error(`Backup failed: ${result.error}`);
      }
    } catch (error) {
      logger.error('Scheduled backup error:', error);
    }
  });

  // Schedule weekly cleanup of old backups on Sundays at 4 AM
  cron.schedule('0 4 * * 0', async () => {
    logger.info('Running scheduled backup cleanup');
    try {
      const result = await backupService.cleanupOldBackups();
      if (result.success) {
        logger.info(`Cleaned up ${result.deletedCount} old backups`);
      } else {
        logger.error(`Backup cleanup failed: ${result.error}`);
      }
    } catch (error) {
      logger.error('Scheduled backup cleanup error:', error);
    }
  });

  // Schedule health check every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Running scheduled health check');
    try {
      const health = await deploymentService.healthCheck();
      if (health.status === 'error') {
        logger.error('Health check failed:', health);
      } else if (health.status === 'warning') {
        logger.warn('Health check warning:', health);
      } else {
        logger.info('Health check passed');
      }
    } catch (error) {
      logger.error('Health check error:', error);
    }
  });

  // Clean temporary files daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running temp files cleanup');
    try {
      const result = await deploymentService.cleanupTempFiles(7); // Clean files older than 7 days
      logger.info(`Cleaned up ${result.removed.tempFiles} temp files, ${result.removed.logs} logs, and ${result.removed.cacheFiles} cache files`);
    } catch (error) {
      logger.error('Temp files cleanup error:', error);
    }
  });

  logger.info('Scheduled tasks registered');
}

// Create necessary directories
function ensureDirectories() {
  const dirs = [
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, '..', 'uploads', 'temp'),
    path.join(__dirname, '..', 'logs'),
    path.join(__dirname, '..', 'backups'),
    path.join(__dirname, '..', 'cache')
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  }
}

// Initialize application
async function initialize() {
  try {
    logger.info('Starting PersonalFinance Telegram Tracker');
    
    // Create necessary directories
    ensureDirectories();
    
    // Check database connection
    const dbConnected = await checkDatabase();
    if (!dbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }
    
    // Apply pending migrations if any
    try {
      const migrations = await deploymentService.checkDatabaseMigrations();
      if (migrations.requiresMigration) {
        logger.info(`${migrations.pendingMigrations.length} pending migrations found. Applying...`);
        const migrationResult = await deploymentService.applyMigrations();
        
        if (migrationResult.success) {
          logger.info(`Applied ${migrationResult.appliedCount} migrations successfully`);
        } else {
          logger.error('Failed to apply migrations:', migrationResult.errors);
        }
      } else {
        logger.info('No pending migrations');
      }
    } catch (migrationError) {
      logger.error('Migration check failed:', migrationError);
    }
    
    // Set up bot commands
    setupBotCommands();
    
    // Set up scheduled tasks
    setupScheduledTasks();
    
    // Start the bot
    await bot.launch();
    logger.info('Bot started successfully');
    
    // Run initial health check
    const health = await deploymentService.healthCheck();
    logger.info(`Initial health check: ${health.status}`);
    
    // Handle graceful shutdown
    process.once('SIGINT', () => {
      logger.info('SIGINT received. Shutting down...');
      bot.stop('SIGINT');
    });
    
    process.once('SIGTERM', () => {
      logger.info('SIGTERM received. Shutting down...');
      bot.stop('SIGTERM');
    });
    
    return true;
  } catch (error) {
    logger.error('Initialization error:', error);
    return false;
  }
}

// Start the application
initialize()
  .then(success => {
    if (!success) {
      logger.error('Initialization failed. Exiting...');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('Unexpected error during initialization:', error);
    process.exit(1);
  });
