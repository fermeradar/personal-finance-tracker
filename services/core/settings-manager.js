export class SettingsManager {
  constructor(pool) {
    this.pool = pool;
  }

  async updateUser(userId, updates) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `UPDATE users 
         SET 
           preferred_currency = COALESCE($1, preferred_currency),
           preferred_language = COALESCE($2, preferred_language)
         WHERE user_id = $3
         RETURNING *`,
        [updates.preferred_currency, updates.preferred_language, userId]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }
}
