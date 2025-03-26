const logger = require('../core/logger-utility');
// src/services/crossLanguageAnalytics.js
const { Pool } = require('pg');
const productNormalizer = require('./productNormalizer');
const currencyConverter = require('./currencyConverter');
const { translateText } = require('./translator');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Cross-Language Analytics Service
 * Provides analytics capabilities across items in multiple languages
 */
class CrossLanguageAnalytics {
  /**
   * Compare prices by unit quantity with currency standardization
   * @param {String} productName - Product name to analyze
   * @param {String} language - Language of the search term
   * @param {String} unit - Unit to compare (kg, l, etc.)
   * @param {String} targetCurrency - Currency to standardize to
   * @returns {Promise<Object>} - Price per unit analysis
   */
  async compareUnitPrices(_productName, language, unit, targetCurrency = 'EUR') {
    try {
      // Normalize the search term
      const normalized = await productNormalizer.normalizeProductName(_productName, language);
      
      // Determine the quantity type from unit
      const quantityType = productNormalizer.guessQuantityTypeFromUnit(unit);
      
      if (!quantityType) {
        throw new Error(`Unknown quantity type for unit: ${unit}`);
      }
      
      // Get standard unit for this quantity type
      const standardResult = await pool.query(
        'SELECT standard_unit FROM standard_units WHERE unit_type = $1',
        [quantityType]
      );
      
      if (standardResult.rows.length === 0) {
        throw new Error(`No standard unit found for quantity type: ${quantityType}`);
      }
      
      const standardUnit = standardResult.rows[0].standard_unit;
      
      // Query for unit price comparison
      const query = `
        SELECT 
          ei.product_name,
          ei.product_name_original,
          ei.original_language,
          ei.quantity_value,
          ei.quantity_unit,
          ei.standard_quantity,
          ei.standard_unit,
          ei.amount,
          e.currency,
          CASE 
            WHEN ei.standard_quantity IS NOT NULL AND ei.standard_quantity > 0 
            THEN ei.amount / ei.standard_quantity
            ELSE NULL
          END as price_per_unit,
          v.name as vendor_name,
          e.expense_date
        FROM expense_items ei
        JOIN expenses e ON ei.expense_id = e.expense_id
        LEFT JOIN vendors v ON e.vendor_id = v.vendor_id
        WHERE similarity(ei.product_name_normalized, $1) > 0.4
          AND ei.standard_unit = $2
          AND ei.standard_quantity IS NOT NULL
          AND ei.standard_quantity > 0
        ORDER BY price_per_unit ASC
        LIMIT 20
      `;
      
      const result = await pool.query(query, [normalized.normalized, standardUnit]);
      
      // Standardize currencies
      const itemsWithStandardCurrency = await currencyConverter.standardizeAmounts(
        result.rows.map(row => ({
          ...row,
          amount: parseFloat(row.amount),
          price_per_unit: parseFloat(row.price_per_unit),
          date: row.expense_date
        })),
        targetCurrency
      );
      
      // Calculate standardized price per unit
      const finalResults = itemsWithStandardCurrency.map(item => ({
        ...item,
        standardized_price_per_unit: item.standardized_amount / parseFloat(item.standard_quantity)
      }));
      
      // Sort by standardized price per unit
      finalResults.sort((a, b) => a.standardized_price_per_unit - b.standardized_price_per_unit);
      
      return {
        product: {
          original: _productName,
          normalized: normalized.normalized,
          brand: normalized.brandRecognized ? normalized.brand : null
        },
        unitComparison: {
          quantityType,
          standardUnit,
          targetCurrency,
          results: finalResults
        }
      };
    } catch (error) {
      logger.error('Error comparing unit prices:', error);
      throw error;
    }
  }
  
