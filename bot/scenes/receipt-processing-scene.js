// src/scenes/receiptProcessingScene.js
const { Scenes, Markup } = require('telegraf');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const { getUserLanguage } = require('../services/userManager');
const receiptProcessor = require('../services/receiptProcessor');
const logger = require('../utils/logger');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const receiptProcessingScene = new Scenes.WizardScene(
  'receiptProcessing',
  // Step 1: Handle photo/document upload
  async (ctx) => {
    try {
      const userId = ctx.from.id.toString();
      const userLanguage = await getUserLanguage(userId);
      
      // Create session data
      ctx.scene.session.userId = userId;
      ctx.scene.session.userLanguage = userLanguage;
      
      // Show processing message
      await ctx.reply(
        userLanguage === 'en'
          ? 'Processing your receipt...'
          : 'Обрабатываю ваш чек...'
      );
      
      // Check if we have a photo or document
      let fileId;
      if (ctx.message?.photo) {
        // Get the largest photo (last in array)
        fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      } else if (ctx.message?.document) {
        fileId = ctx.message.document.file_id;
      } else if (ctx.scene.state?.documentId) {
        // Document ID passed from outside the scene
        fileId = ctx.scene.state.documentId;
      } else {
        // No photo or document found
        await ctx.reply(
          userLanguage === 'en'
            ? 'Please send a photo of a receipt or a PDF document.'
            : 'Пожалуйста, отправьте фото чека или PDF-документ.'
        );
        return ctx.scene.leave();
      }
      
      // Store file ID in session
      ctx.scene.session.fileId = fileId;
      
      // Download file
      const fileLink = await ctx.telegram.getFileLink(fileId);
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'temp');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Use node-fetch to download the file
      const fetch = await import('node-fetch');
      const response = await fetch.default(fileLink.href);
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      
      const buffer = await response.buffer();
      
      // Generate a unique filename
      const timestamp = Date.now();
      const filename = `receipt_${userId}_${timestamp}.jpg`;
      const filePath = path.join(uploadsDir, filename);
      
      // Save file
      fs.writeFileSync(filePath, buffer);
      
      // Store file path in session
      ctx.scene.session.filePath = filePath;
      
      // Process receipt using receipt processor service
      try {
        const processingResult = await receiptProcessor.processReceiptToExpense(
          userId,
          buffer,
          'user_upload'
        );
        
        ctx.scene.session.processingResult = processingResult;
        
        if (!processingResult.success) {
          // Processing failed
          await ctx.reply(
            userLanguage === 'en'
              ? `Failed to process the receipt: ${processingResult.message}`
              : `Не удалось обработать чек: ${processingResult.message}`
          );
          
          // Ask if user wants to enter manually
          await ctx.reply(
            userLanguage === 'en'
              ? 'Would you like to enter the expense manually?'
              : 'Хотите ввести расход вручную?',
            Markup.keyboard([
              [userLanguage === 'en' ? 'Yes' : 'Да'],
              [userLanguage === 'en' ? 'No' : 'Нет']
            ]).resize()
          );
          
          return ctx.wizard.next();
        }
        
        // Check if result needs review
        if (processingResult.needsReview) {
          // Ask user to review
          await ctx.reply(
            userLanguage === 'en'
              ? 'Please review the extracted data:'
              : 'Пожалуйста, проверьте извлеченные данные:'
          );
          
          // Show review prompt
          await ctx.reply(processingResult.reviewPrompt);
          
          // Show confirmation options
          await ctx.reply(
            userLanguage === 'en'
              ? 'Is this information correct?'
              : 'Эта информация корректна?',
            Markup.keyboard([
              [userLanguage === 'en' ? 'Yes, correct' : 'Да, верно'],
              [userLanguage === 'en' ? 'No, needs correction' : 'Нет, требует исправления']
            ]).resize()
          );
          
          ctx.scene.session.stage = 'review';
          return ctx.wizard.next();
        }
        
        // Processing succeeded without need for review
        const expense = processingResult.expense;
        
        // Show success message
        await ctx.reply(
          userLanguage === 'en'
            ? 'Receipt processed successfully!'
            : 'Чек успешно обработан!',
          Markup.removeKeyboard()
        );
        
        // Show expense details
        const expenseDetails = await formatExpenseDetails(expense, userLanguage);
        await ctx.reply(expenseDetails);
        
        // Exit scene
        return ctx.scene.leave();
      } catch (processingError) {
        logger.error('Error processing receipt:', processingError);
        
        await ctx.reply(
          userLanguage === 'en'
            ? 'An error occurred while processing the receipt. Would you like to enter the expense manually?'
            : 'Произошла ошибка при обработке чека. Хотите ввести расход вручную?',
          Markup.keyboard([
            [userLanguage === 'en' ? 'Yes' : 'Да'],
            [userLanguage === 'en' ? 'No' : 'Нет']
          ]).resize()
        );
        
        return ctx.wizard.next();
      }
    } catch (error) {
      logger.error('Error in receipt processing scene step 1:', error);
      
      // Try to get user language
      let userLanguage = 'en';
      try {
        userLanguage = await getUserLanguage(ctx.from.id.toString());
      } catch (langError) {
        // Ignore language error, use default
      }
      
      await ctx.reply(
        userLanguage === 'en'
          ? 'Sorry, an error occurred while processing your receipt. Please try again later.'
          : 'Извините, произошла ошибка при обработке вашего чека. Пожалуйста, попробуйте позже.',
        Markup.removeKeyboard()
      );
      
      return ctx.scene.leave();
    }
  },
  
  // Step 2: Handle manual entry or review decision
  async (ctx) => {
    try {
      const userId = ctx.scene.session.userId;
      const userLanguage = ctx.scene.session.userLanguage;
      
      // Check if we're in review stage
      if (ctx.scene.session.stage === 'review') {
        const response = ctx.message.text;
        
        // Check if user confirmed
        if (response === 'Yes, correct' || response === 'Да, верно') {
          // Use data as is
          const expense = ctx.scene.session.processingResult.expense;
          
          // Show success message
          await ctx.reply(
            userLanguage === 'en'
              ? 'Receipt processed successfully!'
              : 'Чек успешно обработан!',
            Markup.removeKeyboard()
          );
          
          // Show expense details
          const expenseDetails = await formatExpenseDetails(expense, userLanguage);
          await ctx.reply(expenseDetails);
          
          // Exit scene
          return ctx.scene.leave();
        } else if (response === 'No, needs correction' || response === 'Нет, требует исправления') {
          // Go to correction mode
          ctx.scene.session.stage = 'correction';
          
          // Ask what to correct
          await ctx.reply(
            userLanguage === 'en'
              ? 'What would you like to correct?'
              : 'Что бы вы хотели исправить?',
            Markup.keyboard([
              [userLanguage === 'en' ? 'Total amount' : 'Общая сумма'],
              [userLanguage === 'en' ? 'Date' : 'Дата'],
              [userLanguage === 'en' ? 'Merchant' : 'Продавец'],
              [userLanguage === 'en' ? 'Category' : 'Категория'],
              [userLanguage === 'en' ? 'Done correcting' : 'Готово']
            ]).resize()
          );
          
          return ctx.wizard.next();
        } else {
          // Invalid response
          await ctx.reply(
            userLanguage === 'en'
              ? 'Please select one of the options.'
              : 'Пожалуйста, выберите один из вариантов.'
          );
          
          return; // Stay on same step
        }
      } else {
        // Handle manual entry decision
        if (ctx.message.text === 'Yes' || ctx.message.text === 'Да') {
          // Redirect to add expense scene
          await ctx.reply(
            userLanguage === 'en'
              ? 'Let\'s add this expense manually.'
              : 'Давайте добавим этот расход вручную.',
            Markup.removeKeyboard()
          );
          
          return ctx.scene.enter('addExpense');
        } else {
          // Cancel
          await ctx.reply(
            userLanguage === 'en'
              ? 'Canceled. You can try again with another receipt photo.'
              : 'Отменено. Вы можете попробовать снова с другим фото чека.',
            Markup.removeKeyboard()
          );
          
          return ctx.scene.leave();
        }
      }
    } catch (error) {
      logger.error('Error in receipt processing scene step 2:', error);
      
      const userLanguage = ctx.scene.session.userLanguage || 'en';
      
      await ctx.reply(
        userLanguage === 'en'
          ? 'Sorry, an error occurred. Please try again later.'
          : 'Извините, произошла ошибка. Пожалуйста, попробуйте позже.',
        Markup.removeKeyboard()
      );
      
      return ctx.scene.leave();
    }
  },
  
  // Step 3: Handle corrections
  async (ctx) => {
    try {
      const userId = ctx.scene.session.userId;
      const userLanguage = ctx.scene.session.userLanguage;
      
      // Check if done correcting
      if (ctx.message.text === 'Done correcting' || ctx.message.text === 'Готово') {
        // Apply all corrections
        try {
          const corrections = ctx.scene.session.corrections || {};
          const expenseId = ctx.scene.session.processingResult.expense.expense_id;
          
          const result = await receiptProcessor.processUserCorrections(
            userId,
            expenseId,
            corrections
          );
          
          if (result.success) {
            // Show success message
            await ctx.reply(
              userLanguage === 'en'
                ? 'Corrections applied successfully!'
                : 'Исправления успешно применены!',
              Markup.removeKeyboard()
            );
            
            // Show updated expense details
            const expenseDetails = await formatExpenseDetails(result.expense, userLanguage);
            await ctx.reply(expenseDetails);
          } else {
            await ctx.reply(
              userLanguage === 'en'
                ? `Failed to apply corrections: ${result.message}`
                : `Не удалось применить исправления: ${result.message}`,
              Markup.removeKeyboard()
            );
          }
        } catch (correctionError) {
          logger.error('Error applying corrections:', correctionError);
          
          await ctx.reply(
            userLanguage === 'en'
              ? 'Error applying corrections. Your receipt was still processed with the original values.'
              : 'Ошибка при применении исправлений. Ваш чек был обработан с исходными значениями.',
            Markup.removeKeyboard()
          );
        }
        
        // Exit scene
        return ctx.scene.leave();
      }
      
      // Init corrections if needed
      if (!ctx.scene.session.corrections) {
        ctx.scene.session.corrections = {};
      }
      
      // Process correction selection
      const fieldToCorrect = ctx.message.text;
      ctx.scene.session.currentCorrection = fieldToCorrect;
      
      if (fieldToCorrect === 'Total amount' || fieldToCorrect === 'Общая сумма') {
        // Ask for new amount
        await ctx.reply(
          userLanguage === 'en'
            ? 'Please enter the correct total amount:'
            : 'Пожалуйста, введите правильную общую сумму:'
        );
        
        return ctx.wizard.next();
      } else if (fieldToCorrect === 'Date' || fieldToCorrect === 'Дата') {
        // Ask for new date
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        await ctx.reply(
          userLanguage === 'en'
            ? `Please enter the correct date (YYYY-MM-DD, e.g. ${today}):`
            : `Пожалуйста, введите правильную дату (ГГГГ-ММ-ДД, например ${today}):`
        );
        
        return ctx.wizard.next();
      } else if (fieldToCorrect === 'Merchant' || fieldToCorrect === 'Продавец') {
        // Ask for new merchant
        await ctx.reply(
          userLanguage === 'en'
            ? 'Please enter the correct merchant name:'
            : 'Пожалуйста, введите правильное название продавца:'
        );
        
        return ctx.wizard.next();
      } else if (fieldToCorrect === 'Category' || fieldToCorrect === 'Категория') {
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
        
        // Store categories in session
        ctx.scene.session.categories = categories;
        
        await ctx.reply(
          userLanguage === 'en'
            ? 'Please select the correct category:'
            : 'Пожалуйста, выберите правильную категорию:',
          Markup.keyboard(keyboard).resize()
        );
        
        return ctx.wizard.next();
      } else {
        // Invalid option
        await ctx.reply(
          userLanguage === 'en'
            ? 'Please select a valid option to correct.'
            : 'Пожалуйста, выберите корректный вариант для исправления.'
        );
        
        // Show correction options again
        await ctx.reply(
          userLanguage === 'en'
            ? 'What would you like to correct?'
            : 'Что бы вы хотели исправить?',
          Markup.keyboard([
            [userLanguage === 'en' ? 'Total amount' : 'Общая сумма'],
            [userLanguage === 'en' ? 'Date' : 'Дата'],
            [userLanguage === 'en' ? 'Merchant' : 'Продавец'],
            [userLanguage === 'en' ? 'Category' : 'Категория'],
            [userLanguage === 'en' ? 'Done correcting' : 'Готово']
          ]).resize()
        );
        
        return; // Stay on same step
      }
    } catch (error) {
      logger.error('Error in receipt processing scene step 3:', error);
      
      const userLanguage = ctx.scene.session.userLanguage || 'en';
      
      await ctx.reply(
        userLanguage === 'en'
          ? 'Sorry, an error occurred with your correction. Please try again.'
          : 'Извините, произошла ошибка с вашим исправлением. Пожалуйста, попробуйте снова.'
      );
      
      // Show correction options again
      await ctx.reply(
        userLanguage === 'en'
          ? 'What would you like to correct?'
          : 'Что бы вы хотели исправить?',
        Markup.keyboard([
          [userLanguage === 'en' ? 'Total amount' : 'Общая сумма'],
          [userLanguage === 'en' ? 'Date' : 'Дата'],
          [userLanguage === 'en' ? 'Merchant' : 'Продавец'],
          [userLanguage === 'en' ? 'Category' : 'Категория'],
          [userLanguage === 'en' ? 'Done correcting' : 'Готово']
        ]).resize()
      );
      
      return; // Stay on same step
    }
  },
  
  // Step 4: Apply the correction
  async (ctx) => {
    try {
      const userId = ctx.scene.session.userId;
      const userLanguage = ctx.scene.session.userLanguage;
      const currentCorrection = ctx.scene.session.currentCorrection;
      
      // Process different correction types
      if (currentCorrection === 'Total amount' || currentCorrection === 'Общая сумма') {
        // Parse amount
        const amount = parseFloat(ctx.message.text.replace(',', '.'));
        
        if (isNaN(amount) || amount <= 0) {
          await ctx.reply(
            userLanguage === 'en'
              ? 'Please enter a valid positive number.'
              : 'Пожалуйста, введите положительное число.'
          );
          
          return; // Stay on same step
        }
        
        // Store correction
        ctx.scene.session.corrections.total = amount;
        
        await ctx.reply(
          userLanguage === 'en'
            ? `Total amount updated to ${amount}`
            : `Общая сумма обновлена до ${amount}`
        );
      } else if (currentCorrection === 'Date' || currentCorrection === 'Дата') {
        // Validate date
        const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
        if (!datePattern.test(ctx.message.text)) {
          await ctx.reply(
            userLanguage === 'en'
              ? 'Please enter the date in YYYY-MM-DD format.'
              : 'Пожалуйста, введите дату в формате ГГГГ-ММ-ДД.'
          );
          
          return; // Stay on same step
        }
        
        const date = new Date(ctx.message.text);
        
        if (isNaN(date.getTime())) {
          await ctx.reply(
            userLanguage === 'en'
              ? 'Please enter a valid date.'
              : 'Пожалуйста, введите корректную дату.'
          );
          
          return; // Stay on same step
        }
        
        // Store correction
        ctx.scene.session.corrections.date = ctx.message.text;
        
        await ctx.reply(
          userLanguage === 'en'
            ? `Date updated to ${ctx.message.text}`
            : `Дата обновлена до ${ctx.message.text}`
        );
      } else if (currentCorrection === 'Merchant' || currentCorrection === 'Продавец') {
        // Store correction
        ctx.scene.session.corrections.merchant = ctx.message.text;
        
        await ctx.reply(
          userLanguage === 'en'
            ? `Merchant updated to ${ctx.message.text}`
            : `Продавец обновлен до ${ctx.message.text}`
        );
      } else if (currentCorrection === 'Category' || currentCorrection === 'Категория') {
        // Find selected category
        const selectedCategoryText = ctx.message.text;
        const selectedCategory = ctx.scene.session.categories.find(
          category => `${category.icon || ''} ${category.name}` === selectedCategoryText
        );
        
        if (!selectedCategory) {
          await ctx.reply(
            userLanguage === 'en'
              ? 'Please select a valid category from the keyboard.'
              : 'Пожалуйста, выберите корректную категорию из клавиатуры.'
          );
          
          return; // Stay on same step
        }
        
        // Store correction
        ctx.scene.session.corrections.category_id = selectedCategory.category_id;
        
        await ctx.reply(
          userLanguage === 'en'
            ? `Category updated to ${selectedCategory.name}`
            : `Категория обновлена до ${selectedCategory.name}`
        );
      }
      
      // Show correction options again
      await ctx.reply(
        userLanguage === 'en'
          ? 'What else would you like to correct?'
          : 'Что еще вы хотели бы исправить?',
        Markup.keyboard([
          [userLanguage === 'en' ? 'Total amount' : 'Общая сумма'],
          [userLanguage === 'en' ? 'Date' : 'Дата'],
          [userLanguage === 'en' ? 'Merchant' : 'Продавец'],
          [userLanguage === 'en' ? 'Category' : 'Категория'],
          [userLanguage === 'en' ? 'Done correcting' : 'Готово']
        ]).resize()
      );
      
      // Go back to correction selection
      return ctx.wizard.back();
    } catch (error) {
      logger.error('Error in receipt processing scene step 4:', error);
      
      const userLanguage = ctx.scene.session.userLanguage || 'en';
      
      await ctx.reply(
        userLanguage === 'en'
          ? 'Sorry, an error occurred with your correction. Please try again.'
          : 'Извините, произошла ошибка с вашим исправлением. Пожалуйста, попробуйте снова.'
      );
      
      // Go back to correction selection
      return ctx.wizard.back();
    }
  }
);

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
 * Format expense details for display
 * @param {Object} expense - Expense data
 * @param {String} language - User language
 * @returns {Promise<String>} - Formatted expense details
 */
