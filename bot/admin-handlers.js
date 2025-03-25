// src/handlers/adminCommands.js
const { Markup } = require('telegraf');
const { Pool } = require('pg');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const backupService = require('../services/backupService');
const { translate } = require('../services/i18n');
const { getUserLanguage } = require('../services/userManager');

const execPromise = util.promisify(exec);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Check if user is admin
 * @param {String} userId - User ID to check
 * @returns {Promise<Boolean>} - True if admin
 */
async function isAdmin(userId) {
  const admins = process.env.ADMIN_USER_IDS ? process.env.ADMIN_USER_IDS.split(',') : [];
  return admins.includes(userId);
}

/**
 * Handle /admin command (entry point to admin functions)
 */
async function handleAdminCommand(ctx) {
  const userId = ctx.from.id.toString();
  
  if (!await isAdmin(userId)) {
    return ctx.reply('You are not authorized to use admin commands.');
  }
  
  const userLanguage = await getUserLanguage(userId);
  
  return ctx.reply(
    translate('admin.panel_title', userLanguage), 
    Markup.inlineKeyboard([
      [Markup.button.callback(
        translate('admin.button.users', userLanguage), 
        'admin_users'
      )],
      [Markup.button.callback(
        translate('admin.button.backups', userLanguage), 
        'admin_backups'
      )],
      [Markup.button.callback(
        translate('admin.button.status', userLanguage), 
        'admin_status'
      )]
    ])
  );
}

/**
 * Handle admin user statistics
 */
async function handleAdminUsers(ctx) {
  const userId = ctx.from.id.toString();
  
  if (!await isAdmin(userId)) {
    return ctx.answerCbQuery(translate('admin.not_authorized', 'en'));
  }
  
  try {
    const userLanguage = await getUserLanguage(userId);
    
    // Get user statistics
    const userStats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN join_date > NOW() - INTERVAL '7 days' THEN 1 END) as new_users_week,
        COUNT(CASE WHEN join_date > NOW() - INTERVAL '30 days' THEN 1 END) as new_users_month
      FROM users
    `);
    
    const activeUsers = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as active_users
      FROM expenses
      WHERE expense_date > NOW() - INTERVAL '30 days'
    `);
    
    const expenseStats = await pool.query(`
      SELECT 
        COUNT(*) as total_expenses,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_expenses_week,
        SUM(amount) as total_amount
      FROM expenses
    `);
    
    const message = translate('admin.user_stats', userLanguage, {
      totalUsers: userStats.rows[0].total_users,
      newUsersWeek: userStats.rows[0].new_users_week,
      newUsersMonth: userStats.rows[0].new_users_month,
      activeUsers: activeUsers.rows[0].active_users,
      totalExpenses: expenseStats.rows[0].total_expenses,
      newExpensesWeek: expenseStats.rows[0].new_expenses_week,
      totalAmount: expenseStats.rows[0].total_amount?.toFixed(2) || 0
    });
    
    return ctx.editMessageText(message, Markup.inlineKeyboard([
      [Markup.button.callback(
        translate('admin.button.back', userLanguage), 
        'admin_menu'
      )]
    ]));
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return ctx.answerCbQuery(translate('admin.error.fetch_stats', 'en'));
  }
}

/**
 * Handle admin backup functions
 */
async function handleAdminBackups(ctx) {
  const userId = ctx.from.id.toString();
  
  if (!await isAdmin(userId)) {
    return ctx.answerCbQuery(translate('admin.not_authorized', 'en'));
  }
  
  try {
    const userLanguage = await getUserLanguage(userId);
    
    // Get available backups
    const backups = backupService.getAvailableBackups().slice(0, 5); // Get 5 most recent
    
    let message = translate('admin.backup.title', userLanguage) + '\n\n';
    
    if (backups.length === 0) {
      message += translate('admin.backup.no_backups', userLanguage);
    } else {
      backups.forEach((backup, index) => {
        const date = backup.dateFormatted;
        const size = backup.sizeFormatted;
        const description = backup.metadata?.description || '';
        
        message += `${index + 1}. ${date} (${size}) ${description ? `- ${description}` : ''}\n`;
      });
    }
    
    const keyboard = [
      [Markup.button.callback(
        translate('admin.backup.create', userLanguage), 
        'admin_create_backup'
      )],
      [Markup.button.callback(
        translate('admin.backup.view_all', userLanguage), 
        'admin_view_all_backups'
      )],
      [Markup.button.callback(
        translate('admin.button.back', userLanguage), 
        'admin_menu'
      )]
    ];
    
    return ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    console.error('Error handling backups:', error);
    return ctx.answerCbQuery(translate('admin.error.backups', 'en'));
  }
}

