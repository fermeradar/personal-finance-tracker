const { Pool } = require('pg');
const logger = require('../utils/logger');

// Database configuration
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // Add SSL if needed
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    // Connection pool settings
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000, // How long to wait before timing out when connecting a new client
});

// Validate database connection
const validateConnection = async () => {
    try {
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        logger.info('Database connection validated successfully');
        return true;
    } catch (error) {
        logger.error('Database connection validation failed:', error);
        return false;
    }
};

// Test database connection
const testConnection = async () => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT version()');
        client.release();
        logger.info('Database connection successful:', result.rows[0]);
        return true;
    } catch (error) {
        logger.error('Database connection failed:', error);
        return false;
    }
};

// Graceful shutdown
const closePool = async () => {
    try {
        await pool.end();
        logger.info('Database pool closed successfully');
    } catch (error) {
        logger.error('Error closing database pool:', error);
    }
};

module.exports = {
    pool,
    validateConnection,
    testConnection,
    closePool
}; 