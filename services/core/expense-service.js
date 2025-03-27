import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger-utility.js';
import { pool } from '../../database/db.js';

export class ExpenseService {
  constructor(dbPool = pool) {
    this.pool = dbPool;
  }

  async createExpense(userId, categoryId, amount, currency, description) {
    const client = await this.pool.connect();
    try {
      const expenseId = uuidv4();
      const result = await client.query(
        `INSERT INTO expenses (
          expense_id, user_id, category_id, amount, currency, description
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [expenseId, userId, categoryId, amount, currency, description]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating expense:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserExpenses(userId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM expenses WHERE user_id = $1 ORDER BY date DESC',
        [userId]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting user expenses:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
