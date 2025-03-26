// src/scenes/benchmarkScene.js
const { Scenes, Markup } = require('telegraf');
const { Pool } = require('pg');
const { getUserLanguage } = require('../services/core/user-manager');
const expenseBenchmarkService = require('../services/analytics/expense-benchmark-service');
const logger = require('../utils/logger');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const benchmarkScene = new Scenes.WizardScene(
  'benchmark',
  // Step 1: Show benchmark options
  async (ctx) => {
    try {
      const userId = ctx.from.id.toString();
      const userLanguage = await getUserLanguage(userId);
      
      // Save user ID in session
      ctx.scene.session.userId = userId;
      ctx.scene.session.userLanguage = userLanguage;
      
      // Get user currency
      const userCurrency = await getUserCurrency(userId);
      ctx.scene.session.userCurrency = userCurrency;
      
      // Check if user has enough data
      const hasEnoughData = await checkUserHasEnoughData(userId);
      
      if (!hasEnoughData) {
        // Not enough data for benchmarking
        await ctx.reply(
          userLanguage === 'en'
            ? 'You need to have at least 5 expenses recorded for benchmarking. Please add more expenses and try again.'
            : 'Для сравнительного анализа необходимо иметь не менее 5 записанных расходов. Пожалуйста, добавьте больше расходов и попробуйте снова.',
          Markup.removeKeyboard()
        );
        
        return ctx.scene.leave();
      }
      
      // Show benchmark options
      await ctx.reply(
        userLanguage === 'en'
          ? 'What type of benchmark analysis would you like to see?'
          : 'Какой тип сравнительного анализа вы хотели бы увидеть?',
        Markup.keyboard([
          [userLanguage === 'en' ? 'Monthly Spending Overview' : 'Обзор ежемесячных расходов'],
          [userLanguage === 'en' ? 'Spending By Category' : 'Расходы по категориям'],
          [userLanguage === 'en' ? 'Regional Comparison' : 'Региональное сравнение'],
          [userLanguage === 'en' ? 'Top Expenses' : 'Топ расходов'],
          [userLanguage === 'en' ? 'Cancel' : 'Отмена']
        ]).resize()
      );
      
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error in benchmark scene step 1:', error);
      await ctx.reply('Sorry, an error occurred. Please try again later.');
      return ctx.scene.leave();
    }
  },
  
  // Step 2: Handle benchmark selection
  async (ctx) => {
    try {
      const userId = ctx.scene.session.userId;
      const userLanguage = ctx.scene.session.userLanguage;
      
      // Check for cancel
      if (ctx.message.text === 'Cancel' || ctx.message.text === 'Отмена') {
        await ctx.reply(
          userLanguage === 'en' 
            ? 'Benchmark canceled.' 
            : 'Сравнительный анализ отменен.',
          Markup.removeKeyboard()
        );
        return ctx.scene.leave();
      }
      
      // Store benchmark type in session
      if (ctx.message.text === 'Monthly Spending Overview' || 
          ctx.message.text === 'Обзор ежемесячных расходов') {
        ctx.scene.session.benchmarkType = 'monthly';
      } else if (ctx.message.text === 'Spending By Category' || 
                 ctx.message.text === 'Расходы по категориям') {
        ctx.scene.session.benchmarkType = 'category';
      } else if (ctx.message.text === 'Regional Comparison' || 
                 ctx.message.text === 'Региональное сравнение') {
        ctx.scene.session.benchmarkType = 'regional';
      } else if (ctx.message.text === 'Top Expenses' || 
                 ctx.message.text === 'Топ расходов') {
        ctx.scene.session.benchmarkType = 'top';
      } else {
        // Invalid selection
        await ctx.reply(
          userLanguage === 'en'
            ? 'Please select a valid benchmark type.'
            : 'Пожалуйста, выберите корректный тип сравнительного анализа.'
        );
        return; // Stay on same step
      }
      
      // Ask for time period
      await ctx.reply(
        userLanguage === 'en'
          ? 'Select time period for analysis:'
          : 'Выберите период для анализа:',
        Markup.keyboard([
          [userLanguage === 'en' ? 'Current Month' : 'Текущий месяц'],
          [userLanguage === 'en' ? 'Last Month' : 'Прошлый месяц'],
          [userLanguage === 'en' ? 'Last Quarter' : 'Последний квартал'],
          [userLanguage === 'en' ? 'Year To Date' : 'С начала года'],
          [userLanguage === 'en' ? 'Cancel' : 'Отмена']
        ]).resize()
      );
      
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error in benchmark scene step 2:', error);
      await ctx.reply('Sorry, an error occurred. Please try again later.');
      return ctx.scene.leave();
    }
  },
  
  // Step 3: Handle time period selection and generate benchmark
  async (ctx) => {
    try {
      const userId = ctx.scene.session.userId;
      const userLanguage = ctx.scene.session.userLanguage;
      const userCurrency = ctx.scene.session.userCurrency;
      
      // Check for cancel
      if (ctx.message.text === 'Cancel' || ctx.message.text === 'Отмена') {
        await ctx.reply(
          userLanguage === 'en' 
            ? 'Benchmark canceled.' 
            : 'Сравнительный анализ отменен.',
          Markup.removeKeyboard()
        );
        return ctx.scene.leave();
      }
      
      // Map time period selection to API parameter
      let timePeriod;
      if (ctx.message.text === 'Current Month' || ctx.message.text === 'Текущий месяц') {
        timePeriod = 'month';
      } else if (ctx.message.text === 'Last Month' || ctx.message.text === 'Прошлый месяц') {
        timePeriod = 'last_month';
      } else if (ctx.message.text === 'Last Quarter' || ctx.message.text === 'Последний квартал') {
        timePeriod = 'quarter';
      } else if (ctx.message.text === 'Year To Date' || ctx.message.text === 'С начала года') {
        timePeriod = 'year';
      } else {
        // Invalid selection
        await ctx.reply(
          userLanguage === 'en'
            ? 'Please select a valid time period.'
            : 'Пожалуйста, выберите корректный период времени.'
        );
        return; // Stay on same step
      }
      
      // Show processing message
      await ctx.reply(
        userLanguage === 'en'
          ? 'Generating benchmark analysis... This may take a moment.'
          : 'Создание сравнительного анализа... Это может занять некоторое время.',
        Markup.removeKeyboard()
      );
      
      // Generate benchmark
      try {
        const benchmark = await expenseBenchmarkService.generateUserBenchmark(
          userId,
          timePeriod,
          userCurrency
        );
        
        // Format benchmark based on type
        let formattedBenchmark;
        switch (ctx.scene.session.benchmarkType) {
          case 'monthly':
            formattedBenchmark = formatMonthlyBenchmark(benchmark, userLanguage);
            break;
            
          case 'category':
            formattedBenchmark = formatCategoryBenchmark(benchmark, userLanguage);
            break;
            
          case 'regional':
            formattedBenchmark = formatRegionalBenchmark(benchmark, userLanguage);
            break;
            
          case 'top':
            formattedBenchmark = await getTopExpenses(userId, timePeriod, userLanguage);
            break;
            
          default:
            // Fallback to monthly
            formattedBenchmark = formatMonthlyBenchmark(benchmark, userLanguage);
        }
        
        // Send benchmark result
        await ctx.reply(formattedBenchmark, { parse_mode: 'Markdown' });
        
        // Format insights if any
        if (benchmark.insights && benchmark.insights.length > 0) {
          const insights = formatInsights(benchmark.insights, userLanguage);
          await ctx.reply(insights, { parse_mode: 'Markdown' });
        }
        
        // Ask if user wants to see another benchmark
        await ctx.reply(
          userLanguage === 'en'
            ? 'Would you like to see another benchmark?'
            : 'Хотите увидеть другой сравнительный анализ?',
          Markup.keyboard([
            [userLanguage === 'en' ? 'Yes' : 'Да'],
            [userLanguage === 'en' ? 'No' : 'Нет']
          ]).resize()
        );
        
        return ctx.wizard.next();
      } catch (benchmarkError) {
        logger.error('Error generating benchmark:', benchmarkError);
        
        await ctx.reply(
          userLanguage === 'en'
            ? 'Sorry, an error occurred while generating the benchmark. Please try again later.'
            : 'Извините, произошла ошибка при создании сравнительного анализа. Пожалуйста, попробуйте позже.',
          Markup.removeKeyboard()
        );
        
        return ctx.scene.leave();
      }
    } catch (error) {
      logger.error('Error in benchmark scene step 3:', error);
      
      const userLanguage = ctx.scene.session.userLanguage || 'en';
      
      await ctx.reply(
        userLanguage === 'en'
          ? 'Sorry, an error occurred. Please try again later.'
          : 'Извините, произошла ошибка. Пожалуйста, попробуйте позже.',
        Markup.removeKeyboard()
      );
      
      return ctx.scene.leave();
    }
  },
  
  // Step 4: Handle whether to see another benchmark
  async (ctx) => {
    try {
      const userLanguage = ctx.scene.session.userLanguage;
      
      // Check response
      if (ctx.message.text === 'Yes' || ctx.message.text === 'Да') {
        // Reset benchmark type
        delete ctx.scene.session.benchmarkType;
        
        // Go back to step 1
        await ctx.reply(
          userLanguage === 'en'
            ? 'What type of benchmark analysis would you like to see?'
            : 'Какой тип сравнительного анализа вы хотели бы увидеть?',
          Markup.keyboard([
            [userLanguage === 'en' ? 'Monthly Spending Overview' : 'Обзор ежемесячных расходов'],
            [userLanguage === 'en' ? 'Spending By Category' : 'Расходы по категориям'],
            [userLanguage === 'en' ? 'Regional Comparison' : 'Региональное сравнение'],
            [userLanguage === 'en' ? 'Top Expenses' : 'Топ расходов'],
            [userLanguage === 'en' ? 'Cancel' : 'Отмена']
          ]).resize()
        );
        
        return ctx.wizard.selectStep(1);
      } else {
        // End benchmark session
        await ctx.reply(
          userLanguage === 'en'
            ? 'Thank you for using the benchmark feature!'
            : 'Спасибо за использование функции сравнительного анализа!',
          Markup.removeKeyboard()
        );
        
        return ctx.scene.leave();
      }
    } catch (error) {
      logger.error('Error in benchmark scene step 4:', error);
      
      const userLanguage = ctx.scene.session.userLanguage || 'en';
      
      await ctx.reply(
        userLanguage === 'en'
          ? 'Sorry, an error occurred. Please try again later.'
          : 'Извините, произошла ошибка. Пожалуйста, попробуйте позже.',
        Markup.removeKeyboard()
      );
      
      return ctx.scene.leave();
    }
  }
);