async function formatExpenseDetails(expense, language) {
  try {
    // Get category name
    const categoryResult = await pool.query(
      'SELECT name FROM categories WHERE category_id = $1',
      [expense.category_id]
    );
    
    const categoryName = categoryResult.rows.length > 0
      ? categoryResult.rows[0].name
      : language === 'en' ? 'Uncategorized' : 'Без категории';
    
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
      let details = `📝 Детали расхода:\n\n`;
      details += `💰 Сумма: ${formattedAmount}\n`;
      details += `📅 Дата: ${formattedDate}\n`;
      details += `📂 Категория: ${categoryName}\n`;
      
      if (expense.description) {
        details += `📝 Описание: ${expense.description}\n`;
      }
      
      if (expense.merchant_name) {
        details += `🏪 Продавец: ${expense.merchant_name}\n`;
      }
      
      // Add items if available
      if (expense.items && expense.items.length > 0) {
        details += `\n🛒 Позиции:\n`;
        
        for (const item of expense.items) {
          const itemAmount = new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: expense.currency
          }).format(item.amount);
          
          details += `- ${item.product_name}: ${itemAmount}\n`;
        }
      }
      
      return details;
    } else {
      let details = `📝 Expense Details:\n\n`;
      details += `💰 Amount: ${formattedAmount}\n`;
      details += `📅 Date: ${formattedDate}\n`;
      details += `📂 Category: ${categoryName}\n`;
      
      if (expense.description) {
        details += `📝 Description: ${expense.description}\n`;
      }
      
      if (expense.merchant_name) {
        details += `🏪 Merchant: ${expense.merchant_name}\n`;
      }
      
      // Add items if available
      if (expense.items && expense.items.length > 0) {
        details += `\n🛒 Items:\n`;
        
        for (const item of expense.items) {
          const itemAmount = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: expense.currency
          }).format(item.amount);
          
          details += `- ${item.product_name}: ${itemAmount}\n`;
        }
      }
      
      return details;
    }
  } catch (error) {
    logger.error('Error formatting expense details:', error);
    
    // Return simple details in case of error
    return language === 'ru'
      ? `Расход успешно добавлен!`
      : `Expense added successfully!`;
  }
}

// Cleanup on leave
receiptProcessingScene.on('leave', async (ctx) => {
  // Remove temporary file if it exists
  try {
    if (ctx.scene.session.filePath && fs.existsSync(ctx.scene.session.filePath)) {
      fs.unlinkSync(ctx.scene.session.filePath);
    }
  } catch (error) {
    logger.error('Error removing temporary file:', error);
  }
});

module.exports = receiptProcessingScene;