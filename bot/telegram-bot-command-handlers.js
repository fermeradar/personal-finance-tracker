const logger = require('../core/logger-utility');
// src/handlers/expenseManagement.js
const { Markup } = require('telegraf');
const expenseManager = require('../services/expenseManager');
const { _detectLanguage } = require('../services/languageDetector');
const { translateText } = require('../services/translator');
const { getUserLanguage } = require('../services/userManager');
const { pool } = require('../../config/database');
const { userLanguage } = require('../../services/localization/i18n-service');

// Add these declarations at the beginning of the file or function scope
let expense;
let currentDate;
let amount;
let datePattern;

/**
 * Handle /list command to show recent expenses
 */
async function handleListCommand(ctx) {
  const userId = ctx.from.id.toString();
  
  try {
    // Get user's preferred language
    const userLanguage = await getUserLanguage(userId);
    
    // Get recent expenses
    const expenses = await expenseManager.getRecentExpenses(userId, {}, 5);
    
    if (expenses.length === 0) {
      const noExpensesMsg = userLanguage === 'en' 
        ? "You don't have any expenses yet. Use /add to add your first _expense!" 
        : await translateText("You don't have any expenses yet. Use /add to add your first expense!", 'en', userLanguage);
      
      return ctx.reply(noExpensesMsg);
    }
    
    // Create message with list of expenses
    let message = userLanguage === 'en' 
      ? 'Your recent expenses:\n\n' 
      : await translateText('Your recent expenses:\n\n', 'en', userLanguage);
    
    // Create inline keyboard for expense management
    const inlineKeyboard = [];
    
    for (const _expense of expenses) {
      const formattedDate = new Date(_expense.expense_date).toLocaleDateString(
        userLanguage === 'ru' ? 'ru-RU' : 'en-US'
      );
      
      const expenseInfo = `${formattedDate}: ${_expense.amount} ${_expense.currency} - ${_expense.category_name || 'Uncategorized'}`;
      message += `• ${expenseInfo}\n`;
      
      // Add view/edit/delete buttons for each expense
      inlineKeyboard.push([
        Markup.button.callback(
          userLanguage === 'en' ? 'View' : await translateText('View', 'en', userLanguage), 
          `view_expense:${_expense.expense_id}`
        ),
        Markup.button.callback(
          userLanguage === 'en' ? 'Edit' : await translateText('Edit', 'en', userLanguage), 
          `edit_expense:${_expense.expense_id}`
        ),
        Markup.button.callback(
          userLanguage === 'en' ? 'Delete' : await translateText('Delete', 'en', userLanguage), 
          `delete_expense:${_expense.expense_id}`
        )
      ]);
    }
    
    // Add "Show more" button if there might be more expenses
    if (expenses.length === 5) {
      inlineKeyboard.push([
        Markup.button.callback(
          userLanguage === 'en' ? 'Show More' : await translateText('Show More', 'en', userLanguage),
          'list_more_expenses:5'
        )
      ]);
    }
    
    // Send the message with inline keyboard
    return ctx.reply(message, Markup.inlineKeyboard(inlineKeyboard));
  } catch (error) {
    logger.error('Error in list command:', error);
    return ctx.reply('Sorry, there was an error listing your expenses. Please try again.');
  }
}

/**
 * Handle the view expense callback
 */