// Cancel handler
benchmarkScene.hears(['Cancel', 'Отмена'], (ctx) => {
  const userLanguage = ctx.scene.session?.userLanguage || 'en';
  
  ctx.reply(
    userLanguage === 'en' 
      ? 'Benchmark canceled.' 
      : 'Сравнительный анализ отменен.',
    Markup.removeKeyboard()
  );
  
  return ctx.scene.leave();
});

/**
 * Get user's preferred currency
 * @param {String} userId - User ID
 * @returns {Promise<String>} - Currency code
 */
async function getUserCurrency(userId) {
  try {
    const result = await pool.query(
      'SELECT currency FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length > 0 && result.rows[0].currency) {
      return result.rows[0].currency;
    }
    
    return 'EUR'; // Default
  } catch (error) {
    logger.error('Error getting user currency:', error);
    return 'EUR'; // Default on error
  }
}

/**
 * Check if user has enough data for benchmarking
 * @param {String} userId - User ID
 * @returns {Promise<Boolean>} - Whether user has enough data
 */
async function checkUserHasEnoughData(userId) {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM expenses WHERE user_id = $1',
      [userId]
    );
    
    const count = parseInt(result.rows[0].count);
    return count >= 5; // At least 5 expenses needed
  } catch (error) {
    logger.error('Error checking user data:', error);
    return false; // Assume not enough data on error
  }
}

