const { pool } = require('../../database/db');

const setupTestDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Drop existing tables if they exist
    await client.query(`
      DROP TABLE IF EXISTS expenses CASCADE;
      DROP TABLE IF EXISTS document_extractions CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
      DROP TABLE IF EXISTS exchange_rates CASCADE;
      DROP TABLE IF EXISTS sessions CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create tables
    await client.query(`
      CREATE TABLE users (
        user_id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        language VARCHAR(10) DEFAULT 'en',
        timezone VARCHAR(50) DEFAULT 'UTC',
        currency VARCHAR(3) DEFAULT 'USD',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE categories (
        category_id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) REFERENCES users(user_id),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE expenses (
        expense_id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) REFERENCES users(user_id),
        category_id INTEGER REFERENCES categories(category_id),
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        description TEXT,
        date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE exchange_rates (
        currency_pair VARCHAR(7) PRIMARY KEY,
        rate DECIMAL(10,4) NOT NULL,
        last_updated TIMESTAMP NOT NULL
      );
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const cleanupTestDatabase = async (client) => {
  await client.query('BEGIN');
  try {
    await client.query('DELETE FROM expenses');
    await client.query('DELETE FROM document_extractions');
    await client.query('DELETE FROM categories');
    await client.query('DELETE FROM exchange_rates');
    await client.query('DELETE FROM sessions');
    await client.query('DELETE FROM users');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};

module.exports = {
  setupTestDatabase,
  cleanupTestDatabase
};