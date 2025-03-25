import { telegramService } from '../services/telegram/telegram-service.js';
import { logger } from '../utils/logger.js';

// Example of sending a notification
async function sendTestNotification() {
  try {
    await telegramService.sendNotification(
      'Hello! This is a test notification from your Personal Finance Tracker.'
    );
    logger.info('Test notification sent successfully');
  } catch (error) {
    logger.error('Failed to send test notification:', error);
  }
}

// Example of sending a formatted expense report
async function sendExpenseReport(expenses) {
  try {
    const message = formatExpenseReport(expenses);
    await telegramService.sendNotification(message);
    logger.info('Expense report sent successfully');
  } catch (error) {
    logger.error('Failed to send expense report:', error);
  }
}

// Helper function to format expense report
function formatExpenseReport(expenses) {
  const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  
  let message = '<b>📊 Expense Report</b>\n\n';
  
  expenses.forEach(expense => {
    message += `🔹 ${expense.category}: ${expense.amount} ${expense.currency}\n`;
    if (expense.note) message += `   📝 ${expense.note}\n`;
  });
  
  message += `\n<b>Total: ${total} ${expenses[0]?.currency || 'USD'}</b>`;
  return message;
}

// Example usage
const sampleExpenses = [
  { category: 'Groceries', amount: 85.50, currency: 'USD', note: 'Weekly groceries' },
  { category: 'Transport', amount: 25.00, currency: 'USD', note: 'Bus tickets' },
  { category: 'Entertainment', amount: 45.00, currency: 'USD', note: 'Movie night' }
];

// Start the bot and send test messages
async function runExample() {
  try {
    await telegramService.start();
    await sendTestNotification();
    await sendExpenseReport(sampleExpenses);
  } catch (error) {
    logger.error('Error running example:', error);
  } finally {
    await telegramService.stop();
  }
}

// Run the example if this file is executed directly
if (process.argv[1] === import.meta.url) {
  runExample().catch(console.error);
} 