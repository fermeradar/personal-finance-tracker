import dotenv from 'dotenv';
import { resolve } from 'path';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables
const envPath = resolve(process.cwd(), '.env.test');
dotenv.config({ path: envPath });

// Increase timeout for all tests
jest.setTimeout(30000);

// Log test database configuration
console.log('Test database configuration:', {
  host: process.env.DB_HOST || 'localhost',
  database: process.env.TEST_DB_NAME || 'personal_finance_test',
  user: process.env.TEST_DB_USER || 'test_user'
});