/**
 * Format monthly spending benchmark
 * @param {Object} benchmark - Benchmark data
 * @param {String} language - User language
 * @returns {String} - Formatted benchmark text
 */
function formatMonthlyBenchmark(benchmark, language) {
  try {
    const currencySymbol = getCurrencySymbol(benchmark.currency);
    
    // Find user's total and the median total
    const userTotal = benchmark.userStatistics.total;
    let medianTotal, avgTotal;
    
    if (benchmark.benchmarks.local) {
      // Use local benchmark if available
      medianTotal = benchmark.benchmarks.local.total.median_spent_standard;
      avgTotal = benchmark.benchmarks.local.total.avg_spent_standard;
    } else if (benchmark.benchmarks.country) {
      // Use country benchmark if available
      medianTotal = benchmark.benchmarks.country.total.median_spent_standard;
      avgTotal = benchmark.benchmarks.country.total.avg_spent_standard;
    } else {
      // Use global benchmark
      medianTotal = benchmark.benchmarks.global.total.median_spent_standard;
      avgTotal = benchmark.benchmarks.global.total.avg_spent_standard;
    }
    
    // Calculate percentage difference
    const percentDiff = medianTotal > 0 
      ? Math.round(((userTotal / medianTotal) - 1) * 100) 
      : 0;
    
    // Format difference text
    let diffText;
    if (percentDiff > 0) {
      diffText = language === 'en'
        ? `${percentDiff}% higher than`
        : `на ${percentDiff}% выше, чем`;
    } else if (percentDiff < 0) {
      diffText = language === 'en'
        ? `${Math.abs(percentDiff)}% lower than`
        : `на ${Math.abs(percentDiff)}% ниже, чем`;
    } else {
      diffText = language === 'en'
        ? `the same as`
        : `такой же, как`;
    }
    
    // Create benchmark text
    if (language === 'en') {
      return `*Monthly Spending Overview*\n\n` +
        `Period: ${benchmark.timeframe.label}\n\n` +
        `Your total spending: ${currencySymbol}${userTotal.toFixed(2)}\n` +
        `Average spending: ${currencySymbol}${avgTotal.toFixed(2)}\n` +
        `Median spending: ${currencySymbol}${medianTotal.toFixed(2)}\n\n` +
        `Your spending is ${diffText} the median.\n\n` +
        `Daily average: ${currencySymbol}${benchmark.userStatistics.daily_avg.toFixed(2)}\n` +
        `Weekly average: ${currencySymbol}${benchmark.userStatistics.weekly_avg.toFixed(2)}\n` +
        `Transactions: ${benchmark.userStatistics.transaction_count}`;
    } else {
      return `*Обзор ежемесячных расходов*\n\n` +
        `Период: ${benchmark.timeframe.label}\n\n` +
        `Ваши общие расходы: ${currencySymbol}${userTotal.toFixed(2)}\n` +
        `Средние расходы: ${currencySymbol}${avgTotal.toFixed(2)}\n` +
        `Медианные расходы: ${currencySymbol}${medianTotal.toFixed(2)}\n\n` +
        `Ваши расходы ${diffText} медианы.\n\n` +
        `Среднедневные: ${currencySymbol}${benchmark.userStatistics.daily_avg.toFixed(2)}\n` +
        `Средненедельные: ${currencySymbol}${benchmark.userStatistics.weekly_avg.toFixed(2)}\n` +
        `Транзакции: ${benchmark.userStatistics.transaction_count}`;
    }
  } catch (error) {
    logger.error('Error formatting monthly benchmark:', error);
    
    // Return simple message on error
    return language === 'en'
      ? 'Error formatting benchmark data. Please try again later.'
      : 'Ошибка форматирования данных сравнительного анализа. Пожалуйста, попробуйте позже.';
  }
}