  /**
   * Find the most expensive variant of a product based on complex criteria
   * @param {String} productName - Product name to search for
   * @param {String} language - Language of the search term
   * @param {Object} filters - Additional filters (region, demographic, timeframe)
   * @param {String} targetCurrency - Currency to standardize to
   * @returns {Promise<Object>} - Most expensive product analysis
   */
  async findMostExpensiveVariant(_productName, language, filters = {}, targetCurrency = 'EUR') {
    try {
      // Normalize the search term
      const normalized = await productNormalizer.normalizeProductName(_productName, language);
      
      // Build the query based on filters
      let query = `
        WITH filtered_expenses AS (
          SELECT e.*
          FROM expenses e
          JOIN households h ON e.household_id = h.household_id
      `;
      
      const queryParams = [];
      let paramIndex = 1;
      
      // Add location join if needed
      if (filters.street || filters.district || filters.city || filters.region) {
        query += `
          JOIN location_details l ON h.household_id = l.household_id
        `;
      }
      
      // Add demographic join if needed
      if (filters.gender || filters.ageGroup || filters.employmentStatus) {
        query += `
          JOIN household_demographics hd ON h.household_id = hd.household_id
        `;
      }
      
      query += ` WHERE 1=1`;
      
      // Apply location filters
      if (filters.street) {
        query += ` AND l.street = $${paramIndex}`;
        queryParams.push(filters.street);
        paramIndex++;
      } else if (filters.district) {
        query += ` AND l.district = $${paramIndex}`;
        queryParams.push(filters.district);
        paramIndex++;
      } else if (filters.city) {
        query += ` AND l.city = $${paramIndex}`;
        queryParams.push(filters.city);
        paramIndex++;
      } else if (filters.region) {
        query += ` AND l.region = $${paramIndex}`;
        queryParams.push(filters.region);
        paramIndex++;
      }
      
      // Apply demographic filters
      if (filters.gender) {
        query += ` AND hd.gender = $${paramIndex}`;
        queryParams.push(filters.gender);
        paramIndex++;
      }
      
      if (filters.ageGroup) {
        query += ` AND hd.age_group = $${paramIndex}`;
        queryParams.push(filters.ageGroup);
        paramIndex++;
      }
      
      if (filters.employmentStatus) {
        query += ` AND hd.employment_status = $${paramIndex}`;
        queryParams.push(filters.employmentStatus);
        paramIndex++;
      }
      
      // Apply time filters
      if (filters.startDate) {
        query += ` AND e.expense_date >= $${paramIndex}`;
        queryParams.push(filters.startDate);
        paramIndex++;
      }
      
      if (filters.endDate) {
        query += ` AND e.expense_date <= $${paramIndex}`;
        queryParams.push(filters.endDate);
        paramIndex++;
      }
      
      // Complete the query
      query += `
        )
        SELECT 
          ei.product_name,
          ei.product_name_original,
          ei.original_language,
          ei.product_category,
          ei.amount,
          fe.currency,
          ei.quantity_value,
          ei.quantity_unit,
          ei.standard_quantity,
          ei.standard_unit,
          CASE 
            WHEN ei.standard_quantity IS NOT NULL AND ei.standard_quantity > 0 
            THEN ei.amount / ei.standard_quantity
            ELSE NULL
          END as price_per_unit,
          v.name as vendor_name,
          fe.expense_date,
          u.user_id
        FROM expense_items ei
        JOIN filtered_expenses fe ON ei.expense_id = fe.expense_id
        JOIN users u ON fe.user_id = u.user_id
        LEFT JOIN vendors v ON fe.vendor_id = v.vendor_id
        WHERE similarity(ei.product_name_normalized, $${paramIndex}) > 0.4
        ORDER BY ei.amount DESC
        LIMIT 10
      `;
      
      queryParams.push(normalized.normalized);
      
      const result = await pool.query(query, queryParams);
      
      // Convert all amounts to the target currency
      const standardizedResults = await currencyConverter.standardizeAmounts(
        result.rows.map(row => ({
          ...row,
          amount: parseFloat(row.amount),
          price_per_unit: row.price_per_unit ? parseFloat(row.price_per_unit) : null,
          date: row.expense_date
        })),
        targetCurrency
      );
      
      // Sort by standardized amount
      standardizedResults.sort((a, b) => b.standardized_amount - a.standardized_amount);
      
      return {
        product: {
          original: _productName,
          normalized: normalized.normalized,
          brand: normalized.brandRecognized ? normalized.brand : null
        },
        filters: {
          location: {
            street: filters.street,
            district: filters.district,
            city: filters.city,
            region: filters.region
          },
          demographics: {
            gender: filters.gender,
            ageGroup: filters.ageGroup,
            employmentStatus: filters.employmentStatus
          },
          timeframe: {
            startDate: filters.startDate,
            endDate: filters.endDate
          }
        },
        targetCurrency,
        results: standardizedResults
      };
    } catch (error) {
      logger.error('Error finding most expensive variant:', error);
      throw error;
    }
  }
  