async function handleViewExpense(ctx) {
  const userId = ctx.from.id.toString();
  const expenseId = ctx.callbackQuery.data.split(':')[1];
  
  try {
    // Get user's preferred language
    const userLanguage = await getUserLanguage(userId);
    
    // Get _expense details
    const _expense = await expenseManager.getExpenseById(expenseId, userId);
    
    // Format expense for display
    const formattedExpense = await expenseManager.formatExpenseForDisplay(_expense, userLanguage);
    
    // Create inline keyboard for actions
    const inlineKeyboard = [
      [
        Markup.button.callback(
          userLanguage === 'en' ? 'Edit' : await translateText('Edit', 'en', userLanguage),
          `edit_expense:${expenseId}`
        ),
        Markup.button.callback(
          userLanguage === 'en' ? 'Delete' : await translateText('Delete', 'en', userLanguage),
          `delete_expense:${expenseId}`
        )
      ],
      [
        Markup.button.callback(
          userLanguage === 'en' ? 'Back to List' : await translateText('Back to List', 'en', userLanguage),
          'list_expenses'
        )
      ]
    ];
    
    // If expense has items, add button to view/manage items
    if (expense.has_items) {
      inlineKeyboard[0].push(
        Markup.button.callback(
          userLanguage === 'en' ? 'Manage Items' : await translateText('Manage Items', 'en', userLanguage),
          `view_items:${expenseId}`
        )
      );
    }
    
    // Send the message with inline keyboard
    return ctx.editMessageText(formattedExpense, Markup.inlineKeyboard(inlineKeyboard));
  } catch (error) {
    logger.error('Error viewing _expense:', error);
    return ctx.answerCbQuery('Sorry, there was an error viewing this expense.');
  }
}

/**
 * Handle the delete expense callback
 */
async function handleDeleteExpense(ctx) {
  const userId = ctx.from.id.toString();
  const expenseId = ctx.callbackQuery.data.split(':')[1];
  
  try {
    // Get user's preferred language
    const userLanguage = await getUserLanguage(userId);
    
    // Get _expense details for confirmation
    const _expense = await expenseManager.getExpenseById(expenseId, userId);
    
    // Format basic expense info for confirmation
    const amount = expense.amount;
    const currency = expense.currency;
    const date = new Date(expense.expense_date).toLocaleDateString(
      userLanguage === 'ru' ? 'ru-RU' : 'en-US'
    );
    const category = expense.category_name || 'Uncategorized';
    
    // Create confirmation message
    let confirmationMsg;
    if (userLanguage === 'en') {
      confirmationMsg = `Are you sure you want to delete this expense?\n\n` +
                       `Amount: ${amount} ${currency}\n` +
                       `Date: ${date}\n` +
                       `Category: ${category}`;
    } else if (userLanguage === 'ru') {
      confirmationMsg = `Вы уверены, что хотите удалить этот расход?\n\n` +
                       `Сумма: ${amount} ${currency}\n` +
                       `Дата: ${date}\n` +
                       `Категория: ${category}`;
    } else {
      const engMsg = `Are you sure you want to delete this _expense?\n\n` +
                    `Amount: ${amount} ${currency}\n` +
                    `Date: ${date}\n` +
                    `Category: ${category}`;
      confirmationMsg = await translateText(engMsg, 'en', userLanguage);
    }
    
    // Create confirmation keyboard
    const confirmKeyboard = [
      [
        Markup.button.callback(
          userLanguage === 'en' ? 'Yes, Delete' : await translateText('Yes, Delete', 'en', userLanguage),
          `confirm_delete:${expenseId}`
        ),
        Markup.button.callback(
          userLanguage === 'en' ? 'Cancel' : await translateText('Cancel', 'en', userLanguage),
          `view_expense:${expenseId}`
        )
      ]
    ];
    
    // Send confirmation message
    return ctx.editMessageText(confirmationMsg, Markup.inlineKeyboard(confirmKeyboard));
  } catch (error) {
    logger.error('Error preparing _expense deletion:', error);
    return ctx.answerCbQuery('Sorry, there was an error preparing to delete this expense.');
  }
}

/**
 * Handle confirmation of expense deletion
 */
async function handleConfirmDelete(ctx) {
  const userId = ctx.from.id.toString();
  const expenseId = ctx.callbackQuery.data.split(':')[1];
  
  try {
    // Get user's preferred language
    const userLanguage = await getUserLanguage(userId);
    
    // Delete the _expense
    await expenseManager.deleteExpense(expenseId, userId);
    
    // Success message
    let successMsg;
    if (userLanguage === 'en') {
      successMsg = 'Expense deleted successfully!';
    } else if (userLanguage === 'ru') {
      successMsg = 'Расход успешно удален!';
    } else {
      successMsg = await translateText('Expense deleted successfully!', 'en', userLanguage);
    }
    
    // Show success and return to list
    await ctx.answerCbQuery(successMsg);
    return handleListCommand(ctx);
  } catch (error) {
    logger.error('Error deleting _expense:', error);
    return ctx.answerCbQuery('Sorry, there was an error deleting this expense.');
  }
}

