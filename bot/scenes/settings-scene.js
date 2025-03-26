let $2;
// src/scenes/settingsScene.js
const { Scenes, Markup } = require('telegraf');
const { Pool } = require('pg');
const { getUserLanguage } = require('../services/core/user-manager');
const _currencyConverter = require($2);
const { translate } = require('../services/localization/i18n-service');
const logger = require('../utils/logger');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create settings scene
const settingsScene = new Scenes.WizardScene(
  'settings',
  // Step 1: Show settings menu
  async (ctx) => {
    try {
      const userId = ctx.from.id.toString();
      const userLanguage = await getUserLanguage(userId);
      
      // Get current user settings
      const userSettings = await getUserSettings(userId);
      
      // Store in session
      ctx.scene.session.userId = userId;
      ctx.scene.session.userSettings = userSettings;
      
      // Format current settings
      const formattedSettings = formatUserSettings(userSettings, userLanguage);
      
      // Create settings menu
      const settingsTitle = translate('settings.title', userLanguage);
      const message = `${settingsTitle}\n\n${formattedSettings}`;
      
      // Create settings keyboard
      const keyboard = [
        [Markup.button.text(translate('settings.language', userLanguage))],
        [Markup.button.text(translate('settings.currency', userLanguage))],
        [Markup.button.text(translate('settings.data_sharing', userLanguage))],
        [Markup.button.text(translate('settings.notifications', userLanguage))],
        [Markup.button.text(translate('settings.export', userLanguage))],
        [Markup.button.text(translate('button.done', userLanguage))]
      ];
      
      await ctx.reply(message, Markup.keyboard(keyboard).resize());
      
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error in settings scene step 1:', error);
      await ctx.reply('Sorry, an error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  
  // Step 2: Handle settings selection
  async (ctx) => {
    try {
      const userId = ctx.scene.session.userId;
      const userLanguage = await getUserLanguage(userId);
      
      const selection = ctx.message.text;
      
      // Check if done
      if (selection === translate('button.done', userLanguage)) {
        await ctx.reply(
          translate('settings.update_success', userLanguage),
          Markup.removeKeyboard()
        );
        return ctx.scene.leave();
      }
      
      // Handle language setting
      if (selection === translate('settings.language', userLanguage)) {
        ctx.scene.session.settingToChange = 'language';
        
        // Show language options
        const keyboard = [
          [Markup.button.text('English')],
          [Markup.button.text('Русский')],
          [Markup.button.text(translate('button.back', userLanguage))]
        ];
        
        await ctx.reply(
          translate('language.select', userLanguage),
          Markup.keyboard(keyboard).resize()
        );
        
        return ctx.wizard.next();
      }
      
      // Handle currency setting
      if (selection === translate('settings.currency', userLanguage)) {
        ctx.scene.session.settingToChange = 'currency';
        
        // Show common currencies
        const commonCurrencies = ['EUR', 'USD', 'GBP', 'RUB', 'CNY'];
        
        const keyboard = commonCurrencies.map(currency => [Markup.button.text(currency)]);
        keyboard.push([Markup.button.text(translate('button.back', userLanguage))]);
        
        await ctx.reply(
          userLanguage === 'en'
            ? 'Select your preferred currency:'
            : 'Выберите предпочитаемую валюту:',
          Markup.keyboard(keyboard).resize()
        );
        
        return ctx.wizard.next();
      }
      
      // Handle data sharing setting
      if (selection === translate('settings.data_sharing', userLanguage)) {
        ctx.scene.session.settingToChange = 'data_sharing';
        
        // Show options
        const keyboard = [
          [Markup.button.text(userLanguage === 'en' ? 'Enable' : 'Включить')],
          [Markup.button.text(userLanguage === 'en' ? 'Disable' : 'Отключить')],
          [Markup.button.text(translate('button.back', userLanguage))]
        ];
        
        await ctx.reply(
          userLanguage === 'en'
            ? 'Would you like to share anonymous spending data for benchmarks?'
            : 'Хотите ли вы делиться анонимными данными о расходах для сравнительного анализа?',
          Markup.keyboard(keyboard).resize()
        );
        
        return ctx.wizard.next();
      }
      
      // Handle notifications setting
      if (selection === translate('settings.notifications', userLanguage)) {
        ctx.scene.session.settingToChange = 'notifications';
        
        // Show options
        const keyboard = [
          [Markup.button.text(userLanguage === 'en' ? 'Enable' : 'Включить')],
          [Markup.button.text(userLanguage === 'en' ? 'Disable' : 'Отключить')],
          [Markup.button.text(translate('button.back', userLanguage))]
        ];
        
        await ctx.reply(
          userLanguage === 'en'
            ? 'Would you like to receive notifications about your spending?'
            : 'Хотите ли вы получать уведомления о ваших расходах?',
          Markup.keyboard(keyboard).resize()
        );
        
        return ctx.wizard.next();
      }
      
      // Handle export setting
      if (selection === translate('settings.export', userLanguage)) {
        ctx.scene.session.settingToChange = 'export';
        
        // Show export options
        const keyboard = [
          [Markup.button.text(translate('export.format.csv', userLanguage))],
          [Markup.button.text(translate('export.format.excel', userLanguage))],
          [Markup.button.text(translate('button.back', userLanguage))]
        ];
        
        await ctx.reply(
          translate('export.select_format', userLanguage),
          Markup.keyboard(keyboard).resize()
        );
        
        return ctx.wizard.next();
      }
      
      // Invalid selection, show menu again
      const settingsTitle = translate('settings.title', userLanguage);
      const formattedSettings = formatUserSettings(ctx.scene.session.userSettings, userLanguage);
      const message = `${settingsTitle}\n\n${formattedSettings}`;
      
      await ctx.reply(message);
      return; // Stay on same step
    } catch (error) {
      logger.error('Error in settings scene step 2:', error);
      await ctx.reply('Sorry, an error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  
  // Step 3: Handle setting value
  async (ctx) => {
    try {
      const userId = ctx.scene.session.userId;
      const userLanguage = await getUserLanguage(userId);
      const settingToChange = ctx.scene.session.settingToChange;
      
      // Check if back button pressed
      if (ctx.message.text === translate('button.back', userLanguage)) {
        // Return to settings menu
        return await showSettingsMenu(ctx);
      }
      
      // Handle language change
      if (settingToChange === 'language') {
        let newLanguage = '';
        
        if (ctx.message.text === 'English') {
          newLanguage = 'en';
        } else if (ctx.message.text === 'Русский') {
          newLanguage = 'ru';
        } else {
          // Invalid language
          await ctx.reply(
            userLanguage === 'en'
              ? 'Please select a valid language.'
              : 'Пожалуйста, выберите корректный язык.'
          );
          return; // Stay on same step
        }
        
        // Update user language
        await pool.query(
          'UPDATE users SET preferred_language = $1 WHERE user_id = $2',
          [newLanguage, userId]
        );
        
        // Update session
        ctx.scene.session.userSettings.language = newLanguage;
        
        // Show success message
        await ctx.reply(
          translate('language.updated', newLanguage, {language: ctx.message.text})
        );
        
        // Return to settings menu
        return await showSettingsMenu(ctx);
      }
      
      // Handle currency change
      if (settingToChange === 'currency') {
        const newCurrency = ctx.message.text.toUpperCase();
        
        // Validate currency (simple validation, can be improved)
        if (!/^[A-Z]{3}$/.test(newCurrency)) {
          await ctx.reply(
            userLanguage === 'en'
              ? 'Please enter a valid 3-letter currency code.'
              : 'Пожалуйста, введите корректный 3-буквенный код валюты.'
          );
          return; // Stay on same step
        }
        
        // Update user currency
        await pool.query(
          'UPDATE users SET currency = $1 WHERE user_id = $2',
          [newCurrency, userId]
        );
        
        // Update session
        ctx.scene.session.userSettings.currency = newCurrency;
        
        // Show success message
        await ctx.reply(
          userLanguage === 'en'
            ? `Currency updated to ${newCurrency}!`
            : `Валюта изменена на ${newCurrency}!`
        );
        
        // Return to settings menu
        return await showSettingsMenu(ctx);
      }
      
      // Handle data sharing change
      if (settingToChange === 'data_sharing') {
        const enableTexts = ['Enable', 'Включить'];
        const disableTexts = ['Disable', 'Отключить'];
        
        let newSetting = null;
        
        if (enableTexts.includes(ctx.message.text)) {
          newSetting = true;
        } else if (disableTexts.includes(ctx.message.text)) {
          newSetting = false;
        } else {
          // Invalid option
          await ctx.reply(
            userLanguage === 'en'
              ? 'Please select a valid option.'
              : 'Пожалуйста, выберите корректную опцию.'
          );
          return; // Stay on same step
        }
        
        // Update user setting
        await pool.query(
          'UPDATE users SET data_sharing_enabled = $1 WHERE user_id = $2',
          [newSetting, userId]
        );
        
        // Update session
        ctx.scene.session.userSettings.data_sharing_enabled = newSetting;
        
        // Show success message
        await ctx.reply(
          userLanguage === 'en'
            ? `Data sharing ${newSetting ? 'enabled' : 'disabled'}!`
            : `Обмен данными ${newSetting ? 'включен' : 'отключен'}!`
        );
        
        // Return to settings menu
        return await showSettingsMenu(ctx);
      }
      
      // Handle notifications change
      if (settingToChange === 'notifications') {
        const enableTexts = ['Enable', 'Включить'];
        const disableTexts = ['Disable', 'Отключить'];
        
        let newSetting = null;
        
        if (enableTexts.includes(ctx.message.text)) {
          newSetting = true;
        } else if (disableTexts.includes(ctx.message.text)) {
          newSetting = false;
        } else {
          // Invalid option
          await ctx.reply(
            userLanguage === 'en'
              ? 'Please select a valid option.'
              : 'Пожалуйста, выберите корректную опцию.'
          );
          return; // Stay on same step
        }
        
        // Update user setting
        await pool.query(
          'UPDATE users SET notifications_enabled = $1 WHERE user_id = $2',
          [newSetting, userId]
        );
        
        // Update session
        ctx.scene.session.userSettings.notifications_enabled = newSetting;
        
        // Show success message
        await ctx.reply(
          userLanguage === 'en'
            ? `Notifications ${newSetting ? 'enabled' : 'disabled'}!`
            : `Уведомления ${newSetting ? 'включены' : 'отключены'}!`
        );
        
        // Return to settings menu
        return await showSettingsMenu(ctx);
      }
      
      // Handle export
      if (settingToChange === 'export') {
        const format = ctx.message.text;
        
        // Show timeframe options
        ctx.scene.session.exportFormat = 
          format === translate('export.format.csv', userLanguage) ? 'csv' : 
          format === translate('export.format.excel', userLanguage) ? 'excel' : null;
        
        if (!ctx.scene.session.exportFormat) {
          await ctx.reply(
            userLanguage === 'en'
              ? 'Please select a valid export format.'
              : 'Пожалуйста, выберите корректный формат экспорта.'
          );
          return; // Stay on same step
        }
        
        // Ask for timeframe
        const keyboard = [
          [Markup.button.text(translate('export.timeframe.month', userLanguage))],
          [Markup.button.text(translate('export.timeframe.quarter', userLanguage))],
          [Markup.button.text(translate('export.timeframe.year', userLanguage))],
          [Markup.button.text(translate('export.timeframe.all', userLanguage))],
          [Markup.button.text(translate('button.back', userLanguage))]
        ];
        
        await ctx.reply(
          translate('export.select_timeframe', userLanguage),
          Markup.keyboard(keyboard).resize()
        );
        
        ctx.scene.session.settingToChange = 'export_timeframe';
        return;
      }
      
      // Handle export timeframe
      if (settingToChange === 'export_timeframe') {
        const timeframe = ctx.message.text;
        let _period;
        
        if (timeframe === translate('export.timeframe.month', userLanguage)) {
          _period = 'month';
        } else if (timeframe === translate('export.timeframe.quarter', userLanguage)) {
          _period = 'quarter';
        } else if (timeframe === translate('export.timeframe.year', userLanguage)) {
          _period = 'year';
        } else if (timeframe === translate('export.timeframe.all', userLanguage)) {
          _period = 'all';
        } else {
          await ctx.reply(
            userLanguage === 'en'
              ? 'Please select a valid timeframe.'
              : 'Пожалуйста, выберите корректный временной период.'
          );
          return; // Stay on same step
        }
        
        // Process export
        await ctx.reply(translate('export.processing', userLanguage));
        
        try {
          const result = await generateExport(userId, ctx.scene.session.exportFormat, _period);
          
          if (result.success) {
            // Send file
            await ctx.replyWithDocument(
              { source: result.filePath, filename: result.fileName },
              { caption: translate('export.completed', userLanguage, {
                count: result.count,
                format: ctx.scene.session.exportFormat.toUpperCase()
              })}
            );
          } else {
            await ctx.reply(
              result.message || translate('export.error', userLanguage)
            );
          }
        } catch (exportError) {
          logger.error('Error generating export:', exportError);
          await ctx.reply(translate('export.error', userLanguage));
        }
        
        // Return to settings menu
        return await showSettingsMenu(ctx);
      }
      
      // Invalid setting, return to menu
      return await showSettingsMenu(ctx);
    } catch (error) {
      logger.error('Error in settings scene step 3:', error);
      await ctx.reply('Sorry, an error occurred. Please try again.');
      return ctx.scene.leave();
    }
  }
);

/**
 * Show settings menu
 * @param {Object} ctx - Telegram context
 */
async function showSettingsMenu(ctx) {
  try {
    const userId = ctx.scene.session.userId;
    const userLanguage = await getUserLanguage(userId);
    
    // Update user settings
    const userSettings = await getUserSettings(userId);
    ctx.scene.session.userSettings = userSettings;
    
    // Format current settings
    const formattedSettings = formatUserSettings(userSettings, userLanguage);
    
    // Create settings menu
    const settingsTitle = translate('settings.title', userLanguage);
    const message = `${settingsTitle}\n\n${formattedSettings}`;
    
    // Create settings keyboard
    const keyboard = [
      [Markup.button.text(translate('settings.language', userLanguage))],
      [Markup.button.text(translate('settings.currency', userLanguage))],
      [Markup.button.text(translate('settings.data_sharing', userLanguage))],
      [Markup.button.text(translate('settings.notifications', userLanguage))],
      [Markup.button.text(translate('settings.export', userLanguage))],
      [Markup.button.text(translate('button.done', userLanguage))]
    ];
    
    await ctx.reply(message, Markup.keyboard(keyboard).resize());
    
    // Return to step 2
    return ctx.wizard.selectStep(1);
  } catch (error) {
    logger.error('Error showing settings menu:', error);
    await ctx.reply('Sorry, an error occurred.');
    return ctx.scene.leave();
  }
}

/**
 * Get user settings from database
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - User settings
 */
async function getUserSettings(userId) {
  try {
    const result = await pool.query(`
      SELECT
        preferred_language as language,
        currency,
        data_sharing_enabled,
        notifications_enabled,
        time_zone
      FROM users
      WHERE user_id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return {
        language: 'en',
        currency: 'EUR',
        data_sharing_enabled: false,
        notifications_enabled: true,
        time_zone: 'UTC'
      };
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting user settings:', error);
    
    // Return defaults in case of error
    return {
      language: 'en',
      currency: 'EUR',
      data_sharing_enabled: false,
      notifications_enabled: true,
      time_zone: 'UTC'
    };
  }
}

/**
 * Format user settings for display
 * @param {Object} settings - User settings
 * @param {String} language - User language
 * @returns {String} - Formatted settings
 */
function formatUserSettings(settings, language) {
  const languageDisplayName = settings.language === 'en' ? 'English' : 'Русский';
  
  const dataSharingStatus = settings.data_sharing_enabled
    ? (language === 'en' ? 'Enabled' : 'Включено')
    : (language === 'en' ? 'Disabled' : 'Отключено');
  
  const notificationsStatus = settings.notifications_enabled
    ? (language === 'en' ? 'Enabled' : 'Включено')
    : (language === 'en' ? 'Disabled' : 'Отключено');
  
  if (language === 'en') {
    return `🌐 Language: ${languageDisplayName}
💱 Currency: ${settings.currency}
📊 Data Sharing: ${dataSharingStatus}
🔔 Notifications: ${notificationsStatus}
⏰ Time Zone: ${settings.time_zone}`;
  } else {
    return `🌐 Язык: ${languageDisplayName}
💱 Валюта: ${settings.currency}
📊 Обмен данными: ${dataSharingStatus}
🔔 Уведомления: ${notificationsStatus}
⏰ Часовой пояс: ${settings.time_zone}`;
  }
}

/**
 * Generate data export
 * @param {String} userId - User ID
 * @param {String} format - Export format
 * @param {String} period - Time period
 * @returns {Promise<Object>} - Export result
 */
async function generateExport(userId, format, _period) {
  // This is a placeholder. In a real implementation, you would:
  // 1. Query expenses based on _period
  // 2. Format data according to chosen format (CSV/Excel)
  // 3. Save to file
  // 4. Return file path for sending
  
  // For now, we'll just return a mock result
  return {
    success: true,
    filePath: Buffer.from('Mock export data'), // In a real implementation, this would be a file path
    fileName: `expenses_export.${format}`,
    count: 10
  };
}

// Handle "done" command to exit scene
settingsScene.hears(/^(Done|Готово)$/i, async (ctx) => {
  const userId = ctx.from.id.toString();
  const userLanguage = await getUserLanguage(userId);
  
  await ctx.reply(
    translate('settings.update_success', userLanguage),
    Markup.removeKeyboard()
  );
  
  return ctx.scene.leave();
});

module.exports = settingsScene;