  /**
   * Find similar products across languages
   * @param {String} productName - Product name to search for
   * @param {String} language - Language of the search term
   * @param {Object} filters - Additional filters (category, date range, etc.)
   * @returns {Promise<Array>} - Similar products found
   */
  async findSimilarProducts(_productName, language, filters = {}) {
    try {
      // Normalize the search term
      const normalized = await productNormalizer.normalizeProductName(_productName, language);
      
      // Base query
      let query = `
        SELECT 
          ei.product_name,
          ei.product_name_original,
          ei.original_language,
          ei.product_category,
          AVG(ei.amount) as average_price,
          COUNT(*) as purchase_count,
          MIN(ei.amount) as min_price,
          MAX(ei.amount) as max_price,
          STRING_AGG(DISTINCT ei.brand, ', ') as brands
        FROM expense_items ei
        JOIN expenses e ON ei.expense_id = e.expense_id
        WHERE (
          -- Match on normalized name (primary match)
          similarity(ei.product_name_normalized, $1) > 0.4
          -- Or match on original name for items in same language
          OR (ei.original_language = $2 AND similarity(ei.product_name_original, $3) > 0.5)
        )
      `;
      
      const params = [
        normalized.normalized,
        language,
        _productName
      ];
      
      let paramIndex = 4;
      
      // Add category filter if provided
      if (filters.category) {
        query += ` AND ei.product_category = $${paramIndex}`;
        params.push(filters.category);
        paramIndex++;
      }
      
      // Add date range filter if provided
      if (filters.startDate) {
        query += ` AND e.expense_date >= $${paramIndex}`;
        params.push(filters.startDate);
        paramIndex++;
      }
      
      if (filters.endDate) {
        query += ` AND e.expense_date <= $${paramIndex}`;
        params.push(filters.endDate);
        paramIndex++;
      }
      
      // Add brand filter if provided
      if (filters.brand) {
        query += ` AND ei.brand ILIKE $${paramIndex}`;
        params.push(`%${filters.brand}%`);
        paramIndex++;
      }
      
      // Add user ID filter if provided
      if (filters.userId) {
        query += ` AND e.user_id = $${paramIndex}`;
        params.push(filters.userId);
        paramIndex++;
      }
      
      // Complete the query with grouping and ordering
      query += `
        GROUP BY 
          ei.product_name,
          ei.product_name_original,
          ei.original_language,
          ei.product_category
        ORDER BY 
          similarity(ei.product_name_normalized, $1) DESC,
          purchase_count DESC
        LIMIT $${paramIndex}
      `;
      
      params.push(filters.limit || 10);
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error finding similar products:', error);
      throw error;
    }
  }
  
  /**
   * Analyze product price trends across languages
   * @param {String} productName - Product name to analyze
   * @param {String} language - Language of the search term
   * @param {Object} filters - Additional filters (timeframe, etc.)
   * @returns {Promise<Object>} - Price trend analysis
   */
  async analyzeProductPriceTrend(_productName, language, filters = {}) {
    try {
      // Normalize the search term
      const normalized = await productNormalizer.normalizeProductName(_productName, language);
      
      // Query for price trends
      const query = `
        SELECT 
          DATE_TRUNC('month', e.expense_date) as month,
          AVG(ei.amount) as average_price,
          COUNT(*) as purchase_count,
          MIN(ei.amount) as min_price,
          MAX(ei.amount) as max_price,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ei.amount) as median_price
        FROM expense_items ei
        JOIN expenses e ON ei.expense_id = e.expense_id
        WHERE similarity(ei.product_name_normalized, $1) > 0.4
          AND e.expense_date >= $2
          AND e.expense_date <= $3
        GROUP BY DATE_TRUNC('month', e.expense_date)
        ORDER BY month
      `;
      
      // Default to last 12 months if not specified
      const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
      const startDate = filters.startDate 
        ? new Date(filters.startDate) 
        : new Date(endDate.getFullYear() - 1, endDate.getMonth(), 1);
      
      const params = [
        normalized.normalized,
        startDate,
        endDate
      ];
      
      const result = await pool.query(query, params);
      
      return {
        product: {
          original: _productName,
          normalized: normalized.normalized,
          brand: normalized.brandRecognized ? normalized.brand : null
        },
        trends: result.rows,
        timeframe: {
          start: startDate,
          end: endDate
        }
      };
    } catch (error) {
      logger.error('Error analyzing product price trend:', error);
      throw error;
    }
  }
  