/**
 * Handle edit expense command/callback
 */
async function handleEditExpense(ctx) {
  const userId = ctx.from.id.toString();
  const expenseId = ctx.callbackQuery.data.split(':')[1];
  
  try {
    // Get user's preferred language
    const userLanguage = await getUserLanguage(userId);
    
    // Get _expense details
    const _expense = await expenseManager.getExpenseById(expenseId, userId);
    
    // Save in session for editing
    ctx.session = ctx.session || {};
    ctx.session.editingExpense = {
      id: expenseId,
      _expense: expense,
      field: null // No field selected yet
    };
    
    // Create message asking what to edit
    let message;
    if (userLanguage === 'en') {
      message = `What would you like to edit for this _expense?\n\n` +
               `Amount: ${expense.amount} ${_expense.currency}\n` +
               `Date: ${new Date(_expense.expense_date).toLocaleDateString('en-US')}\n` +
               `Category: ${_expense.category_name || 'Uncategorized'}\n` +
               (expense.vendor_name ? `Vendor: ${_expense.vendor_name}\n` : '') +
               (expense.description ? `Description: ${_expense.description}\n` : '');
    } else if (userLanguage === 'ru') {
      message = `Что бы вы хотели изменить в этом расходе?\n\n` +
               `Сумма: ${_expense.amount} ${_expense.currency}\n` +
               `Дата: ${new Date(_expense.expense_date).toLocaleDateString('ru-RU')}\n` +
               `Категория: ${_expense.category_name || 'Без категории'}\n` +
               (expense.vendor_name ? `Продавец: ${_expense.vendor_name}\n` : '') +
               (expense.description ? `Описание: ${_expense.description}\n` : '');
    } else {
      const engMsg = `What would you like to edit for this _expense?\n\n` +
                    `Amount: ${expense.amount} ${_expense.currency}\n` +
                    `Date: ${new Date(_expense.expense_date).toLocaleDateString('en-US')}\n` +
                    `Category: ${_expense.category_name || 'Uncategorized'}\n` +
                    (expense.vendor_name ? `Vendor: ${_expense.vendor_name}\n` : '') +
                    (expense.description ? `Description: ${_expense.description}\n` : '');
      message = await translateText(engMsg, 'en', userLanguage);
    }
    
    // Create keyboard with edit options
    const editKeyboard = [];
    
    // First row: Amount and Date
    editKeyboard.push([
      Markup.button.callback(
        userLanguage === 'en' ? 'Amount' : await translateText('Amount', 'en', userLanguage),
        `edit_field:${expenseId}:amount`
      ),
      Markup.button.callback(
        userLanguage === 'en' ? 'Date' : await translateText('Date', 'en', userLanguage),
        `edit_field:${expenseId}:date`
      )
    ]);
    
    // Second row: Category and Vendor
    editKeyboard.push([
      Markup.button.callback(
        userLanguage === 'en' ? 'Category' : await translateText('Category', 'en', userLanguage),
        `edit_field:${expenseId}:category`
      ),
      Markup.button.callback(
        userLanguage === 'en' ? 'Vendor' : await translateText('Vendor', 'en', userLanguage),
        `edit_field:${expenseId}:vendor`
      )
    ]);
    
    // Third row: Description and Items (if any)
    const thirdRow = [
      Markup.button.callback(
        userLanguage === 'en' ? 'Description' : await translateText('Description', 'en', userLanguage),
        `edit_field:${expenseId}:description`
      )
    ];
    
    if (expense.has_items) {
      thirdRow.push(
        Markup.button.callback(
          userLanguage === 'en' ? 'Items' : await translateText('Items', 'en', userLanguage),
          `edit_items:${expenseId}`
        )
      );
    }
    
    editKeyboard.push(thirdRow);
    
    // Fourth row: Back button
    editKeyboard.push([
      Markup.button.callback(
        userLanguage === 'en' ? 'Back' : await translateText('Back', 'en', userLanguage),
        `view_expense:${expenseId}`
      )
    ]);
    
    // Send edit options
    return ctx.editMessageText(message, Markup.inlineKeyboard(editKeyboard));
  } catch (error) {
    logger.error('Error preparing _expense edit:', error);
    return ctx.answerCbQuery('Sorry, there was an error preparing to edit this expense.');
  }
}

