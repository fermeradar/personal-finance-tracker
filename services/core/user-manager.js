import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '../../src/utils/auth.js';
import { pool } from '../../database/db.js';
import { logger } from './logger-utility.js';

export class UserManager {
  constructor(dbPool = pool) {
    this.pool = dbPool;
  }

  async createUser(userData) {
    if (!userData?.password) {
      throw new Error('Email and password are required');
    }

    if (!userData?.email) {
      throw new Error('Email and password are required');
    }

    if (typeof userData.email !== 'string') {
      throw new Error('Invalid email format');
    }

    const trimmedEmail = userData.email.trim();
    if (!this.isValidEmail(trimmedEmail)) {
      throw new Error('Invalid email format');
    }

    const client = await this.pool.connect();
    try {
      const hashedPassword = await hashPassword(userData.password);
      const userId = uuidv4();
      
      const result = await client.query(
        `INSERT INTO users (
          user_id,
          email,
          password,
          first_name,
          last_name,
          preferred_currency,
          preferred_language
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING 
          user_id,
          email,
          first_name,
          last_name,
          preferred_currency,
          preferred_language`,
        [
          userId,
          trimmedEmail,
          hashedPassword,
          userData.firstName ?? null,
          userData.lastName ?? null,
          userData.preferredCurrency || 'USD',
          userData.preferredLanguage || 'en'
        ]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new Error('Email already exists');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserById(userId) {
    if (!userId?.trim()) {
      throw new Error('User ID is required');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT 
          user_id,
          email,
          first_name,
          last_name,
          preferred_currency,
          preferred_language
        FROM users
        WHERE user_id = $1`,
        [userId]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async getUserByEmail(email) {
    if (!email) {
      throw new Error('Email is required');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async deleteUser(userId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM expenses WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM categories WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM users WHERE user_id = $1', [userId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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

  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async searchUsers(searchTerm) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM users 
         WHERE first_name ILIKE $1 
         OR last_name ILIKE $1 
         OR email ILIKE $1`,
        [`%${searchTerm}%`]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }
}

export const TEST_EXPORT = 'TEST';
