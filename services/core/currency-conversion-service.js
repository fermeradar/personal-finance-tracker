const logger = require('../core/logger-utility');
// src/services/currencyConverter.js
const { Pool } = require('pg');
const axios = require('axios');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Currency Conversion Service
 * Handles all currency conversions and exchange rate management
 */
class CurrencyConverter {
  /**
   * Convert an amount from one currency to another
   * @param {Number} amount - Amount to convert
   * @param {String} fromCurrency - Source currency code (e.g., 'USD')
   * @param {String} toCurrency - Target currency code (e.g., 'EUR')
   * @param {Date} date - Date of conversion (defaults to today)
   * @returns {Promise<Object>} - Conversion result
   */
  async convertAmount(amount, fromCurrency, toCurrency, date = new Date()) {
    try {
      // If currencies are the same, no conversion needed
      if (fromCurrency === toCurrency) {
        return {
          originalAmount: amount,
          originalCurrency: fromCurrency,
          convertedAmount: amount,
          convertedCurrency: toCurrency,
          exchangeRate: 1,
          conversionDate: date
        };
      }
      
      // Format date for query
      const formattedDate = date.toISOString().split('T')[0];
      
      // Get exchange rate for the specified date
      const rateResult = await pool.query(`
        SELECT rate 
        FROM currency_exchange_rates
        WHERE from_currency = $1 AND to_currency = $2
        AND effective_date <= $3
        ORDER BY effective_date DESC
        LIMIT 1
      `, [fromCurrency, toCurrency, formattedDate]);
      
      let rate = null;
      
      // If direct conversion is available
      if (rateResult.rows.length > 0) {
        rate = rateResult.rows[0].rate;
      } else {
        // Try reverse rate
        const reverseRateResult = await pool.query(`
          SELECT rate 
          FROM currency_exchange_rates
          WHERE from_currency = $1 AND to_currency = $2
          AND effective_date <= $3
          ORDER BY effective_date DESC
          LIMIT 1
        `, [toCurrency, fromCurrency, formattedDate]);
        
        if (reverseRateResult.rows.length > 0) {
          rate = 1 / reverseRateResult.rows[0].rate;
        } else {
          // Try conversion through base currency (EUR)
          const toBaseResult = await pool.query(`
            SELECT rate 
            FROM currency_exchange_rates
            WHERE from_currency = $1 AND to_currency = 'EUR'
            AND effective_date <= $2
            ORDER BY effective_date DESC
            LIMIT 1
          `, [fromCurrency, formattedDate]);
          
          const fromBaseResult = await pool.query(`
            SELECT rate 
            FROM currency_exchange_rates
            WHERE from_currency = 'EUR' AND to_currency = $1
            AND effective_date <= $2
            ORDER BY effective_date DESC
            LIMIT 1
          `, [toCurrency, formattedDate]);
          
          if (toBaseResult.rows.length > 0 && fromBaseResult.rows.length > 0) {
            const toBaseRate = toBaseResult.rows[0].rate;
            const fromBaseRate = fromBaseResult.rows[0].rate;
            rate = toBaseRate * fromBaseRate;
          } else {
            // If we still don't have a rate, try to fetch it
            const fetchedRate = await this.fetchExchangeRate(fromCurrency, toCurrency, date);
            
            if (fetchedRate) {
              rate = fetchedRate;
            } else {
              throw new Error(`Could not find or fetch exchange rate for ${fromCurrency} to ${toCurrency}`);
            }
          }
        }
      }
      
      // Convert the amount
      const convertedAmount = amount * rate;
      
      return {
        originalAmount: amount,
        originalCurrency: fromCurrency,
        convertedAmount: convertedAmount,
        convertedCurrency: toCurrency,
        exchangeRate: rate,
        conversionDate: date
      };
    } catch (error) {
      logger.error('Error converting currency:', error);
      throw error;
    }
  }
  
