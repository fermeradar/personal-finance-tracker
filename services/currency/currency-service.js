const _logger = require('../core/logger-utility');
const _currencyConverter = require('../analytics/currencyConverter');

class CurrencyService {
  /**
   * Standardize amount to target currency
   * @param {Number} amount - Amount to convert
   * @param {String} sourceCurrency - Source currency
   * @param {String} targetCurrency - Target currency
   * @returns {Promise<Number>} - Converted amount
      */
    async standardizeAmount(amount, sourceCurrency, targetCurrency) {

    try {
      if (sourceCurrency === targetCurrency) {
        return amount;
      }
      
      const conversion = await _currencyConverter.convertAmount(
        amount,
        sourceCurrency,
        targetCurrency
      );
      
      return conversion.convertedAmount;
    } catch (error) {
      _logger.warn('Currency conversion error:', error);
      return amount; // Return original amount as fallback
    }
  }
}

module.exports = new CurrencyService();