/**
 * Handle edit field selection
 */
async function handleEditField(ctx) {
  const userId = ctx.from.id.toString();
  const [expenseId, field] = ctx.callbackQuery.data.split(':').slice(1);
  
  try {
    // Get user's preferred language
    const userLanguage = await getUserLanguage(userId);
    
    // Get _expense if not in session
    if (!ctx.session?.editingExpense || ctx.session.editingExpense.id !== expenseId) {
      const _expense = await expenseManager.getExpenseById(expenseId, userId);
      ctx.session = ctx.session || {};
      ctx.session.editingExpense = {
        id: expenseId,
        _expense: expense
      };
    }
    
    // Update session with selected field
    ctx.session.editingExpense.field = field;
    
    // Create prompt based on field
    let prompt;
    const _expense = ctx.session.editingExpense.expense;
    
    switch (field) {
      case 'amount':
        if (userLanguage === 'en') {
          prompt = `Current amount: ${_expense.amount} ${_expense.currency}\n\nPlease enter the new amount:`;
        } else if (userLanguage === 'ru') {
          prompt = `Текущая сумма: ${_expense.amount} ${_expense.currency}\n\nПожалуйста, введите новую сумму:`;
        } else {
          const engPrompt = `Current amount: ${_expense.amount} ${_expense.currency}\n\nPlease enter the new amount:`;
          prompt = await translateText(engPrompt, 'en', userLanguage);
        }
        break;
        
      case 'date': {
        currentDate = new Date(expense.expense_date).toISOString().split('T')[0];
        if (userLanguage === 'en') {
          prompt = `Current date: ${currentDate}\n\nPlease enter the new date (YYYY-MM-DD):`;
        } else if (userLanguage === 'ru') {
          prompt = `Текущая дата: ${currentDate}\n\nПожалуйста, введите новую дату (ГГГГ-ММ-ДД):`;
        } else {
          const engPrompt = `Current date: ${currentDate}\n\nPlease enter the new date (YYYY-MM-DD):`;
          prompt = await translateText(engPrompt, 'en', userLanguage);
        }
        break;
      }
      
      case 'category':
        // For category, we'll provide a list of categories to choose from
        // This will be handled separately
        return handleCategorySelection(ctx);
        
      case 'vendor':
        if (userLanguage === 'en') {
          prompt = `Current vendor: ${_expense.vendor_name || 'None'}\n\nPlease enter the new vendor name:`;
        } else if (userLanguage === 'ru') {
          prompt = `Текущий продавец: ${_expense.vendor_name || 'Нет'}\n\nПожалуйста, введите новое название продавца:`;
        } else {
          const engPrompt = `Current vendor: ${_expense.vendor_name || 'None'}\n\nPlease enter the new vendor name:`;
          prompt = await translateText(engPrompt, 'en', userLanguage);
        }
        break;
        
      case 'description':
        if (userLanguage === 'en') {
          prompt = `Current description: ${_expense.description || 'None'}\n\nPlease enter the new description:`;
        } else if (userLanguage === 'ru') {
          prompt = `Текущее описание: ${_expense.description || 'Нет'}\n\nПожалуйста, введите новое описание:`;
        } else {
          const engPrompt = `Current description: ${_expense.description || 'None'}\n\nPlease enter the new description:`;
          prompt = await translateText(engPrompt, 'en', userLanguage);
        }
        break;
        
      default:
        return ctx.answerCbQuery('Unknown field selected');
    }
    
    // Send prompt with cancel button
    return ctx.editMessageText(prompt, Markup.inlineKeyboard([
      [
        Markup.button.callback(
          userLanguage === 'en' ? 'Cancel' : await translateText('Cancel', 'en', userLanguage),
          `edit_expense:${expenseId}`
        )
      ]
    ]));
  } catch (error) {
    logger.error('Error handling field edit:', error);
    return ctx.answerCbQuery('Sorry, there was an error preparing to edit this field.');
  }
}