  /**
   * Find regional price variations for a product
   * @param {String} productName - Product name to analyze
   * @param {String} language - Language of the search term
   * @returns {Promise<Object>} - Regional price analysis
   */
  async findRegionalPriceVariations(_productName, language) {
    try {
      // Normalize the search term
      const normalized = await productNormalizer.normalizeProductName(_productName, language);
      
      // Query for regional variations
      const query = `
        SELECT 
          l.region,
          l.city,
          COUNT(*) as purchase_count,
          AVG(ei.amount) as average_price,
          MIN(ei.amount) as min_price,
          MAX(ei.amount) as max_price,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ei.amount) as median_price
        FROM expense_items ei
        JOIN expenses e ON ei.expense_id = e.expense_id
        JOIN households h ON e.household_id = h.household_id
        JOIN location_details l ON h.household_id = l.household_id
        WHERE similarity(ei.product_name_normalized, $1) > 0.4
          AND l.city IS NOT NULL
        GROUP BY l.region, l.city
        HAVING COUNT(*) >= 3
        ORDER BY average_price ASC
      `;
      
      const result = await pool.query(query, [normalized.normalized]);
      
      return {
        product: {
          original: _productName,
          normalized: normalized.normalized,
          brand: normalized.brandRecognized ? normalized.brand : null
        },
        regionalVariations: result.rows
      };
    } catch (error) {
      logger.error('Error finding regional price variations:', error);
      throw error;
    }
  }
  
