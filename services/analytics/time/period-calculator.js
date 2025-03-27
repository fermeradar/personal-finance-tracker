const _moment = require('moment');

class PeriodCalculator {
  /**
   * Get time period dates and label
   * @param {String} timeframe - Timeframe specifier
   * @returns {Object} - Start and end dates with label
   */
  getTimePeriod(timeframe) {
    const now = new Date();
    let endDate = new Date();
    let startDate = new Date();
    let intervalLabel = '';
    
    switch (timeframe) {
      case 'week': {
        startDate = _moment().subtract(1, 'week').startOf('day');
        endDate = _moment().endOf('day');
        intervalLabel = 'Last week';
        break;
      }
      case 'month': {
        startDate = _moment().subtract(1, 'month').startOf('day');
        endDate = _moment().endOf('day');
        intervalLabel = `${startDate.toLocaleString('default', { month: 'long' })} ${startDate.getFullYear()}`;
        break;
      }
      case 'year': {
        startDate = _moment().subtract(1, 'year').startOf('day');
        endDate = _moment().endOf('day');
        intervalLabel = startDate.getFullYear().toString();
        break;
      }
      case 'last_month': {
        // Previous month
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
        intervalLabel = `${startDate.toLocaleString('default', { month: 'long' })} ${startDate.getFullYear()}`;
        break;
      }
      case 'last_quarter': {
        // Previous quarter
        const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
        const quarterYear = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter;
        startDate = new Date(quarterYear, adjustedQuarter * 3, 1);
        endDate = new Date(quarterYear, (adjustedQuarter + 1) * 3, 0);
        intervalLabel = `Q${adjustedQuarter + 1} ${quarterYear}`;
        break;
      }
      case 'last_year': {
        // Previous year
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
        intervalLabel = startDate.getFullYear().toString();
        break;
      }
      default:
        // Default to last 30 days
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        intervalLabel = 'Last 30 days';
    }
    
    return { startDate, endDate, intervalLabel };
  }
}

module.exports = new PeriodCalculator();