/**
 * Handle response with new field value
 */
async function handleFieldUpdate(ctx) {
  // This function is called when user responds with new value
  if (!ctx.session?.editingExpense?.field) {
    return; // Not in edit mode
  }
  
  const userId = ctx.from.id.toString();
  const { id: expenseId, field, _expense } = ctx.session.editingExpense;
  const newValue = ctx.message.text;
  
  try {
    // Get user's preferred language
    const userLanguage = await getUserLanguage(userId);
    
    // Validate and process the input based on field
    const updates = {};
    
    switch (field) {
      case 'amount': {
        amount = parseFloat(newValue);
        if (isNaN(amount) || amount <= 0) {
          const errorMsg = userLanguage === 'en' 
            ? 'Please enter a valid positive number for the amount.' 
            : await translateText('Please enter a valid positive number for the amount.', 'en', userLanguage);
          
          return ctx.reply(errorMsg, Markup.inlineKeyboard([
            [Markup.button.callback('Retry', `edit_field:${expenseId}:amount`)]
          ]));
        }
        updates.amount = amount;
        break;
      }
      
      case 'date': {
        datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
        if (!datePattern.test(newValue)) {
          const errorMsg = userLanguage === 'en' 
            ? 'Please enter the date in YYYY-MM-DD format.' 
            : await translateText('Please enter the date in YYYY-MM-DD format.', 'en', userLanguage);
          
          return ctx.reply(errorMsg, Markup.inlineKeyboard([
            [Markup.button.callback('Retry', `edit_field:${expenseId}:date`)]
          ]));
        }
        updates.expense_date = newValue;
        break;
      }
      
      case 'vendor':
        // No special validation for vendor
        updates.vendor_name = newValue;
        break;
        
      case 'description':
        // No special validation for description
        updates.description = newValue;
        break;
        
      default:
        return ctx.reply('Unknown field. Please try again.');
    }
    
    // Update the expense
    const _updatedExpense = await expenseManager.updateExpense(expenseId, userId, updates);
    
    // Clear edit session
    delete ctx.session.editingExpense;
    
    // Show success message
    let successMsg;
    if (userLanguage === 'en') {
      successMsg = `Expense updated successfully!`;
    } else if (userLanguage === 'ru') {
      successMsg = `Расход успешно обновлен!`;
    } else {
      successMsg = await translateText(`Expense updated successfully!`, 'en', userLanguage);
    }
    
    await ctx.reply(successMsg);
    
    // Show updated expense
    const formattedExpense = await expenseManager.formatExpenseForDisplay(_updatedExpense, userLanguage);
    
    return ctx.reply(formattedExpense, Markup.inlineKeyboard([
      [
        Markup.button.callback(
          userLanguage === 'en' ? 'Edit More' : await translateText('Edit More', 'en', userLanguage), 
          `edit_expense:${expenseId}`
        ),
        Markup.button.callback(
          userLanguage === 'en' ? 'Done' : await translateText('Done', 'en', userLanguage),
          `view_expense:${expenseId}`
        )
      ]
    ]));
  } catch (error) {
    logger.error('Error updating _expense field:', error);
    
    const errorMsg = userLanguage === 'en' 
      ? 'Sorry, there was an error updating the expense. Please try again.' 
      : await translateText('Sorry, there was an error updating the expense. Please try again.', 'en', userLanguage);
    
    return ctx.reply(errorMsg);
  }
}

/**
 * Handle category selection for editing
 */