  /**
   * Generate a natural language response for product comparison
   * @param {Object} analysisResult - Result of product analysis
   * @param {String} userLanguage - User's preferred language
   * @returns {Promise<String>} - Formatted response
   */
  async generateComparisonResponse(analysisResult, userLanguage) {
    try {
      if (!analysisResult || !analysisResult.results || analysisResult.results.length === 0) {
        const noResultsMsg = 'No matching products found for your criteria.';
        
        if (userLanguage !== 'en') {
          return await translateText(noResultsMsg, 'en', userLanguage);
        }
        
        return noResultsMsg;
      }
      
      // Format the top result
      const topResult = analysisResult.results[0];
      const _productName = topResult.product_name_original || topResult.product_name;
      const currency = analysisResult.targetCurrency || topResult.standardized_currency || topResult.currency || 'EUR';
      
      let response;
      
      if (analysisResult.filters && 
          (analysisResult.filters.location.street || 
           analysisResult.filters.demographics.gender)) {
        // Complex filtered result
        const locationDesc = analysisResult.filters.location.street 
          ? `on ${analysisResult.filters.location.street}` 
          : analysisResult.filters.location.district 
            ? `in the ${analysisResult.filters.location.district} district` 
            : analysisResult.filters.location.city 
              ? `in ${analysisResult.filters.location.city}` 
              : '';
        
        const demoDesc = analysisResult.filters.demographics.gender 
          ? `in households with ${analysisResult.filters.demographics.gender}` 
          : '';
        
        const timeDesc = analysisResult.filters.timeframe.startDate 
          ? `in the last ${this.describeTimeframe(analysisResult.filters.timeframe)}` 
          : '';
        
        const amount = topResult.standardized_amount || topResult.amount;
        
        response = `The most expensive ${analysisResult.product.original} ${locationDesc} ${demoDesc} ${timeDesc} costs ${amount.toFixed(2)} ${currency}`;
        
        if (topResult.original_currency && topResult.original_currency !== currency) {
          response += ` (original price: ${topResult.amount.toFixed(2)} ${topResult.original_currency})`;
        }
        
        response += ` purchased at ${topResult.vendor_name || 'unknown vendor'} on ${new Date(topResult.expense_date).toLocaleDateString()}.`;
        
        if (analysisResult.results.length > 1) {
          const avgPrice = analysisResult.results.reduce((sum, item) => sum + parseFloat(item.standardized_amount || item.amount), 0) / analysisResult.results.length;
          response += ` The average price among the top ${analysisResult.results.length} results is ${avgPrice.toFixed(2)} ${currency}.`;
        }
      } else if (topResult.standardized_price_per_unit !== null || topResult.price_per_unit !== null) {
        // Unit price comparison
        const unitType = topResult.standard_unit || topResult.quantity_unit;
        const pricePerUnit = topResult.standardized_price_per_unit || topResult.price_per_unit;
        const amount = topResult.standardized_amount || topResult.amount;
        
        response = `The best price for ${analysisResult.product.original} is ${pricePerUnit.toFixed(2)} ${currency} per ${unitType} (${amount.toFixed(2)} ${currency} for ${topResult.standard_quantity || topResult.quantity_value} ${unitType} at ${topResult.vendor_name || 'unknown vendor'}).`;
        
        if (topResult.original_currency && topResult.original_currency !== currency) {
          response += ` (original price: ${topResult.amount.toFixed(2)} ${topResult.original_currency})`;
        }
        
        if (analysisResult.results.length > 1) {
          const expensiveOption = analysisResult.results[analysisResult.results.length - 1];
          const expensivePerUnit = expensiveOption.standardized_price_per_unit || expensiveOption.price_per_unit;
          
          response += ` The most expensive option costs ${expensivePerUnit.toFixed(2)} ${currency} per ${unitType}, which is ${((expensivePerUnit / pricePerUnit) * 100 - 100).toFixed(0)}% more!`;
        }
      } else {
        // Simple price comparison
        const amount = topResult.standardized_amount || topResult.amount;
        
        response = `The most expensive ${analysisResult.product.original} costs ${amount.toFixed(2)} ${currency}`;
        
        if (topResult.original_currency && topResult.original_currency !== currency) {
          response += ` (original price: ${topResult.amount.toFixed(2)} ${topResult.original_currency})`;
        }
        
        response += ` purchased at ${topResult.vendor_name || 'unknown vendor'} on ${new Date(topResult.expense_date).toLocaleDateString()}.`;
        
        if (analysisResult.results.length > 1) {
          const cheapestOption = analysisResult.results[analysisResult.results.length - 1];
          const cheapestAmount = cheapestOption.standardized_amount || cheapestOption.amount;
          
          response += ` The cheapest option costs ${cheapestAmount.toFixed(2)} ${currency}, which is ${((1 - cheapestAmount / amount) * 100).toFixed(0)}% less!`;
        }
      }
      
      // Translate the response if needed
      if (userLanguage !== 'en') {
        return await translateText(response, 'en', userLanguage);
      }
      
      return response;
    } catch (error) {
      logger.error('Error generating comparison response:', error);
      
      // Fallback response
      const fallbackMsg = 'I found some product matches but had trouble formatting the results.';
      
      if (userLanguage !== 'en') {
        return await translateText(fallbackMsg, 'en', userLanguage);
      }
      
      return fallbackMsg;
    }
  }
  
  /**
   * Generate a description of a timeframe
   * @param {Object} timeframe - Start and end dates
   * @returns {String} - Human-readable timeframe description
   */
  describeTimeframe(timeframe) {
    if (!timeframe.startDate) return '';
    
    const start = new Date(timeframe.startDate);
    const end = timeframe.endDate ? new Date(timeframe.endDate) : new Date();
    
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
    
    if (diffMonths === 1) return 'month';
    if (diffMonths === 3) return '3 months';
    if (diffMonths === 6) return '6 months';
    if (diffMonths === 12) return 'year';
    
    return `${diffMonths} months`;
  }
}

module.exports = new CrossLanguageAnalytics();