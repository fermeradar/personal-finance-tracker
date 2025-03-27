import pg from 'pg';
import { hashPassword } from '../../src/utils/auth.js';
import { v4 as uuidv4 } from 'uuid';

const { Pool } = pg;

// First connect as superuser
const superuserPool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'personal_finance_test',
  user: 'd',  // Connect as superuser
  password: '' // Your superuser password if any
});

// Pool for test_user
const testUserPool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'personal_finance_test',
  user: 'test_user',
  password: 'test_password'
});

async function initializeTestDatabase() {
  console.log('Initializing test database...');
  const superuserClient = await superuserPool.connect();

  try {
    // Drop and recreate schema
    await superuserClient.query('DROP SCHEMA IF EXISTS public CASCADE');
    await superuserClient.query('CREATE SCHEMA public');
    console.log('Schema reset successfully');

    // Create tables with consistent UUID types
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        preferred_currency VARCHAR(3) DEFAULT 'USD',
        preferred_language VARCHAR(5) DEFAULT 'en',
        currency CHAR(3),
        language CHAR(2)
      );

      CREATE TABLE IF NOT EXISTS categories (
        category_id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        name VARCHAR(100) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS expenses (
        expense_id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        category_id UUID NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        description TEXT,
        date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS document_extractions (
        extraction_id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        extracted_data JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS exchange_rates (
        rate_id UUID PRIMARY KEY,
        from_currency VARCHAR(3) NOT NULL,
        to_currency VARCHAR(3) NOT NULL,
        rate DECIMAL(10,6) NOT NULL,
        date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_currency, to_currency, date)
      );

      CREATE TABLE IF NOT EXISTS translations (
        translation_id UUID PRIMARY KEY,
        language_code VARCHAR(5) NOT NULL,
        key VARCHAR(255) NOT NULL,
        value TEXT NOT NULL,
        UNIQUE(language_code, key)
      );

      CREATE TABLE IF NOT EXISTS user_settings_history (
        history_id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(user_id),
        previous_currency VARCHAR(3),
        new_currency VARCHAR(3),
        previous_language VARCHAR(5),
        new_language VARCHAR(5),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await superuserClient.query(createTablesQuery);
    console.log('Tables created successfully');

    // Create indexes
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
      CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
      CREATE INDEX IF NOT EXISTS idx_document_extractions_user_id ON document_extractions(user_id);
      CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
      CREATE INDEX IF NOT EXISTS idx_translations_language ON translations(language_code);
    `;

    await superuserClient.query(createIndexesQuery);
    console.log('Indexes created successfully');

    // Grant privileges to test_user
    await superuserClient.query(`
      GRANT ALL PRIVILEGES ON SCHEMA public TO test_user;
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO test_user;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO test_user;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO test_user;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO test_user;
    `);
    console.log('Privileges granted successfully');

    // Create test user if it doesn't exist
    const testUserId = uuidv4();
    const hashedPassword = await hashPassword('test_password');
    
    await superuserClient.query(`
      INSERT INTO users (user_id, email, password, first_name, last_name)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
    `, [testUserId, 'test@example.com', hashedPassword, 'Test', 'User']);
    
    console.log('Test user checked/created');

  } catch (error) {
    console.error('Error initializing test database:', error);
    throw new Error('Failed to initialize database: ' + error);
  } finally {
    superuserClient.release();
    await superuserPool.end();
    await testUserPool.end();
  }
}

initializeTestDatabase();