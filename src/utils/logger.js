import winston from 'winston';
import { config } from '../config/config.js';

const { format, createLogger, transports } = winston;
const { combine, timestamp, printf, colorize, json } = format;

const customFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

const logger = createLogger({
  level: config.logging.level,
  format: config.logging.format === 'json'
    ? combine(timestamp(), json())
    : combine(
        colorize(),
        timestamp(),
        customFormat
      ),
  transports: [
    new transports.Console({
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
});

export { logger }; 