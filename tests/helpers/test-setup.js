import { pool } from '../../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '../../src/utils/auth.js';
import { generateToken } from '../../src/utils/jwt.js';
import UserManager from '../../services/core/user-manager.js';
import logger from '../../src/utils/logger.js';
import { setupTestDatabase, cleanupTestDatabase } from './db-helper.js';

const userManager = new UserManager(pool);

export const TEST_DATA = {
  validUser: {
    email: 'test@example.com',
    password: 'test123',
    firstName: 'Test',
    lastName: 'User'
  },
  validCategory: {
    name: 'Test Category'
  },
  validExpense: {
    amount: 100,
    currency: 'USD',
    description: 'Test Expense'
  },
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

export async function setupDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM expenses');
    await client.query('DELETE FROM categories');
    await client.query('DELETE FROM users');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function cleanupDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM expenses');
    await client.query('DELETE FROM categories');
    await client.query('DELETE FROM users');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createTestUser(overrides = {}) {
  const userData = { ...TEST_DATA.validUser, ...overrides };
  const userId = uuidv4();
  const hashedPassword = await hashPassword(userData.password);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO users (
        user_id, email, password, first_name, last_name
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [userId, userData.email, hashedPassword, userData.firstName, userData.lastName]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function createTestCategory(client) {
  const category = TEST_DATA.categories[0];

  const result = await client.query(
    `INSERT INTO categories (name, icon, color, is_system)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, icon, color, is_system`,
    [category.name, category.icon, category.color, category.isSystem]
  );

  return result.rows[0];
}

export async function createTestExpense(client, userId, categoryId) {
  const result = await client.query(
    `INSERT INTO expenses (user_id, category_id, amount, currency, description, date, payment_method)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, categoryId, 100.00, 'USD', 'Test expense', new Date(), 'cash']
  );

  return result.rows[0];
}

export async function createTestToken(user) {
  return generateToken(user);
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
export default {
  TEST_DATA,
  setupDatabase,
  cleanupDatabase,
  createTestUser,
  createTestCategory,
  createTestExpense,
  createTestToken,
  generateTestExpense,
  getDateRange,
  userManager,
  setupTestDatabase,
  cleanupTestDatabase
};

const TEST_USER = {
  userId: 'test_user',
  email: 'test@example.com',
  password: 'testpass123',
  firstName: 'Test',
  language: 'en',
  timezone: 'UTC',
  currency: 'USD'
};

let client;

beforeAll(async () => {
  await setupTestDatabase();
});

beforeEach(async () => {
  client = await pool.connect();
});

afterEach(async () => {
  if (client) {
    await cleanupTestDatabase(client);
    await client.release();
  }
});

afterAll(async () => {
  await pool.end();
}); 