/**
 * Format category spending benchmark
 * @param {Object} benchmark - Benchmark data
 * @param {String} language - User language
 * @returns {String} - Formatted benchmark text
 */
function formatCategoryBenchmark(benchmark, language) {
  try {
    const currencySymbol = getCurrencySymbol(benchmark.currency);
    
    // Get benchmark type to use (prefer local > country > global)
    const benchmarkType = benchmark.benchmarks.local 
      ? 'local' 
      : benchmark.benchmarks.country 
        ? 'country' 
        : 'global';
    
    const benchmarkData = benchmark.benchmarks[benchmarkType];
    
    // Get user's categories sorted by amount
    const categories = Object.entries(benchmark.userStatistics.categories)
      .map(([name, data]) => ({
        name,
        ...data
      }))
      .sort((a, b) => b.total - a.total);
    
    // Create category comparison text
    let categoryText = '';
    
    for (const category of categories.slice(0, 5)) { // Show top 5 categories
      const benchmarkCatData = benchmarkData.categories[category.name];
      
      if (benchmarkCatData) {
        const medianAmount = benchmarkCatData.median_spent_standard || 0;
        const percentDiff = medianAmount > 0 
          ? Math.round(((category.total / medianAmount) - 1) * 100) 
          : 0;
        
        // Format difference text
        let diffText;
        if (percentDiff > 20) {
          diffText = language === 'en'
            ? `*${percentDiff}% higher* than median`
            : `*на ${percentDiff}% выше* медианы`;
        } else if (percentDiff < -20) {
          diffText = language === 'en'
            ? `*${Math.abs(percentDiff)}% lower* than median`
            : `*на ${Math.abs(percentDiff)}% ниже* медианы`;
        } else {
          diffText = language === 'en'
            ? `close to median`
            : `близко к медиане`;
        }
        
        categoryText += language === 'en'
          ? `*${category.name}*: ${currencySymbol}${category.total.toFixed(2)} ` +
            `(${diffText})\n`
          : `*${category.name}*: ${currencySymbol}${category.total.toFixed(2)} ` +
            `(${diffText})\n`;
      } else {
        categoryText += language === 'en'
          ? `*${category.name}*: ${currencySymbol}${category.total.toFixed(2)} ` +
            `(no benchmark data)\n`
          : `*${category.name}*: ${currencySymbol}${category.total.toFixed(2)} ` +
            `(нет данных для сравнения)\n`;
      }
    }
    
    // Create benchmark text
    if (language === 'en') {
      return `*Spending By Category*\n\n` +
        `Period: ${benchmark.timeframe.label}\n\n` +
        `Your top categories:\n\n` +
        categoryText + `\n` +
        `These categories represent ${categories.slice(0, 5).reduce((sum, cat) => sum + cat.percentage, 0).toFixed(0)}% ` +
        `of your total spending.`;
    } else {
      return `*Расходы по категориям*\n\n` +
        `Период: ${benchmark.timeframe.label}\n\n` +
        `Ваши основные категории:\n\n` +
        categoryText + `\n` +
        `Эти категории представляют ${categories.slice(0, 5).reduce((sum, cat) => sum + cat.percentage, 0).toFixed(0)}% ` +
        `ваших общих расходов.`;
    }
  } catch (error) {
    logger.error('Error formatting category benchmark:', error);
    
    // Return simple message on error
    return language === 'en'
      ? 'Error formatting benchmark data. Please try again later.'
      : 'Ошибка форматирования данных сравнительного анализа. Пожалуйста, попробуйте позже.';
  }
}

