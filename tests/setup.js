// Load test configuration
process.env.NODE_ENV = 'test';
const config = require('../config/test/config');

// Mock environment variables
process.env.DATABASE_URL = config.database.url;
process.env.BOT_TOKEN = config.bot.token;
process.env.OCR_API_KEY = config.ocr.apiKey;

// Global test timeout
jest.setTimeout(10000);

// Global beforeAll hook
beforeAll(async () => {
  // Add any global setup here
  // For example, database connection, test data setup, etc.
});

// Global afterAll hook
afterAll(async () => {
  // Add any global cleanup here
  // For example, closing database connections, cleaning up test data, etc.
}); 