  /**
   * Fetch current exchange rate from external service
   * @param {String} fromCurrency - Source currency code
   * @param {String} toCurrency - Target currency code
   * @param {Date} date - Date for the rate (defaults to today)
   * @returns {Promise<Number|null>} - Exchange rate or null if not available
   */
  async fetchExchangeRate(fromCurrency, toCurrency, date = new Date()) {
    try {
      // Format date for API request
      const formattedDate = date.toISOString().split('T')[0];
      
      // Check if we should use an API or a static rate
      if (process.env.USE_EXCHANGE_RATE_API === 'true' && process.env.EXCHANGE_RATE_API_KEY) {
        // Use an external API (example with exchangerate-api.com)
        const response = await axios.get(
          `https://api.exchangerate-api.com/v4/historical/${formattedDate}`,
          {
            params: {
              base: fromCurrency,
              apikey: process.env.EXCHANGE_RATE_API_KEY
            }
          }
        );
        
        if (response.data && response.data.rates && response.data.rates[toCurrency]) {
          const rate = response.data.rates[toCurrency];
          
          // Store the fetched rate for future use
          await this.storeExchangeRate(fromCurrency, toCurrency, rate, date, 'api');
          
          return rate;
        }
      }
      
      // Fallback to a static conversion table for common currencies
      // This is useful for testing or when API is not available
      const staticRates = {
        'EUR': { 'USD': 1.08, 'GBP': 0.86, 'JPY': 158.20, 'CHF': 0.96, 'CAD': 1.47, 'RUB': 99.50 },
        'USD': { 'EUR': 0.93, 'GBP': 0.79, 'JPY': 146.78, 'CHF': 0.89, 'CAD': 1.36, 'RUB': 92.30 },
        'GBP': { 'EUR': 1.16, 'USD': 1.27, 'JPY': 186.58, 'CHF': 1.13, 'CAD': 1.73, 'RUB': 117.39 }
      };
      
      if (staticRates[fromCurrency] && staticRates[fromCurrency][toCurrency]) {
        const rate = staticRates[fromCurrency][toCurrency];
        
        // Store the static rate
        await this.storeExchangeRate(fromCurrency, toCurrency, rate, date, 'static');
        
        return rate;
      }
      
      if (staticRates[toCurrency] && staticRates[toCurrency][fromCurrency]) {
        const rate = 1 / staticRates[toCurrency][fromCurrency];
        
        // Store the static rate
        await this.storeExchangeRate(fromCurrency, toCurrency, rate, date, 'static');
        
        return rate;
      }
      
      return null;
    } catch (error) {
      logger.error('Error fetching exchange rate:', error);
      return null;
    }
  }
  
  /**
   * Store an exchange rate in the database
   * @param {String} fromCurrency - Source currency code
   * @param {String} toCurrency - Target currency code
   * @param {Number} rate - Exchange rate value
   * @param {Date} date - Effective date for the rate
   * @param {String} source - Source of the rate data
   * @returns {Promise<Boolean>} - Success flag
   */
  async storeExchangeRate(fromCurrency, toCurrency, rate, date, source = 'manual') {
    try {
      const formattedDate = date.toISOString().split('T')[0];
      
      await pool.query(`
        INSERT INTO currency_exchange_rates(
          from_currency, to_currency, rate, effective_date, source, updated_at
        )
        VALUES($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (from_currency, to_currency, effective_date)
        DO UPDATE SET
          rate = $3,
          source = $5,
          updated_at = NOW()
      `, [fromCurrency, toCurrency, rate, formattedDate, source]);
      
      return true;
    } catch (error) {
      logger.error('Error storing exchange rate:', error);
      return false;
    }
  }
  
