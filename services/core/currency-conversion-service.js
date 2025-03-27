import { logger } from './logger-utility.js';
// src/services/currencyConverter.js
import { pool } from '../../database/db.js';
import axios from 'axios';

/**
 * Currency Conversion Service
 * Handles all currency conversions and exchange rate management
 */
export class CurrencyConverter {
  constructor(dbPool = pool) {
    this.pool = dbPool;
  }

  /**
   * Convert an amount from one currency to another
   * @param {Number} amount - Amount to convert
   * @param {String} fromCurrency - Source currency code (e.g., 'USD')
   * @param {String} toCurrency - Target currency code (e.g., 'EUR')
   * @returns {Promise<Number>} - Converted amount
   */
  async convertAmount(amount, fromCurrency, toCurrency) {
    try {
      if (fromCurrency === toCurrency) {
        return amount;
      }

      const client = await this.pool.connect();
      try {
        const result = await client.query(
          `SELECT rate FROM exchange_rates 
           WHERE from_currency = $1 AND to_currency = $2
           ORDER BY date DESC LIMIT 1`,
          [fromCurrency, toCurrency]
        );

        if (result.rows.length === 0) {
          logger.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
          return amount; // Default to original amount if no rate found
        }

        return amount * result.rows[0].rate;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error converting currency:', error);
      throw error;
    }
  }
}