async function handleCategorySelection(ctx) {
  const userId = ctx.from.id.toString();
  const expenseId = ctx.session.editingExpense.id;
  
  try {
    // Get user's preferred language
    const userLanguage = await getUserLanguage(userId);
    
    // Get categories
    const categoriesResult = await pool.query(`
      SELECT category_id, name, icon
      FROM categories
      WHERE is_system = true OR user_id = $1
      ORDER BY name
    `, [userId]);
    
    const categories = categoriesResult.rows;
    
    // Create prompt
    let prompt;
    if (userLanguage === 'en') {
      prompt = 'Select a category for this _expense:';
    } else if (userLanguage === 'ru') {
      prompt = 'Выберите категорию для этого расхода:';
    } else {
      prompt = await translateText('Select a category for this _expense:', 'en', userLanguage);
    }
    
    // Create keyboard with categories
    const keyboard = [];
    const buttonsPerRow = 3;
    
    for (let i = 0; i < categories.length; i += buttonsPerRow) {
      const row = [];
      
      for (let j = 0; j < buttonsPerRow && i + j < categories.length; j++) {
        const category = categories[i + j];
        const buttonText = `${category.icon || ''} ${category.name}`;
        
        row.push(
          Markup.button.callback(
            buttonText,
            `set_category:${expenseId}:${category.category_id}`
          )
        );
      }
      
      keyboard.push(row);
    }
    
    // Add cancel button
    keyboard.push([
      Markup.button.callback(
        userLanguage === 'en' ? 'Cancel' : await translateText('Cancel', 'en', userLanguage),
        `edit_expense:${expenseId}`
      )
    ]);
    
    // Send category selection
    return ctx.editMessageText(prompt, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    logger.error('Error handling category selection:', error);
    return ctx.answerCbQuery('Sorry, there was an error loading categories.');
  }
}

/**
 * Handle category selection response
 */
async function handleSetCategory(ctx) {
  const userId = ctx.from.id.toString();
  const [expenseId, categoryId] = ctx.callbackQuery.data.split(':').slice(1);
  
  try {
    // Get user's preferred language
    const userLanguage = await getUserLanguage(userId);
    
    // Update the _expense with new category
    const _updatedExpense = await expenseManager.updateExpense(expenseId, userId, {
      category_id: categoryId
    });
    
    // Show success message
    await ctx.answerCbQuery(
      userLanguage === 'en' 
        ? 'Category updated successfully!'
        : await translateText('Category updated successfully!', 'en', userLanguage)
    );
    
    // Return to expense view
    return handleViewExpense({ 
      ...ctx, 
      callbackQuery: { 
        ...ctx.callbackQuery, 
        data: `view_expense:${expenseId}` 
      } 
    });
  } catch (error) {
    logger.error('Error setting category:', error);
    return ctx.answerCbQuery('Sorry, there was an error updating the category.');
  }
}

/**
 * Handle view/edit items
 */
async function handleViewItems(ctx) {
  const userId = ctx.from.id.toString();
  const expenseId = ctx.callbackQuery.data.split(':')[1];
  
  try {
    // Get user's preferred language
    const userLanguage = await getUserLanguage(userId);
    
    // Get _expense with items
    const _expense = await expenseManager.getExpenseById(expenseId, userId);
    
    if (!expense.items || expense.items.length === 0) {
      return ctx.answerCbQuery(
        userLanguage === 'en'
          ? 'This expense has no itemized details.'
          : await translateText('This expense has no itemized details.', 'en', userLanguage)
      );
    }
    
    // Create message with items
    let message;
    if (userLanguage === 'en') {
      message = `Items for _expense on ${new Date(expense.expense_date).toLocaleDateString()}:\n\n`;
    } else if (userLanguage === 'ru') {
      message = `Позиции для расхода от ${new Date(_expense.expense_date).toLocaleDateString('ru-RU')}:\n\n`;
    } else {
      const engMsg = `Items for _expense on ${new Date(expense.expense_date).toLocaleDateString()}:\n\n`;
      message = await translateText(engMsg, 'en', userLanguage);
    }
    
    // Create inline keyboard for item management
    const inlineKeyboard = [];
    
    for (const item of expense.items) {
      const itemText = `${item.product_name}: ${item.amount} ${_expense.currency}` +
                     (item.quantity > 1 ? ` (${item.quantity} x ${item.unit_price})` : '');
      
      message += `• ${itemText}\n`;
      
      // Add delete button for each item
      inlineKeyboard.push([
        Markup.button.callback(
          userLanguage === 'en'
            ? `Delete: ${item.product_name.substring(0, 20)}`
            : await translateText(`Delete: ${item.product_name.substring(0, 20)}`, 'en', userLanguage),
          `delete_item:${expenseId}:${item.item_id}`
        )
      ]);
    }
    
    // Add back button
    inlineKeyboard.push([
      Markup.button.callback(
        userLanguage === 'en' ? 'Back to Expense' : await translateText('Back to Expense', 'en', userLanguage),
        `view_expense:${expenseId}`
      )
    ]);
    
    // Send the message with inline keyboard
    return ctx.editMessageText(message, Markup.inlineKeyboard(inlineKeyboard));
  } catch (error) {
    logger.error('Error viewing items:', error);
    return ctx.answerCbQuery('Sorry, there was an error viewing the items.');
  }
}

/**
 * Handle delete item confirmation
 */
async function handleDeleteItem(ctx) {
  const userId = ctx.from.id.toString();
  const [expenseId, itemId] = ctx.callbackQuery.data.split(':').slice(1);
  
  try {
    // Get user's preferred language
    const userLanguage = await getUserLanguage(userId);
    
    // Get item details
    const itemResult = await pool.query(`
      SELECT ei.* 
      FROM expense_items ei
      JOIN expenses e ON ei.expense_id = e.expense_id
      WHERE ei.item_id = $1 AND e.user_id = $2
    `, [itemId, userId]);
    
    if (itemResult.rows.length === 0) {
      return ctx.answerCbQuery('Item not found or does not belong to you.');
    }
    
    const item = itemResult.rows[0];
    
    // Create confirmation message
    let confirmMsg;
    if (userLanguage === 'en') {
      confirmMsg = `Are you sure you want to delete this item?\n\n${item.product_name}: ${item.amount}`;
    } else if (userLanguage === 'ru') {
      confirmMsg = `Вы уверены, что хотите удалить эту позицию?\n\n${item.product_name}: ${item.amount}`;
    } else {
      const engMsg = `Are you sure you want to delete this item?\n\n${item.product_name}: ${item.amount}`;
      confirmMsg = await translateText(engMsg, 'en', userLanguage);
    }
    
    // Create confirmation keyboard
    const confirmKeyboard = [
      [
        Markup.button.callback(
          userLanguage === 'en' ? 'Yes, Delete' : await translateText('Yes, Delete', 'en', userLanguage),
          `confirm_delete_item:${expenseId}:${itemId}`
        ),
        Markup.button.callback(
          userLanguage === 'en' ? 'Cancel' : await translateText('Cancel', 'en', userLanguage),
          `view_items:${expenseId}`
        )
      ]
    ];
    
    // Send confirmation message
    return ctx.editMessageText(confirmMsg, Markup.inlineKeyboard(confirmKeyboard));
  } catch (error) {
    logger.error('Error preparing item deletion:', error);
    return ctx.answerCbQuery('Sorry, there was an error preparing to delete this item.');
  }
}

/**
 * Handle confirmation of item deletion
 */
async function handleConfirmDeleteItem(ctx) {
  const userId = ctx.from.id.toString();
  const [expenseId, itemId] = ctx.callbackQuery.data.split(':').slice(1);
  
  try {
    // Get user's preferred language
    const userLanguage = await getUserLanguage(userId);
    
    // Delete the item
    await expenseManager.deleteExpenseItem(expenseId, itemId, userId);
    
    // Success message
    await ctx.answerCbQuery(
      userLanguage === 'en'
        ? 'Item deleted successfully!'
        : await translateText('Item deleted successfully!', 'en', userLanguage)
    );
    
    // Return to items view
    return handleViewItems({ 
      ...ctx, 
      callbackQuery: { 
        ...ctx.callbackQuery, 
        data: `view_items:${expenseId}` 
      } 
    });
  } catch (error) {
    logger.error('Error deleting item:', error);
    return ctx.answerCbQuery('Sorry, there was an error deleting this item.');
  }
}

// Export all handlers
module.exports = {
  handleListCommand,
  handleViewExpense,
  handleDeleteExpense,
  handleConfirmDelete,
  handleEditExpense,
  handleEditField,
  handleFieldUpdate,
  handleCategorySelection,
  handleSetCategory,
  handleViewItems,
  handleDeleteItem,
  handleConfirmDeleteItem
};
