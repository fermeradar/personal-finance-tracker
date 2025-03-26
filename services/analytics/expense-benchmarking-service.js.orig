// src/services/expenseBenchmarkService.js
const { Pool } = require('pg');
const currencyConverter = require('./currencyConverter');
const locationIntelligence = require('./locationIntelligence');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Expense Benchmarking Service
 * Provides comparative analysis of user expenses against similar users
 */
class ExpenseBenchmarkService {
  /**
   * Generate spending benchmarks for a user
   * @param {String} userId - User ID
   * @param {String} timeframe - Time period ('month', 'quarter', 'year')
   * @param {String} currency - Currency for standardization
   * @returns {Promise<Object>} - Benchmark results
   */
  async generateUserBenchmark(userId, timeframe = 'month', currency = 'EUR') {
    try {
      // Get user's profile information
      const userResult = await pool.query(
        'SELECT * FROM users WHERE user_id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = userResult.rows[0];
      
      // Get user's location
      const locationResult = await pool.query(`
        SELECT l.* 
        FROM user_locations l
        WHERE l.user_id = $1 AND l.is_primary = true
      `, [userId]);
      
      const locationData = locationResult.rows.length > 0 ? locationResult.rows[0] : null;
      
      // Generate time period constraints
      const { startDate, endDate, intervalLabel } = this.getTimePeriod(timeframe);
      
      // Get user's expenses for the period
      const userExpenses = await this.getUserExpensesForPeriod(userId, startDate, endDate, currency);
      
      // Get benchmark data
      const benchmarks = await this.getBenchmarkData(
        locationData,
        startDate,
        endDate,
        currency
      );
      
      // Calculate user's statistics
      const userStats = this.calculateUserStatistics(userExpenses);
      
      // Compare with benchmarks
      const comparisons = this.compareWithBenchmarks(userStats, benchmarks);
      
      return {
        user: {
          id: userId,
          displayName: user.first_name,
          location: locationData ? `${locationData.city}, ${locationData.country}` : 'Unknown'
        },
        timeframe: {
          period: timeframe,
          label: intervalLabel,
          startDate,
          endDate
        },
        currency,
        userStatistics: userStats,
        benchmarks,
        comparisons,
        insights: this.generateInsights(userStats, benchmarks, comparisons)
      };
    } catch (error) {
      console.error('Error generating user benchmark:', error);
      throw error;
    }
  }
  
  /**
   * Get time period dates and label
   * @param {String} timeframe - Timeframe specifier
   * @returns {Object} - Start and end dates with label
   */
  getTimePeriod(timeframe) {
    const now = new Date();
    const endDate = new Date();
    let startDate = new Date();
    let intervalLabel = '';
    
    switch (timeframe) {
      case 'month':
        // Current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        intervalLabel = `${startDate.toLocaleString('default', { month: 'long' })} ${startDate.getFullYear()}`;
        break;
        
      case 'quarter':
        // Current quarter
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        intervalLabel = `Q${quarter + 1} ${startDate.getFullYear()}`;
        break;
        
      case 'year':
        // Current year
        startDate = new Date(now.getFullYear(), 0, 1);
        intervalLabel = startDate.getFullYear().toString();
        break;
        
      case 'last_month':
        // Previous month
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
        intervalLabel = `${startDate.toLocaleString('default', { month: 'long' })} ${startDate.getFullYear()}`;
        break;
        
      case 'last_quarter':
        // Previous quarter
        const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
        const quarterYear = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter;
        startDate = new Date(quarterYear, adjustedQuarter * 3, 1);
        endDate = new Date(quarterYear, (adjustedQuarter + 1) * 3, 0);
        intervalLabel = `Q${adjustedQuarter + 1} ${quarterYear}`;
        break;
        
      case 'last_year':
        // Previous year
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
        intervalLabel = startDate.getFullYear().toString();
        break;
        
      default:
        // Default to last 30 days
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        intervalLabel = 'Last 30 days';
    }
    
    return { startDate, endDate, intervalLabel };
  }
  
  /**
   * Get user's expenses for the specified period
   * @param {String} userId - User ID
   * @param {Date} startDate - Period start date
   * @param {Date} endDate - Period end date
   * @param {String} targetCurrency - Currency to standardize to
   * @returns {Promise<Array>} - User expenses
   */
  async getUserExpensesForPeriod(userId, startDate, endDate, targetCurrency) {
    try {
      // Get expenses
      const expensesResult = await pool.query(`
        SELECT 
          e.expense_id,
          e.amount,
          e.currency,
          e.expense_date,
          e.category_id,
          c.name as category_name,
          e.merchant_name,
          e.data_source,
          COALESCE(e.converted_amount, e.amount) as normalized_amount,
          COALESCE(e.converted_currency, e.currency) as normalized_currency
        FROM expenses e
        LEFT JOIN categories c ON e.category_id = c.category_id
        WHERE e.user_id = $1
          AND e.expense_date >= $2
          AND e.expense_date <= $3
        ORDER BY e.expense_date DESC
      `, [userId, startDate, endDate]);
      
      // Standardize currencies where needed
      const expenses = expensesResult.rows;
      const standardizedExpenses = [];
      
      for (const expense of expenses) {
        let standardizedAmount = expense.amount;
        let sourceCurrency = expense.currency;
        
        // Use already converted amount if available and matches target currency
        if (expense.normalized_currency === targetCurrency) {
          standardizedAmount = expense.normalized_amount;
        } 
        // Otherwise convert if needed
        else if (sourceCurrency !== targetCurrency) {
          try {
            const conversionResult = await currencyConverter.convertAmount(
              expense.amount,
              sourceCurrency,
              targetCurrency,
              expense.expense_date
            );
            
            standardizedAmount = conversionResult.convertedAmount;
          } catch (conversionError) {
            console.warn('Currency conversion error:', conversionError);
            // Continue with original amount as fallback
          }
        }
        
        standardizedExpenses.push({
          ...expense,
          standardized_amount: standardizedAmount,
          standardized_currency: targetCurrency
        });
      }
      
      return standardizedExpenses;
    } catch (error) {
      console.error('Error fetching user expenses:', error);
      throw error;
    }
  }
  
  /**
   * Get benchmark data for comparison
   * @param {Object} locationData - User's location data
   * @param {Date} startDate - Period start date
   * @param {Date} endDate - Period end date
   * @param {String} currency - Currency for standardization
   * @returns {Promise<Object>} - Benchmark data
   */
  async getBenchmarkData(locationData, startDate, endDate, currency) {
    try {
      // Base query for benchmarks
      let query = `
        WITH period_expenses AS (
          SELECT 
            e.user_id,
            e.amount,
            e.currency,
            e.expense_date,
            e.category_id,
            c.name as category_name,
            u.household_id,
            CASE
              WHEN ul.city IS NOT NULL THEN ul.city
              ELSE 'unknown'
            END as user_city,
            CASE
              WHEN ul.country IS NOT NULL THEN ul.country
              ELSE 'unknown'
            END as user_country
          FROM expenses e
          JOIN users u ON e.user_id = u.user_id
          LEFT JOIN categories c ON e.category_id = c.category_id
          LEFT JOIN user_locations ul ON u.user_id = ul.user_id AND ul.is_primary = true
          WHERE e.expense_date >= $1
            AND e.expense_date <= $2
        ),
        user_totals AS (
          SELECT
            user_id,
            user_city,
            user_country,
            SUM(amount) as total_spent,
            COUNT(*) as transaction_count
          FROM period_expenses
          GROUP BY user_id, user_city, user_country
        ),
        category_totals AS (
          SELECT
            user_id,
            category_id,
            category_name,
            user_city,
            user_country,
            SUM(amount) as category_spent,
            COUNT(*) as category_transactions
          FROM period_expenses
          GROUP BY user_id, category_id, category_name, user_city, user_country
        )
      `;
      
      const params = [startDate, endDate];
      let paramIndex = 3;
      
      // Different benchmark queries depending on location data
      if (locationData && locationData.city && locationData.country) {
        // Local benchmark (same city)
        query += `
          SELECT
            'local' as benchmark_type,
            ut.user_city as location,
            COUNT(DISTINCT ut.user_id) as user_count,
            AVG(ut.total_spent) as avg_total_spent,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ut.total_spent) as median_total_spent,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ut.total_spent) as p25_total_spent,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ut.total_spent) as p75_total_spent,
            AVG(ut.transaction_count) as avg_transaction_count,
            category_name,
            AVG(ct.category_spent) as avg_category_spent,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.category_spent) as median_category_spent
          FROM user_totals ut
          JOIN category_totals ct ON ut.user_id = ct.user_id
          WHERE ut.user_city = ${paramIndex} AND ut.user_country = ${paramIndex + 1}
          GROUP BY ut.user_city, category_name
          
          UNION ALL
          
          SELECT
            'country' as benchmark_type,
            ut.user_country as location,
            COUNT(DISTINCT ut.user_id) as user_count,
            AVG(ut.total_spent) as avg_total_spent,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ut.total_spent) as median_total_spent,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ut.total_spent) as p25_total_spent,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ut.total_spent) as p75_total_spent,
            AVG(ut.transaction_count) as avg_transaction_count,
            category_name,
            AVG(ct.category_spent) as avg_category_spent,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.category_spent) as median_category_spent
          FROM user_totals ut
          JOIN category_totals ct ON ut.user_id = ct.user_id
          WHERE ut.user_country = ${paramIndex + 1}
          GROUP BY ut.user_country, category_name
          
          UNION ALL
          
          SELECT
            'global' as benchmark_type,
            'global' as location,
            COUNT(DISTINCT ut.user_id) as user_count,
            AVG(ut.total_spent) as avg_total_spent,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ut.total_spent) as median_total_spent,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ut.total_spent) as p25_total_spent,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ut.total_spent) as p75_total_spent,
            AVG(ut.transaction_count) as avg_transaction_count,
            category_name,
            AVG(ct.category_spent) as avg_category_spent,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.category_spent) as median_category_spent
          FROM user_totals ut
          JOIN category_totals ct ON ut.user_id = ct.user_id
          GROUP BY category_name
        `;
        
        params.push(locationData.city);
        params.push(locationData.country);
      } else if (locationData && locationData.country) {
        // Country and global benchmarks only
        query += `
          SELECT
            'country' as benchmark_type,
            ut.user_country as location,
            COUNT(DISTINCT ut.user_id) as user_count,
            AVG(ut.total_spent) as avg_total_spent,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ut.total_spent) as median_total_spent,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ut.total_spent) as p25_total_spent,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ut.total_spent) as p75_total_spent,
            AVG(ut.transaction_count) as avg_transaction_count,
            category_name,
            AVG(ct.category_spent) as avg_category_spent,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.category_spent) as median_category_spent
          FROM user_totals ut
          JOIN category_totals ct ON ut.user_id = ct.user_id
          WHERE ut.user_country = ${paramIndex}
          GROUP BY ut.user_country, category_name
          
          UNION ALL
          
          SELECT
            'global' as benchmark_type,
            'global' as location,
            COUNT(DISTINCT ut.user_id) as user_count,
            AVG(ut.total_spent) as avg_total_spent,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ut.total_spent) as median_total_spent,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ut.total_spent) as p25_total_spent,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ut.total_spent) as p75_total_spent,
            AVG(ut.transaction_count) as avg_transaction_count,
            category_name,
            AVG(ct.category_spent) as avg_category_spent,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.category_spent) as median_category_spent
          FROM user_totals ut
          JOIN category_totals ct ON ut.user_id = ct.user_id
          GROUP BY category_name
        `;
        
        params.push(locationData.country);
      } else {
        // Global benchmark only
        query += `
          SELECT
            'global' as benchmark_type,
            'global' as location,
            COUNT(DISTINCT ut.user_id) as user_count,
            AVG(ut.total_spent) as avg_total_spent,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ut.total_spent) as median_total_spent,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ut.total_spent) as p25_total_spent,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ut.total_spent) as p75_total_spent,
            AVG(ut.transaction_count) as avg_transaction_count,
            category_name,
            AVG(ct.category_spent) as avg_category_spent,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.category_spent) as median_category_spent
          FROM user_totals ut
          JOIN category_totals ct ON ut.user_id = ct.user_id
          GROUP BY category_name
        `;
      }
      
      // Execute the query
      const benchmarkResult = await pool.query(query, params);
      
      // Process and standardize currencies
      const rawBenchmarks = benchmarkResult.rows;
      const processedBenchmarks = {};
      
      // Group by benchmark type and organize data
      for (const row of rawBenchmarks) {
        const type = row.benchmark_type;
        
        if (!processedBenchmarks[type]) {
          processedBenchmarks[type] = {
            location: row.location,
            user_count: parseInt(row.user_count),
            total: {
              avg_spent: parseFloat(row.avg_total_spent),
              median_spent: parseFloat(row.median_total_spent),
              p25_spent: parseFloat(row.p25_total_spent),
              p75_spent: parseFloat(row.p75_total_spent),
              avg_transaction_count: parseFloat(row.avg_transaction_count)
            },
            categories: {}
          };
        }
        
        // Add category data
        if (row.category_name) {
          processedBenchmarks[type].categories[row.category_name] = {
            avg_spent: parseFloat(row.avg_category_spent),
            median_spent: parseFloat(row.median_category_spent)
          };
        }
      }
      
      // Convert all benchmark amounts to target currency
      for (const [benchmarkType, data] of Object.entries(processedBenchmarks)) {
        // Convert total amounts
        data.total.avg_spent_standard = await this.standardizeAmount(
          data.total.avg_spent, 
          'EUR', // Assume benchmarks are stored in EUR
          currency
        );
        
        data.total.median_spent_standard = await this.standardizeAmount(
          data.total.median_spent,
          'EUR',
          currency
        );
        
        data.total.p25_spent_standard = await this.standardizeAmount(
          data.total.p25_spent,
          'EUR',
          currency
        );
        
        data.total.p75_spent_standard = await this.standardizeAmount(
          data.total.p75_spent,
          'EUR',
          currency
        );
        
        // Convert category amounts
        for (const [category, amounts] of Object.entries(data.categories)) {
          data.categories[category].avg_spent_standard = await this.standardizeAmount(
            amounts.avg_spent,
            'EUR',
            currency
          );
          
          data.categories[category].median_spent_standard = await this.standardizeAmount(
            amounts.median_spent,
            'EUR',
            currency
          );
        }
      }
      
      return processedBenchmarks;
    } catch (error) {
      console.error('Error fetching benchmark data:', error);
      throw error;
    }
  }
  
  /**
   * Calculate user's spending statistics
   * @param {Array} expenses - User's expenses for the period
   * @returns {Object} - Calculated statistics
   */
  calculateUserStatistics(expenses) {
    // Total spending
    const totalSpent = expenses.reduce(
      (sum, expense) => sum + expense.standardized_amount, 
      0
    );
    
    // Count transactions
    const transactionCount = expenses.length;
    
    // Group by category
    const categoriesMap = {};
    
    for (const expense of expenses) {
      const categoryName = expense.category_name || 'Uncategorized';
      
      if (!categoriesMap[categoryName]) {
        categoriesMap[categoryName] = {
          total: 0,
          count: 0,
          expenses: []
        };
      }
      
      categoriesMap[categoryName].total += expense.standardized_amount;
      categoriesMap[categoryName].count += 1;
      categoriesMap[categoryName].expenses.push(expense);
    }
    
    // Calculate category percentages
    const categories = {};
    
    for (const [category, data] of Object.entries(categoriesMap)) {
      categories[category] = {
        total: data.total,
        count: data.count,
        percentage: totalSpent > 0 ? (data.total / totalSpent) * 100 : 0
      };
    }
    
    // Calculate average and largest expense
    const avgExpense = transactionCount > 0 ? totalSpent / transactionCount : 0;
    const largestExpense = expenses.length > 0
      ? Math.max(...expenses.map(e => e.standardized_amount))
      : 0;
    
    // Weekly and daily averages
    const daysDiff = expenses.length > 0 
      ? (new Date(expenses[0].expense_date) - new Date(expenses[expenses.length - 1].expense_date)) / (1000 * 60 * 60 * 24) + 1
      : 30;
    
    const dailyAvg = totalSpent / Math.max(daysDiff, 1);
    const weeklyAvg = dailyAvg * 7;
    
    return {
      total: totalSpent,
      transaction_count: transactionCount,
      avg_expense: avgExpense,
      largest_expense: largestExpense,
      daily_avg: dailyAvg,
      weekly_avg: weeklyAvg,
      days_in_period: Math.max(Math.round(daysDiff), 1),
      categories
    };
  }
  
  /**
   * Compare user statistics with benchmarks
   * @param {Object} userStats - User statistics
   * @param {Object} benchmarks - Benchmark data
   * @returns {Object} - Comparison results
   */
  compareWithBenchmarks(userStats, benchmarks) {
    const comparisons = {};
    
    // Compare with each benchmark type
    for (const [benchmarkType, data] of Object.entries(benchmarks)) {
      comparisons[benchmarkType] = {
        total_spent: {
          vs_avg: userStats.total - data.total.avg_spent_standard,
          vs_avg_percent: data.total.avg_spent_standard > 0 
            ? ((userStats.total / data.total.avg_spent_standard) - 1) * 100 
            : 0,
          vs_median: userStats.total - data.total.median_spent_standard,
          vs_median_percent: data.total.median_spent_standard > 0 
            ? ((userStats.total / data.total.median_spent_standard) - 1) * 100 
            : 0,
          percentile: this.calculatePercentile(
            userStats.total,
            data.total.p25_spent_standard,
            data.total.median_spent_standard,
            data.total.p75_spent_standard
          )
        },
        transaction_count: {
          vs_avg: userStats.transaction_count - data.total.avg_transaction_count,
          vs_avg_percent: data.total.avg_transaction_count > 0 
            ? ((userStats.transaction_count / data.total.avg_transaction_count) - 1) * 100 
            : 0
        },
        categories: {}
      };
      
      // Compare categories
      for (const [category, userCatStats] of Object.entries(userStats.categories)) {
        const benchmarkCatData = data.categories[category];
        
        if (benchmarkCatData) {
          comparisons[benchmarkType].categories[category] = {
            vs_avg: userCatStats.total - benchmarkCatData.avg_spent_standard,
            vs_avg_percent: benchmarkCatData.avg_spent_standard > 0 
              ? ((userCatStats.total / benchmarkCatData.avg_spent_standard) - 1) * 100 
              : 0,
            vs_median: userCatStats.total - benchmarkCatData.median_spent_standard,
            vs_median_percent: benchmarkCatData.median_spent_standard > 0 
              ? ((userCatStats.total / benchmarkCatData.median_spent_standard) - 1) * 100 
              : 0
          };
        } else {
          // Category not in benchmark
          comparisons[benchmarkType].categories[category] = {
            vs_avg: null,
            vs_avg_percent: null,
            vs_median: null,
            vs_median_percent: null,
            no_benchmark_data: true
          };
        }
      }
    }
    
    return comparisons;
  }
  
  /**
   * Calculate approximate percentile based on quartiles
   * @param {Number} value - Value to find percentile for
   * @param {Number} p25 - 25th percentile value
   * @param {Number} p50 - 50th percentile value (median)
   * @param {Number} p75 - 75th percentile value
   * @returns {Number} - Estimated percentile (0-100)
   */
  calculatePercentile(value, p25, p50, p75) {
    if (value <= p25) {
      // Linear interpolation between 0 and 25th percentile
      return (value / p25) * 25;
    } else if (value <= p50) {
      // Linear interpolation between 25th and 50th percentile
      return 25 + ((value - p25) / (p50 - p25)) * 25;
    } else if (value <= p75) {
      // Linear interpolation between 50th and 75th percentile
      return 50 + ((value - p50) / (p75 - p50)) * 25;
    } else {
      // Above 75th percentile
      const p75Ratio = value / p75;
      // Cap at 99th percentile for very high values
      return Math.min(75 + (p75Ratio - 1) * 25, 99);
    }
  }
  
  /**
   * Generate insights based on benchmark comparisons
   * @param {Object} userStats - User statistics
   * @param {Object} benchmarks - Benchmark data
   * @param {Object} comparisons - Comparison results
   * @returns {Array} - Spending insights
   */
  generateInsights(userStats, benchmarks, comparisons) {
    const insights = [];
    
    // Prioritize local insights if available
    const benchmarkType = benchmarks.local ? 'local' : benchmarks.country ? 'country' : 'global';
    const comparison = comparisons[benchmarkType];
    const benchmark = benchmarks[benchmarkType];
    
    // Overall spending insight
    if (comparison.total_spent.vs_median_percent > 20) {
      insights.push({
        type: 'overall_high',
        severity: 'high',
        message: `Your total spending is ${comparison.total_spent.vs_median_percent.toFixed(0)}% higher than the ${benchmarkType} median.`,
        percentile: comparison.total_spent.percentile.toFixed(0)
      });
    } else if (comparison.total_spent.vs_median_percent > 5) {
      insights.push({
        type: 'overall_high',
        severity: 'medium',
        message: `Your total spending is ${comparison.total_spent.vs_median_percent.toFixed(0)}% higher than the ${benchmarkType} median.`,
        percentile: comparison.total_spent.percentile.toFixed(0)
      });
    } else if (comparison.total_spent.vs_median_percent < -20) {
      insights.push({
        type: 'overall_low',
        severity: 'low',
        message: `Your total spending is ${Math.abs(comparison.total_spent.vs_median_percent).toFixed(0)}% lower than the ${benchmarkType} median.`,
        percentile: comparison.total_spent.percentile.toFixed(0)
      });
    }
    
    // Category insights
    for (const [category, catComparison] of Object.entries(comparison.categories)) {
      const userCategoryData = userStats.categories[category];
      
      // Skip categories without benchmark data
      if (catComparison.no_benchmark_data) continue;
      
      // High spending categories
      if (catComparison.vs_median_percent > 50) {
        insights.push({
          type: 'category_high',
          category,
          severity: 'high',
          message: `Your spending on ${category} is ${catComparison.vs_median_percent.toFixed(0)}% higher than the ${benchmarkType} median.`,
          amount: userCategoryData.total,
          percent_of_total: userCategoryData.percentage.toFixed(1)
        });
      } else if (catComparison.vs_median_percent > 25) {
        insights.push({
          type: 'category_high',
          category,
          severity: 'medium',
          message: `Your spending on ${category} is ${catComparison.vs_median_percent.toFixed(0)}% higher than the ${benchmarkType} median.`,
          amount: userCategoryData.total,
          percent_of_total: userCategoryData.percentage.toFixed(1)
        });
      }
      
      // Significant portion of budget
      if (userCategoryData.percentage > 25) {
        insights.push({
          type: 'category_significant',
          category,
          severity: 'medium',
          message: `${category} makes up ${userCategoryData.percentage.toFixed(0)}% of your total spending.`,
          amount: userCategoryData.total,
          percent_of_total: userCategoryData.percentage.toFixed(1)
        });
      }
    }
    
    // Transaction count insights
    if (comparison.transaction_count.vs_avg_percent > 30) {
      insights.push({
        type: 'transaction_high',
        severity: 'medium',
        message: `You have ${comparison.transaction_count.vs_avg_percent.toFixed(0)}% more transactions than the ${benchmarkType} average.`,
        count: userStats.transaction_count,
        avg_size: userStats.avg_expense.toFixed(2)
      });
    } else if (comparison.transaction_count.vs_avg_percent < -30) {
      insights.push({
        type: 'transaction_low',
        severity: 'low',
        message: `You have ${Math.abs(comparison.transaction_count.vs_avg_percent).toFixed(0)}% fewer transactions than the ${benchmarkType} average.`,
        count: userStats.transaction_count,
        avg_size: userStats.avg_expense.toFixed(2)
      });
    }
    
    // Add saving opportunity insights
    if (insights.some(i => i.type === 'category_high' && i.severity === 'high')) {
      insights.push({
        type: 'saving_opportunity',
        severity: 'high',
        message: `You could save by reducing spending in your highest above-average categories.`,
        potential_saving: this.calculatePotentialSavings(userStats, benchmark)
      });
    }
    
    return insights;
  }
  
  /**
   * Calculate potential savings by reducing above-median categories to median
   * @param {Object} userStats - User statistics
   * @param {Object} benchmark - Benchmark data
   * @returns {Number} - Potential savings amount
   */
  calculatePotentialSavings(userStats, benchmark) {
    let potentialSavings = 0;
    
    for (const [category, userCatStats] of Object.entries(userStats.categories)) {
      const benchmarkCatData = benchmark.categories[category];
      
      if (benchmarkCatData && userCatStats.total > benchmarkCatData.median_spent_standard) {
        // Potential savings by reducing to median
        potentialSavings += (userCatStats.total - benchmarkCatData.median_spent_standard);
      }
    }
    
    return potentialSavings;
  }
  
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
      
      const conversion = await currencyConverter.convertAmount(
        amount,
        sourceCurrency,
        targetCurrency
      );
      
      return conversion.convertedAmount;
    } catch (error) {
      console.warn('Currency conversion error in benchmarking:', error);
      return amount; // Return original amount as fallback
    }
  }
  
  /**
   * Create regional benchmark data
   * @param {Object} benchmarkData - Benchmark data to store
   * @returns {Promise<Object>} - Creation result
   */
  async createRegionalBenchmark(benchmarkData) {
    try {
      // Validate required fields
      if (!benchmarkData.region || !benchmarkData.time_period || !benchmarkData.currency) {
        throw new Error('Missing required benchmark fields');
      }
      
      // Insert benchmark data
      const result = await pool.query(`
        INSERT INTO regional_benchmarks(
          region, city, country, time_period, start_date, end_date,
          currency, user_count, avg_spent, median_spent, p25_spent, p75_spent,
          avg_transaction_count, category_data, created_at, updated_at
        )
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        RETURNING *
      `, [
        benchmarkData.region,
        benchmarkData.city || null,
        benchmarkData.country,
        benchmarkData.time_period,
        benchmarkData.start_date,
        benchmarkData.end_date,
        benchmarkData.currency,
        benchmarkData.user_count,
        benchmarkData.avg_spent,
        benchmarkData.median_spent,
        benchmarkData.p25_spent,
        benchmarkData.p75_spent,
        benchmarkData.avg_transaction_count,
        JSON.stringify(benchmarkData.category_data || {})
      ]);
      
      return {
        success: true,
        benchmark: result.rows[0]
      };
    } catch (error) {
      console.error('Error creating regional benchmark:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ExpenseBenchmarkService();