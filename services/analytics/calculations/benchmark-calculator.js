class BenchmarkCalculator {
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
      return (value / p25) * 25;
    } else if (value <= p50) {
      return 25 + ((value - p25) / (p50 - p25)) * 25;
    } else if (value <= p75) {
      return 50 + ((value - p50) / (p75 - p50)) * 25;
    } else {
      const p75Ratio = value / p75;
      return Math.min(75 + (p75Ratio - 1) * 25, 99);
    }
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
        potentialSavings += (userCatStats.total - benchmarkCatData.median_spent_standard);
      }
    }
    
    return potentialSavings;
  }
}

module.exports = new BenchmarkCalculator();
