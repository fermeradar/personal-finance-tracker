class StatisticsCalculator {
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
}

module.exports = new StatisticsCalculator();
