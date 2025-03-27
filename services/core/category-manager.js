import { v4 as uuidv4 } from 'uuid';

export class CategoryManager {
  constructor(pool) {
    this.pool = pool;
  }

  async createDefaultCategories(userId) {
    const defaultCategories = [
      'Food & Dining',
      'Transportation',
      'Housing',
      'Entertainment',
      'Shopping'
    ];

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const categories = [];
      for (const name of defaultCategories) {
        const categoryId = uuidv4();
        const result = await client.query(
          `INSERT INTO categories (category_id, user_id, name)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [categoryId, userId, name]
        );
        categories.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return categories;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserCategories(userId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM categories WHERE user_id = $1 ORDER BY name',
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }
}