  /**
   * Get default currency for a region
   * @param {String} entityType - Type of entity ('global', 'region', 'country')
   * @param {String} entityValue - Value of entity (e.g., country code)
   * @returns {Promise<String>} - Default currency code
   */
  async getDefaultCurrency(entityType = 'global', entityValue = 'default') {
    try {
      // Try to get specific default first
      const specificResult = await pool.query(`
        SELECT currency_code
        FROM default_currencies
        WHERE entity_type = $1 AND entity_value = $2
        ORDER BY effective_date DESC
        LIMIT 1
      `, [entityType, entityValue]);
      
      if (specificResult.rows.length > 0) {
        return specificResult.rows[0].currency_code;
      }
      
      // Fall back to global default
      const globalResult = await pool.query(`
        SELECT currency_code
        FROM default_currencies
        WHERE entity_type = 'global' AND entity_value = 'default'
        ORDER BY effective_date DESC
        LIMIT 1
      `);
      
      if (globalResult.rows.length > 0) {
        return globalResult.rows[0].currency_code;
      }
      
      // If no defaults found, return EUR as ultimate fallback
      return 'EUR';
    } catch (error) {
      logger.error('Error getting default currency:', error);
      return 'EUR'; // Default fallback
    }
  }
  
  /**
   * Set default currency for a region
   * @param {String} entityType - Type of entity ('global', 'region', 'country')
   * @param {String} entityValue - Value of entity (e.g., country code)
   * @param {String} currencyCode - Currency code to set as default
   * @returns {Promise<Boolean>} - Success flag
   */
  async setDefaultCurrency(entityType, entityValue, currencyCode) {
    try {
      await pool.query(`
        INSERT INTO default_currencies(
          entity_type, entity_value, currency_code, effective_date, created_at
        )
        VALUES($1, $2, $3, NOW(), NOW())
        ON CONFLICT (entity_type, entity_value)
        DO UPDATE SET
          currency_code = $3,
          effective_date = NOW()
      `, [entityType, entityValue, currencyCode]);
      
      return true;
    } catch (error) {
      logger.error('Error setting default currency:', error);
      return false;
    }
  }
  
  /**
   * Get user's preferred currency
   * @param {String} userId - User ID
   * @returns {Promise<String>} - Preferred currency code
   */
  async getUserCurrency(userId) {
    try {
      const result = await pool.query(
        'SELECT currency FROM users WHERE user_id = $1',
        [userId]
      );
      
      if (result.rows.length > 0 && result.rows[0].currency) {
        return result.rows[0].currency;
      }
      
      // If user has no preference, get default based on their region
      const regionResult = await pool.query(
        'SELECT region FROM users WHERE user_id = $1',
        [userId]
      );
      
      if (regionResult.rows.length > 0 && regionResult.rows[0].region) {
        return this.getDefaultCurrency('region', regionResult.rows[0].region);
      }
      
      // Fall back to global default
      return this.getDefaultCurrency();
    } catch (error) {
      logger.error('Error getting user currency:', error);
      return 'EUR'; // Default fallback
    }
  }
  
  /**
   * Standardize amounts across different currencies for comparison
   * @param {Array} items - Array of items with amounts in different currencies
   * @param {String} targetCurrency - Currency to standardize to
   * @returns {Promise<Array>} - Items with standardized amounts
   */
  async standardizeAmounts(items, targetCurrency) {
    try {
      const standardizedItems = [];
      
      for (const item of items) {
        const originalCurrency = item.currency || 'EUR';
        
        if (originalCurrency === targetCurrency) {
          // Already in target currency
          standardizedItems.push({
            ...item,
            standardized_amount: item.amount,
            standardized_currency: targetCurrency
          });
        } else {
          // Need conversion
          const conversion = await this.convertAmount(
            item.amount,
            originalCurrency,
            targetCurrency,
            item.date || new Date()
          );
          
          standardizedItems.push({
            ...item,
            standardized_amount: conversion.convertedAmount,
            standardized_currency: targetCurrency,
            exchange_rate: conversion.exchangeRate
          });
        }
      }
      
      return standardizedItems;
    } catch (error) {
      logger.error('Error standardizing amounts:', error);
      
      // Return original items with null standardization if error
      return items.map(item => ({
        ...item,
        standardized_amount: null,
        standardized_currency: targetCurrency,
        conversion_error: true
      }));
    }
  }
}

module.exports = new CurrencyConverter();
