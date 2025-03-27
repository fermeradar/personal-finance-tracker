import { logger } from '../core/logger-utility.js';
import { pool } from '../../database/db.js';
import { ExpenseService } from '../core/expense-service.js';

export class AnalyticsService {
  constructor(dbPool = pool) {
    this.pool = dbPool;
    this.expenseService = new ExpenseService(dbPool);
  }

  async getUserAnalytics(userId) {
    try {
      const expenses = await this.expenseService.getExpenses(userId);
      return {
        totalExpenses: expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0),
        count: expenses.length
      };
    } catch (error) {
      logger.error('Error getting user analytics:', error);
      throw error;
    }
  }

  async getExpensesByCategory(userId, startDate, endDate) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT 
          c.name as category,
          SUM(e.amount) as total,
          COUNT(*) as count
         FROM expenses e
         JOIN categories c ON e.category_id = c.category_id
         WHERE e.user_id = $1
         AND e.date BETWEEN $2 AND $3
         GROUP BY c.name
         ORDER BY total DESC`,
        [userId, startDate, endDate]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting expenses by category:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