/**
 * Format regional benchmark
 * @param {Object} benchmark - Benchmark data
 * @param {String} language - User language
 * @returns {String} - Formatted benchmark text
 */
function formatRegionalBenchmark(benchmark, language) {
  try {
    const currencySymbol = getCurrencySymbol(benchmark.currency);
    
    // Get user's total
    const userTotal = benchmark.userStatistics.total;
    
    // Create comparison text for each region
    let comparisonText = '';
    
    // Local comparison (if available)
    if (benchmark.benchmarks.local) {
      const local = benchmark.benchmarks.local;
      const localAvg = local.total.avg_spent_standard;
      const localMedian = local.total.median_spent_standard;
      const percentDiff = localMedian > 0 
        ? Math.round(((userTotal / localMedian) - 1) * 100) 
        : 0;
      
      comparisonText += language === 'en'
        ? `*Local (${local.location})*\n` +
          `Average: ${currencySymbol}${localAvg.toFixed(2)}\n` +
          `Median: ${currencySymbol}${localMedian.toFixed(2)}\n` +
          `Your spending is ${percentDiff > 0 ? '+' : ''}${percentDiff}% vs median\n` +
          `Based on data from ${local.user_count} users\n\n`
        : `*Локально (${local.location})*\n` +
          `Среднее: ${currencySymbol}${localAvg.toFixed(2)}\n` +
          `Медиана: ${currencySymbol}${localMedian.toFixed(2)}\n` +
          `Ваши расходы ${percentDiff > 0 ? '+' : ''}${percentDiff}% от медианы\n` +
          `На основе данных ${local.user_count} пользователей\n\n`;
    }
    
    // Country comparison (if available)
    if (benchmark.benchmarks.country) {
      const country = benchmark.benchmarks.country;
      const countryAvg = country.total.avg_spent_standard;
      const countryMedian = country.total.median_spent_standard;
      const percentDiff = countryMedian > 0 
        ? Math.round(((userTotal / countryMedian) - 1) * 100) 
        : 0;
      
      comparisonText += language === 'en'
        ? `*Country (${country.location})*\n` +
          `Average: ${currencySymbol}${countryAvg.toFixed(2)}\n` +
          `Median: ${currencySymbol}${countryMedian.toFixed(2)}\n` +
          `Your spending is ${percentDiff > 0 ? '+' : ''}${percentDiff}% vs median\n` +
          `Based on data from ${country.user_count} users\n\n`
        : `*Страна (${country.location})*\n` +
          `Среднее: ${currencySymbol}${countryAvg.toFixed(2)}\n` +
          `Медиана: ${currencySymbol}${countryMedian.toFixed(2)}\n` +
          `Ваши расходы ${percentDiff > 0 ? '+' : ''}${percentDiff}% от медианы\n` +
          `На основе данных ${country.user_count} пользователей\n\n`;
    }
    
    // Global comparison
    const global = benchmark.benchmarks.global;
    const globalAvg = global.total.avg_spent_standard;
    const globalMedian = global.total.median_spent_standard;
    const percentDiff = globalMedian > 0 
      ? Math.round(((userTotal / globalMedian) - 1) * 100) 
      : 0;
    
    comparisonText += language === 'en'
      ? `*Global*\n` +
        `Average: ${currencySymbol}${globalAvg.toFixed(2)}\n` +
        `Median: ${currencySymbol}${globalMedian.toFixed(2)}\n` +
        `Your spending is ${percentDiff > 0 ? '+' : ''}${percentDiff}% vs median\n` +
        `Based on data from ${global.user_count} users`
      : `*Глобально*\n` +
        `Среднее: ${currencySymbol}${globalAvg.toFixed(2)}\n` +
        `Медиана: ${currencySymbol}${globalMedian.toFixed(2)}\n` +
        `Ваши расходы ${percentDiff > 0 ? '+' : ''}${percentDiff}% от медианы\n` +
        `На основе данных ${global.user_count} пользователей`;
    
    // Create benchmark text
    if (language === 'en') {
      return `*Regional Spending Comparison*\n\n` +
        `Period: ${benchmark.timeframe.label}\n\n` +
        `Your total: ${currencySymbol}${userTotal.toFixed(2)}\n\n` +
        comparisonText;
    } else {
      return `*Региональное сравнение расходов*\n\n` +
        `Период: ${benchmark.timeframe.label}\n\n` +
        `Ваши расходы: ${currencySymbol}${userTotal.toFixed(2)}\n\n` +
        comparisonText;
    }
  } catch (error) {
    logger.error('Error formatting regional benchmark:', error);
    
    // Return simple message on error
    return language === 'en'
      ? 'Error formatting benchmark data. Please try again later.'
      : 'Ошибка форматирования данных сравнительного анализа. Пожалуйста, попробуйте позже.';
  }
}

