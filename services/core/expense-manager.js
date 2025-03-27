import { v4 as uuidv4 } from 'uuid';

export class ExpenseManager {
  constructor(pool) {
    this.pool = pool;
  }

  async createExpense({ userId, categoryId, amount, currency, description }) {
    const client = await this.pool.connect();
    try {
      const expenseId = uuidv4();
      const result = await client.query(
        `INSERT INTO expenses (
          expense_id, user_id, category_id, amount, currency, description, date
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *`,
        [expenseId, userId, categoryId, amount, currency, description]
      );
      return result.rows[0];
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
    } finally {
      client.release();
    }
  }
}