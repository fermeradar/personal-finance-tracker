import pg from 'pg';
import { config } from '../config/test.js';

const { Pool } = pg;

// Create a single pool instance
const pool = new Pool(config.database);

// Export the pool
export { pool };

