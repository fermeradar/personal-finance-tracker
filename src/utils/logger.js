const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Write to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // Write to file
        new winston.transports.File({
            filename: path.join(process.env.LOG_FILE_PATH || 'logs', 'error.log'),
            level: 'error'
        }),
        new winston.transports.File({
            filename: path.join(process.env.LOG_FILE_PATH || 'logs', 'combined.log')
        })
    ]
});

module.exports = logger; 