/**
 * Handle creating a new backup
 */
async function handleCreateBackup(ctx) {
  const userId = ctx.from.id.toString();
  
  if (!await isAdmin(userId)) {
    return ctx.answerCbQuery(translate('admin.not_authorized', 'en'));
  }
  
  const userLanguage = await getUserLanguage(userId);
  
  await ctx.answerCbQuery(translate('admin.backup.creating', userLanguage));
  await ctx.editMessageText(
    translate('admin.backup.in_progress', userLanguage), 
    Markup.inlineKeyboard([
      [Markup.button.callback(
        translate('admin.button.cancel', userLanguage), 
        'admin_backups'
      )]
    ])
  );
  
  try {
    // Create backup
    const backupResult = await backupService.createBackup(
      translate('admin.backup.manual_desc', userLanguage)
    );
    
    if (!backupResult.success) {
      throw new Error(backupResult.error);
    }
    
    const filename = path.basename(backupResult.path);
    const size = backupResult.metadata.size;
    const formattedSize = backupService.formatSize(size);
    
    await ctx.editMessageText(
      translate('admin.backup.success', userLanguage, {
        filename,
        size: formattedSize,
        date: new Date().toLocaleString()
      }), 
      Markup.inlineKeyboard([
        [Markup.button.callback(
          translate('admin.backup.back_to_list', userLanguage), 
          'admin_backups'
        )]
      ])
    );
  } catch (error) {
    console.error('Error creating backup:', error);
    await ctx.editMessageText(
      translate('admin.backup.error', userLanguage, {
        error: error.message
      }), 
      Markup.inlineKeyboard([
        [Markup.button.callback(
          translate('admin.backup.back_to_list', userLanguage), 
          'admin_backups'
        )]
      ])
    );
  }
}

/**
 * Handle viewing all backups
 */
async function handleViewAllBackups(ctx) {
  const userId = ctx.from.id.toString();
  
  if (!await isAdmin(userId)) {
    return ctx.answerCbQuery(translate('admin.not_authorized', 'en'));
  }
  
  try {
    const userLanguage = await getUserLanguage(userId);
    
    // Get all available backups
    const backups = backupService.getAvailableBackups();
    
    let message = translate('admin.backup.all_title', userLanguage) + '\n\n';
    
    if (backups.length === 0) {
      message += translate('admin.backup.no_backups', userLanguage);
    } else {
      // Group backups by month for better organization
      const backupsByMonth = {};
      
      backups.forEach(backup => {
        const date = backup.date;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!backupsByMonth[monthKey]) {
          backupsByMonth[monthKey] = [];
        }
        
        backupsByMonth[monthKey].push(backup);
      });
      
      // Sort months and display backups
      const sortedMonths = Object.keys(backupsByMonth).sort().reverse();
      
      for (const month of sortedMonths) {
        const monthBackups = backupsByMonth[month];
        const [year, monthNum] = month.split('-');
        const monthName = new Date(year, parseInt(monthNum) - 1, 1).toLocaleString(
          userLanguage === 'ru' ? 'ru-RU' : 'en-US', 
          { month: 'long' }
        );
        
        message += `\n📅 ${monthName} ${year}:\n`;
        
        monthBackups.forEach((backup, index) => {
          const day = backup.date.getDate();
          const time = backup.date.toLocaleTimeString(
            userLanguage === 'ru' ? 'ru-RU' : 'en-US',
            { hour: '2-digit', minute: '2-digit' }
          );
          const size = backup.sizeFormatted;
          
          message += `${day} ${time} - ${size}\n`;
        });
      }
    }
    
    // Add delete and export options
    const keyboard = [
      [Markup.button.callback(
        translate('admin.backup.clean_old', userLanguage), 
        'admin_clean_old_backups'
      )],
      [Markup.button.callback(
        translate('admin.backup.back_to_list', userLanguage), 
        'admin_backups'
      )]
    ];
    
    return ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    console.error('Error viewing all backups:', error);
    return ctx.answerCbQuery(translate('admin.error.view_backups', 'en'));
  }
}

/**
 * Handle cleaning old backups
 */
