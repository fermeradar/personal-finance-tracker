let $2;
const { pool } = require('../../src/config/database');
const { hashPassword } = require('../../src/utils/auth');
const { generateToken } = require('../../src/utils/jwt');
const _userManager = require($2);

// Common test data
const TEST_DATA = {
  users: [
    {
      email: 'test@example.com',
      password: 'Test123!@#',
      firstName: 'Test',
      lastName: 'User',
      language: 'en',
      timezone: 'UTC',
      currency: 'USD'
    }
  ],
  categories: [
    {
      name: 'Food',
      icon: '🍔',
      color: '#FF5733',
      isSystem: true
    }
  ],
  exchangeRates: [
    { currency_pair: 'USD_EUR', rate: 0.85 },
    { currency_pair: 'EUR_USD', rate: 1.18 },
    { currency_pair: 'USD_RUB', rate: 90.00 },
    { currency_pair: 'RUB_USD', rate: 0.011 }
  ],
  translations: [
    { key: 'settings.language', language: 'en', value: 'Language Settings' },
    { key: 'settings.language', language: 'ru', value: 'Настройки языка' },
    { key: 'settings.currency', language: 'en', value: 'Currency Settings' },
    { key: 'settings.currency', language: 'ru', value: 'Настройки валюты' },
    { key: 'settings.notifications', language: 'en', value: 'Notification Settings' },
    { key: 'settings.notifications', language: 'ru', value: 'Настройки уведомлений' },
    { key: 'analytics.monthly', language: 'en', value: 'Monthly Analytics' },
    { key: 'analytics.monthly', language: 'ru', value: 'Ежемесячная аналитика' },
    { key: 'analytics.trend', language: 'en', value: 'Spending Trend' },
    { key: 'analytics.trend', language: 'ru', value: 'Тренд расходов' }
  ]
};

// Database setup functions
async function setupDatabase() {
  // Create test tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      first_name VARCHAR(50) NOT NULL,
      last_name VARCHAR(50) NOT NULL,
      language VARCHAR(2) DEFAULT 'en',
      timezone VARCHAR(50) NOT NULL,
      currency VARCHAR(3) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      icon VARCHAR(50) NOT NULL,
      color VARCHAR(7) NOT NULL,
      is_system BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      category_id UUID REFERENCES categories(id),
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) NOT NULL,
      description TEXT NOT NULL,
      date TIMESTAMP WITH TIME ZONE NOT NULL,
      payment_method VARCHAR(20) NOT NULL,
      merchant VARCHAR(100),
      tags TEXT[],
      receipt_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function cleanupDatabase() {
  // Drop test tables
  await pool.query(`
    DROP TABLE IF EXISTS expenses;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS users;
  `);
}

const insertTestData = async (client, userId) => {
  // Insert categories
  for (const category of TEST_DATA.categories) {
    await client.query(`
      INSERT INTO categories (name, name_normalized, icon, color, is_system, user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [category.name, category.name_normalized, category.icon, category.color, category.is_system, userId]);
  }

  // Insert exchange rates
  for (const rate of TEST_DATA.exchangeRates) {
    await client.query(`
      INSERT INTO exchange_rates (currency_pair, rate, last_updated)
      VALUES ($1, $2, NOW())
    `, [rate.currency_pair, rate.rate]);
  }

  // Insert translations
  for (const translation of TEST_DATA.translations) {
    await client.query(`
      INSERT INTO translations (key, language, value)
      VALUES ($1, $2, $3)
    `, [translation.key, translation.language, translation.value]);
  }
};

// User setup functions
async function createTestUser() {
  const user = TEST_DATA.users[0];
  const hashedPassword = await hashPassword(user.password);

  const result = await pool.query(
    `INSERT INTO users (email, password, first_name, last_name, language, timezone, currency)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, email, first_name, last_name, language, timezone, currency`,
    [user.email, hashedPassword, user.firstName, user.lastName, user.language, user.timezone, user.currency]
  );

  return result.rows[0];
}

async function createTestCategory() {
  const category = TEST_DATA.categories[0];

  const result = await pool.query(
    `INSERT INTO categories (name, icon, color, is_system)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, icon, color, is_system`,
    [category.name, category.icon, category.color, category.isSystem]
  );

  return result.rows[0];
}

async function createTestExpense(userId, categoryId) {
  const result = await pool.query(
    `INSERT INTO expenses (user_id, category_id, amount, currency, description, date, payment_method)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, categoryId, 100.00, 'USD', 'Test expense', new Date(), 'cash']
  );

  return result.rows[0];
}

function generateTestToken(userId) {
  return generateToken({ id: userId });
}

// Test expense data generator
const generateTestExpense = (userId, categoryId, amount = 100.00, currency = 'USD') => ({
  user_id: userId,
  amount: amount,
  currency: currency,
  category_id: categoryId,
  description: `Test Expense ${Date.now()}`,
  expense_date: new Date(),
  payment_method: 'credit_card'
});

// Date helper functions
const getDateRange = (days) => {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  return { startDate, endDate };
};

// Export all helpers
module.exports = {
  TEST_DATA,
  setupDatabase,
  cleanupDatabase,
  insertTestData,
  createTestUser,
  createTestCategory,
  createTestExpense,
  generateTestToken,
  generateTestExpense,
  getDateRange
}; 