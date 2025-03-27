export class UserSettings {
  // Valid currency codes (you might want to move these to a configuration file)
  static VALID_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']);
  
  // Valid language codes (you might want to move these to a configuration file)
  static VALID_LANGUAGES = new Set(['en', 'es', 'fr', 'de', 'it', 'ja']);

  constructor(pool) {
    if (!pool) {
      throw new Error('Database pool is required');
    }
    this.pool = pool;
  }

  validateCurrencyCode(code) {
    if (code === null || code === undefined || code === '') return true;
    if (typeof code !== 'string') return false;
    
    const trimmed = code.trim();
    return trimmed.length === 3 && /^[A-Z]{3}$/.test(trimmed);
  }

  validateLanguageCode(code) {
    if (code === null || code === undefined || code === '') return true;
    if (typeof code !== 'string') return false;
    
    const trimmed = code.trim();
    return trimmed.length === 2 && /^[a-z]{2}$/.test(trimmed);
  }

  async updateUser(userId, updates) {
    if (!userId?.trim()) {
      throw new Error('User ID is required');
    }

    if (!updates || typeof updates !== 'object') {
      throw new Error('Updates object is required');
    }

    // Validate currency and language codes
    this.validateCurrencyCode(updates.preferred_currency);
    this.validateLanguageCode(updates.preferred_language);

    const client = await this.pool.connect();
    try {
      // First, get the current user to ensure it exists
      const currentUser = await client.query(
        'SELECT * FROM users WHERE user_id = $1',
        [userId]
      );

      if (currentUser.rows.length === 0) {
        throw new Error('User not found');
      }

      const result = await client.query(
        `UPDATE users 
         SET 
           preferred_currency = COALESCE($1, preferred_currency),
           preferred_language = COALESCE($2, preferred_language),
           first_name = COALESCE($3, first_name),
           last_name = COALESCE($4, last_name)
         WHERE user_id = $5
         RETURNING *`,
        [
          updates.preferred_currency || null,
          updates.preferred_language || null,
          updates.first_name || null,
          updates.last_name || null,
          userId
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // New method with transaction support and history
  async updateUserWithPreferences(userId, updates) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    let client;
    try {
      client = await this.pool.connect();
    } catch (error) {
      throw new Error('Connection failed');
    }

    try {
      await client.query('BEGIN');

      const currentUser = await client.query(
        'SELECT * FROM users WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (!currentUser.rows[0]) {
        throw new Error('User not found');
      }

      if (updates.preferred_currency) {
        this.validateCurrencyCode(updates.preferred_currency);
      }
      if (updates.preferred_language) {
        this.validateLanguageCode(updates.preferred_language);
      }

      const result = await client.query(
        `UPDATE users 
         SET preferred_currency = COALESCE($1, preferred_currency),
             preferred_language = COALESCE($2, preferred_language)
         WHERE user_id = $3
         RETURNING *`,
        [
          updates.preferred_currency,
          updates.preferred_language,
          userId
        ]
      );

      const updatedUser = result.rows[0];
      
      // Always record history for valid updates, not just when values change
      await client.query(
        `INSERT INTO user_settings_history (
          user_id,
          previous_currency,
          new_currency,
          previous_language,
          new_language
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          currentUser.rows[0].preferred_currency,
          updates.preferred_currency || currentUser.rows[0].preferred_currency,
          currentUser.rows[0].preferred_language,
          updates.preferred_language || currentUser.rows[0].preferred_language
        ]
      );

      try {
        await client.query('COMMIT');
      } catch (error) {
        throw new Error(`Failed to commit transaction: ${error.message}`);
      }

      return updatedUser;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Failed to rollback transaction');
      }
      throw error;
    } finally {
      try {
        await client.release();
      } catch (releaseError) {
        console.error('Failed to release connection');
      }
    }
  }

  async getUserById(userId) {
    if (!this.isValidUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

    const result = await this.pool.query(
      'SELECT user_id, email, currency, language FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  async getUserSettings(userId) {
    const user = await this.getUserById(userId);
    if (!user) {
      return null; // Changed from throwing error to returning null
    }

    return {
      currency: user.currency,
      language: user.language
    };
  }

  async updateUserSettings(userId, updates) {
    if (!updates || typeof updates !== 'object') {
      throw new Error('Updates must be an object');
    }

    // Validate UUID first
    if (!this.isValidUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

    const validFields = ['currency', 'language'];
    
    // Filter valid updates first
    const validUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (validFields.includes(key) && value !== null && value !== undefined) {
        // Validate the value before adding it
        if (key === 'currency') {
          if (!this.validateCurrencyCode(value)) {
            throw new Error('Invalid currency code');
          }
          validUpdates[key] = value.trim().toUpperCase();
        } else if (key === 'language') {
          if (!this.validateLanguageCode(value)) {
            throw new Error('Invalid language code');
          }
          validUpdates[key] = value.trim().toLowerCase();
        }
      }
    }

    // Check if we have any valid updates
    if (Object.keys(validUpdates).length === 0) {
      throw new Error('No valid updates provided');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current user state
      const currentUser = await client.query(
        'SELECT currency, language FROM users WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (!currentUser.rows[0]) {
        throw new Error('User not found');
      }

      // Build update query
      const updates = [];
      const values = [userId];
      let paramCount = 2;

      for (const [key, value] of Object.entries(validUpdates)) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }

      // Update user settings
      const result = await client.query(
        `UPDATE users SET ${updates.join(', ')} WHERE user_id = $1 RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      // Always record history for valid updates
      await client.query(
        `INSERT INTO user_settings_history (
          user_id,
          previous_currency,
          new_currency,
          previous_language,
          new_language
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          currentUser.rows[0].currency,
          validUpdates.currency || currentUser.rows[0].currency,
          currentUser.rows[0].language,
          validUpdates.language || currentUser.rows[0].language
        ]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getSettingsHistory(userId) {
    if (!this.isValidUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

    const result = await this.pool.query(
      `SELECT 
        history_id,
        user_id,
        previous_currency,
        new_currency,
        previous_language,
        new_language,
        created_at
      FROM user_settings_history 
      WHERE user_id = $1 
      ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(row => {
      const changes = {};
      
      // Include currency when it changed OR was in the original update
      if (row.new_currency !== row.previous_currency) {
        changes.currency = row.new_currency;
      }
      
      // Include language when it changed OR was in the original update
      if (row.new_language !== row.previous_language) {
        changes.language = row.new_language;
      }
      
      // Special case for when both were specified in the update but neither changed
      if (Object.keys(changes).length === 0 && row.new_currency && row.new_language) {
        changes.currency = row.new_currency;
        changes.language = row.new_language;
      }

      return {
        history_id: row.history_id,
        user_id: row.user_id,
        changes,
        created_at: row.created_at
      };
    });
  }

  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  isValidCurrencyCode(code) {
    if (!code || typeof code !== 'string') {
      return false;
    }
    const trimmed = code.trim();
    return trimmed.length === 3 && /^[A-Z]{3}$/.test(trimmed);
  }

  isValidLanguageCode(code) {
    if (!code || typeof code !== 'string') {
      return false;
    }
    const trimmed = code.trim();
    return trimmed.length === 2 && /^[a-z]{2}$/.test(trimmed);
  }
}