/**
 * Get top expenses for user
 * @param {String} userId - User ID
 * @param {String} timePeriod - Time period
 * @param {String} language - User language
 * @returns {Promise<String>} - Formatted top expenses
 */
async function getTopExpenses(userId, timePeriod, language) {
  try {
    // Calculate date range
    const endDate = new Date();
    let startDate = new Date();
    
    switch (timePeriod) {
      case 'month':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
        endDate.setDate(0); // Last day of previous month
        break;
      case 'quarter':
        const quarter = Math.floor(endDate.getMonth() / 3);
        startDate = new Date(endDate.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(endDate.getFullYear(), 0, 1);
        break;
      default:
        // Default to last 30 days
        startDate.setDate(startDate.getDate() - 30);
    }
    
    // Get user currency
    const userCurrency = await getUserCurrency(userId);
    const currencySymbol = getCurrencySymbol(userCurrency);
    
    // Query top expenses
    const result = await pool.query(`
      SELECT 
        e.expense_id,
        e.amount,
        e.currency,
        e.expense_date,
        c.name as category_name,
        e.merchant_name,
        e.description
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.category_id
      WHERE e.user_id = $1
        AND e.expense_date >= $2
        AND e.expense_date <= $3
      ORDER BY e.amount DESC
      LIMIT 5
    `, [userId, startDate, endDate]);
    
    // Format expenses
    let expenseText = '';
    
    for (const expense of result.rows) {
      // Format date
      const date = new Date(expense.expense_date).toLocaleDateString(
        language === 'en' ? 'en-US' : 'ru-RU'
      );
      
      // Format amount
      const amount = expense.currency === userCurrency
        ? expense.amount
        : await convertCurrency(expense.amount, expense.currency, userCurrency);
      
      expenseText += language === 'en'
        ? `*${expense.category_name || 'Uncategorized'}*: ${currencySymbol}${amount.toFixed(2)}\n` +
          `Date: ${date}\n` +
          (expense.merchant_name ? `Merchant: ${expense.merchant_name}\n` : '') +
          (expense.description ? `Description: ${expense.description}\n` : '') +
          `\n`
        : `*${expense.category_name || 'Без категории'}*: ${currencySymbol}${amount.toFixed(2)}\n` +
          `Дата: ${date}\n` +
          (expense.merchant_name ? `Продавец: ${expense.merchant_name}\n` : '') +
          (expense.description ? `Описание: ${expense.description}\n` : '') +
          `\n`;
    }
    
    // Format time period name
    let periodName;
    switch (timePeriod) {
      case 'month':
        periodName = language === 'en' ? 'Current Month' : 'Текущий месяц';
        break;
      case 'last_month':
        periodName = language === 'en' ? 'Last Month' : 'Прошлый месяц';
        break;
      case 'quarter':
        periodName = language === 'en' ? 'Current Quarter' : 'Текущий квартал';
        break;
      case 'year':
        periodName = language === 'en' ? 'Year to Date' : 'С начала года';
        break;
      default:
        periodName = language === 'en' ? 'Selected Period' : 'Выбранный период';
    }
    
    // Create top expenses text
    if (language === 'en') {
      return `*Top Expenses*\n\n` +
        `Period: ${periodName}\n\n` +
        (expenseText || 'No expenses found for this period.');
    } else {
      return `*Топ расходов*\n\n` +
        `Период: ${periodName}\n\n` +
        (expenseText || 'Расходы за этот период не найдены.');
    }
  } catch (error) {
    logger.error('Error getting top expenses:', error);
    
    // Return simple message on error
    return language === 'en'
      ? 'Error retrieving top expenses. Please try again later.'
      : 'Ошибка получения топ расходов. Пожалуйста, попробуйте позже.';
  }
}

/**
 * Format insights from benchmark
 * @param {Array} insights - Benchmark insights
 * @param {String} language - User language
 * @returns {String} - Formatted insights
 */
function formatInsights(insights, language) {
  try {
    // Sort insights by severity
    const sortedInsights = [...insights].sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
    
    // Create insights text
    let insightsText = language === 'en'
      ? '*Spending Insights*\n\n'
      : '*Анализ расходов*\n\n';
    
    for (const insight of sortedInsights) {
      insightsText += `• ${insight.message}\n\n`;
    }
    
    return insightsText;
  } catch (error) {
    logger.error('Error formatting insights:', error);
    
    // Return simple message on error
    return language === 'en'
      ? 'Error formatting insights. Please try again later.'
      : 'Ошибка форматирования аналитики. Пожалуйста, попробуйте позже.';
  }
}

/**
 * Get currency symbol for currency code
 * @param {String} currency - Currency code
 * @returns {String} - Currency symbol
 */
function getCurrencySymbol(currency) {
  const symbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'RUB': '₽',
    'JPY': '¥',
    'CNY': '¥',
    'CHF': 'CHF',
    'CAD': 'C$'
  };
  
  return symbols[currency] || currency;
}

/**
 * Convert currency amount
 * @param {Number} amount - Amount to convert
 * @param {String} fromCurrency - Source currency
 * @param {String} toCurrency - Target currency
 * @returns {Promise<Number>} - Converted amount
 */
async function convertCurrency(amount, fromCurrency, toCurrency) {
  try {
    if (fromCurrency === toCurrency) {
      return amount;
    }
    
    const conversion = await currencyConverter.convertAmount(
      amount,
      fromCurrency,
      toCurrency
    );
    
    return conversion.convertedAmount;
  } catch (error) {
    logger.error('Error converting currency:', error);
    return amount; // Return original amount on error
  }
}

module.exports = benchmarkScene;