async function handleCleanOldBackups(ctx) {
  const userId = ctx.from.id.toString();
  
  if (!await isAdmin(userId)) {
    return ctx.answerCbQuery(translate('admin.not_authorized', 'en'));
  }
  
  try {
    const userLanguage = await getUserLanguage(userId);
    
    // Perform cleanup
    const result = await backupService.cleanupOldBackups();
    
    let message;
    if (result.success) {
      message = translate('admin.backup.cleanup_success', userLanguage, {
        count: result.deletedCount
      });
    } else {
      message = translate('admin.backup.cleanup_error', userLanguage, {
        error: result.error
      });
    }
    
    return ctx.editMessageText(message, Markup.inlineKeyboard([
      [Markup.button.callback(
        translate('admin.backup.back_to_list', userLanguage), 
        'admin_backups'
      )]
    ]));
  } catch (error) {
    console.error('Error cleaning old backups:', error);
    return ctx.answerCbQuery(translate('admin.error.cleanup', 'en'));
  }
}

/**
 * Handle system status
 */
async function handleSystemStatus(ctx) {
  const userId = ctx.from.id.toString();
  
  if (!await isAdmin(userId)) {
    return ctx.answerCbQuery(translate('admin.not_authorized', 'en'));
  }
  
  try {
    const userLanguage = await getUserLanguage(userId);
    
    // Get database stats
    const dbStats = await pool.query(`
      SELECT
        pg_database_size(current_database()) as db_size,
        (SELECT COUNT(*) FROM expenses) as expenses_count,
        (SELECT COUNT(*) FROM expense_items) as items_count,
        (SELECT MAX(updated_at) FROM expenses) as last_expense,
        (SELECT MAX(updated_at) FROM regional_benchmarks) as last_benchmark_update
    `);
    
    // Get system stats
    const { stdout: memInfo } = await execPromise('free -m');
    const { stdout: diskInfo } = await execPromise('df -h --output=used,avail /');
    
    const memLines = memInfo.split('\n');
    const memValues = memLines[1].split(/\s+/).filter(Boolean);
    const usedMem = parseInt(memValues[2]);
    const totalMem = parseInt(memValues[1]);
    
    const diskValues = diskInfo.split('\n')[1].split(/\s+/).filter(Boolean);
    const usedDisk = diskValues[0];
    const availDisk = diskValues[1];
    
    // Format DB size to MB or GB
    const dbSizeBytes = parseInt(dbStats.rows[0].db_size);
    let dbSizeFormatted;
    if (dbSizeBytes > 1024 * 1024 * 1024) {
      dbSizeFormatted = `${(dbSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } else {
      dbSizeFormatted = `${(dbSizeBytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    
    // Format last activity timestamps
    const lastExpenseDate = dbStats.rows[0].last_expense 
      ? new Date(dbStats.rows[0].last_expense).toLocaleString()
      : translate('admin.status.never', userLanguage);
    
    const lastBenchmarkDate = dbStats.rows[0].last_benchmark_update 
      ? new Date(dbStats.rows[0].last_benchmark_update).toLocaleString()
      : translate('admin.status.never', userLanguage);
    
    // Create uptime string
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    
    let uptimeStr = '';
    if (days > 0) uptimeStr += `${days}d `;
    if (hours > 0 || days > 0) uptimeStr += `${hours}h `;
    if (minutes > 0 || hours > 0 || days > 0) uptimeStr += `${minutes}m `;
    uptimeStr += `${seconds}s`;
    
    // Create message
    const message = translate('admin.status.report', userLanguage, {
      dbSize: dbSizeFormatted,
      expensesCount: dbStats.rows[0].expenses_count,
      itemsCount: dbStats.rows[0].items_count,
      lastExpense: lastExpenseDate,
      lastBenchmark: lastBenchmarkDate,
      memUsed: usedMem,
      memTotal: totalMem,
      diskUsed: usedDisk,
      diskAvail: availDisk,
      uptime: uptimeStr,
      version: process.env.APP_VERSION || '1.0.0'
    });
    
    return ctx.editMessageText(message, Markup.inlineKeyboard([
      [Markup.button.callback(
        translate('admin.button.back', userLanguage), 
        'admin_menu'
      )]
    ]));
  } catch (error) {
    console.error('Error getting system status:', error);
    return ctx.answerCbQuery(translate('admin.error.status', 'en'));
  }
}

/**
 * Handle back to admin menu
 */
async function handleBackToAdminMenu(ctx) {
  const userId = ctx.from.id.toString();
  
  if (!await isAdmin(userId)) {
    return ctx.answerCbQuery(translate('admin.not_authorized', 'en'));
  }
  
  await ctx.answerCbQuery();
  return handleAdminCommand({
    ...ctx,
    reply: (text, extra) => ctx.editMessageText(text, extra)
  });
}

module.exports = {
  handleAdminCommand,
  handleAdminUsers,
  handleAdminBackups,
  handleCreateBackup,
  handleViewAllBackups,
  handleCleanOldBackups,
  handleSystemStatus,
  handleBackToAdminMenu,
  // Middleware for check
  isAdmin
};