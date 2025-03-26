const logger = require('../core/logger-utility');
// src/services/locationIntelligence.js
const { Pool } = require('pg');
const productNormalizer = require('./productNormalizer');
const currencyConverter = require('./currencyConverter');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Enhanced Location Intelligence Service
 * Provides advanced location-based analytics and insights
 */
class LocationIntelligence {
  /**
   * Find or create a retailer record
   * @param {String} retailerName - Name of the retailer
   * @param {Boolean} isGlobalChain - Whether this is a global chain
   * @returns {Promise<Object>} - Retailer record
   */
  async findOrCreateRetailer(retailerName, isGlobalChain = false) {
    try {
      if (!retailerName) return null;
      
      // Normalize retailer name
      const normalizedName = retailerName.toLowerCase().trim();
      
      // Check if retailer exists
      const existingResult = await pool.query(
        'SELECT * FROM retailers WHERE name_normalized = $1',
        [normalizedName]
      );
      
      if (existingResult.rows.length > 0) {
        return existingResult.rows[0];
      }
      
      // Create new retailer
      const insertResult = await pool.query(`
        INSERT INTO retailers(
          name, name_normalized, global_chain, created_at
        )
        VALUES($1, $2, $3, NOW())
        RETURNING *
      `, [retailerName, normalizedName, isGlobalChain]);
      
      return insertResult.rows[0];
    } catch (error) {
      logger.error('Error finding or creating retailer:', error);
      return null;
    }
  }
  
  /**
   * Add a variation to a retailer's known names
   * @param {Number} retailerId - Retailer ID
   * @param {String} variation - Variation of the retailer name
   * @returns {Promise<Boolean>} - Success flag
   */
  async addRetailerVariation(retailerId, variation) {
    try {
      // Get current variations
      const retailerResult = await pool.query(
        'SELECT name_variations FROM retailers WHERE retailer_id = $1',
        [retailerId]
      );
      
      if (retailerResult.rows.length === 0) {
        return false;
      }
      
      // Add variation if it doesn't exist
      const currentVariations = retailerResult.rows[0].name_variations || [];
      const normalizedVariation = variation.toLowerCase().trim();
      
      if (!currentVariations.includes(normalizedVariation)) {
        const updatedVariations = [...currentVariations, normalizedVariation];
        
        await pool.query(`
          UPDATE retailers
          SET name_variations = $1
          WHERE retailer_id = $2
        `, [JSON.stringify(updatedVariations), retailerId]);
      }
      
      return true;
    } catch (error) {
      logger.error('Error adding retailer variation:', error);
      return false;
    }
  }
  
  /**
   * Find a retail location or create a new record
   * @param {Number} retailerId - Retailer ID
   * @param {Object} locationData - Location details
   * @returns {Promise<Object>} - Location record
   */
  async findOrCreateRetailLocation(retailerId, locationData) {
    try {
      if (!retailerId) return null;
      
      // Check for existing location
      let query = `
        SELECT * FROM retail_locations
        WHERE retailer_id = $1
      `;
      
      const params = [retailerId];
      let paramIndex = 2;
      
      // Add address filters if available
      if (locationData.postal_code) {
        query += ` AND postal_code = $${paramIndex}`;
        params.push(locationData.postal_code);
        paramIndex++;
      }
      
      if (locationData.city) {
        query += ` AND city = $${paramIndex}`;
        params.push(locationData.city);
        paramIndex++;
      }
      
      if (locationData.address_line1) {
        query += ` AND address_line1 = $${paramIndex}`;
        params.push(locationData.address_line1);
        paramIndex++;
      }
      
      // Add coordinates if available
      if (locationData.latitude && locationData.longitude) {
        // Find locations within a small radius
        query += ` AND 
          ST_DistanceSphere(
            ST_MakePoint(longitude, latitude),
            ST_MakePoint($${paramIndex}, $${paramIndex+1})
          ) < 100`; // 100 meters
        params.push(locationData.longitude, locationData.latitude);
        paramIndex += 2;
      }
      
      const existingResult = await pool.query(query, params);
      
      if (existingResult.rows.length > 0) {
        return existingResult.rows[0];
      }
      
      // Create new location
      const insertFields = ['retailer_id'];
      const insertValues = [retailerId];
      const insertParams = ['$1'];
      
      let fieldIndex = 2;
      
      // Add all available fields
      const availableFields = [
        'address_line1', 'address_line2', 'postal_code', 'city', 
        'district', 'region', 'country', 'latitude', 'longitude',
        'store_type', 'price_tier'
      ];
      
      for (const field of availableFields) {
        if (locationData[field] !== undefined) {
          insertFields.push(field);
          insertValues.push(locationData[field]);
          insertParams.push(`$${fieldIndex}`);
          fieldIndex++;
        }
      }
      
      const insertQuery = `
        INSERT INTO retail_locations(${insertFields.join(', ')}, created_at)
        VALUES(${insertParams.join(', ')}, NOW())
        RETURNING *
      `;
      
      const insertResult = await pool.query(insertQuery, insertValues);
      
      return insertResult.rows[0];
    } catch (error) {
      logger.error('Error finding or creating retail location:', error);
      return null;
    }
  }
  
  /**
   * Identify the neighborhood for a location
   * @param {Number} latitude - Latitude coordinate
   * @param {Number} longitude - Longitude coordinate
   * @returns {Promise<Object|null>} - Neighborhood information if found
   */
  async identifyNeighborhood(latitude, longitude) {
    try {
      // This requires PostGIS extension in PostgreSQL
      const query = `
        SELECT * FROM neighborhood_data
        WHERE ST_Contains(
          ST_GeomFromGeoJSON(coordinates_polygon),
          ST_SetSRID(ST_MakePoint($1, $2), 4326)
        )
        LIMIT 1
      `;
      
      const result = await pool.query(query, [longitude, latitude]);
      
      if (result.rows.length > 0) {
        return result.rows[0];
      }
      
      // Fallback to approximate matching if no exact polygon match
      const fallbackQuery = `
        SELECT 
          *,
          ST_Distance(
            ST_Centroid(ST_GeomFromGeoJSON(coordinates_polygon)),
            ST_SetSRID(ST_MakePoint($1, $2), 4326)
          ) as distance
        FROM neighborhood_data
        ORDER BY distance ASC
        LIMIT 1
      `;
      
      const fallbackResult = await pool.query(fallbackQuery, [longitude, latitude]);
      
      if (fallbackResult.rows.length > 0 && fallbackResult.rows[0].distance < 0.05) { // ~5km
        return {
          ...fallbackResult.rows[0],
          approximate: true
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Error identifying neighborhood:', error);
      return null;
    }
  }
  
  /**
   * Get retailer price index (how expensive the retailer is compared to average)
   * @param {Number} retailerId - Retailer ID
   * @param {String} locationId - Optional specific location ID
   * @param {String} productCategory - Optional product category
   * @returns {Promise<Object>} - Price index information
   */
  async getRetailerPriceIndex(retailerId, locationId = null, productCategory = null) {
    try {
      let query = `
        SELECT 
          r.name as retailer_name,
          AVG(rpi.price_index) as average_price_index,
          COUNT(DISTINCT rpi.product_category) as category_count
        FROM retailer_price_index rpi
        JOIN retailers r ON rpi.retailer_id = r.retailer_id
        WHERE rpi.retailer_id = $1
      `;
      
      const params = [retailerId];
      let paramIndex = 2;
      
      if (locationId) {
        query += ` AND rpi.location_id = $${paramIndex}`;
        params.push(locationId);
        paramIndex++;
      }
      
      if (productCategory) {
        query += ` AND rpi.product_category = $${paramIndex}`;
        params.push(productCategory);
        paramIndex++;
      }
      
      query += `
        GROUP BY r.name
        ORDER BY average_price_index DESC
      `;
      
      const result = await pool.query(query, params);
      
      if (result.rows.length > 0) {
        return {
          retailerId,
          locationId,
          priceIndex: result.rows[0].average_price_index,
          categoryCount: result.rows[0].category_count,
          interpretation: this.interpretPriceIndex(result.rows[0].average_price_index)
        };
      }
      
      // If no specific data, get overall retailer average
      if (locationId || productCategory) {
        return this.getRetailerPriceIndex(retailerId);
      }
      
      return {
        retailerId,
        priceIndex: 100, // Neutral if no data
        estimated: true,
        interpretation: 'Average priced'
      };
    } catch (error) {
      logger.error('Error getting retailer price index:', error);
      return {
        retailerId,
        priceIndex: 100,
        error: true,
        interpretation: 'Unknown pricing'
      };
    }
  }
  
  /**
   * Interpret a price index value into a human-readable description
   * @param {Number} priceIndex - Price index value
   * @returns {String} - Human-readable interpretation
   */
  interpretPriceIndex(priceIndex) {
    if (priceIndex < 85) return 'Very budget-friendly';
    if (priceIndex < 95) return 'Affordable';
    if (priceIndex < 105) return 'Average priced';
    if (priceIndex < 115) return 'Somewhat premium';
    if (priceIndex < 130) return 'Premium';
    return 'Luxury pricing';
  }
  
  /**
   * Detect if a purchase might include a "tourist premium"
   * @param {Object} expense - Expense data
   * @param {Object} locationData - Location information
   * @returns {Promise<Object|null>} - Tourist premium information if detected
   */
  async detectTouristPremium(expense, locationData) {
    try {
      if (!expense.category_id || !locationData.city) {
        return null;
      }
      
      // Get category name
      const categoryResult = await pool.query(
        'SELECT name FROM categories WHERE category_id = $1',
        [expense.category_id]
      );
      
      if (categoryResult.rows.length === 0) {
        return null;
      }
      
      const category = categoryResult.rows[0].name;
      
      // Find any tourist premium data for this location and category
      const query = `
        SELECT * FROM tourist_price_differentials
        WHERE city = $1
          AND product_category = $2
          AND effective_date <= $3
        ORDER BY 
          CASE WHEN district = $4 THEN 0 ELSE 1 END,
          effective_date DESC
        LIMIT 1
      `;
      
      const result = await pool.query(query, [
        locationData.city, 
        category,
        expense.expense_date,
        locationData.district || ''
      ]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const premium = result.rows[0];
      
      // Calculate if this purchase might have a tourist premium
      const localPrice = premium.local_price_avg;
      const touristPrice = premium.tourist_price_avg;
      const premiumPercent = premium.tourist_premium_percent;
      
      // Convert expense amount to comparison currency if needed
      let compareAmount = expense.amount;
      if (expense.currency !== 'EUR') {
        const conversion = await currencyConverter.convertAmount(
          expense.amount,
          expense.currency,
          'EUR',
          new Date(expense.expense_date)
        );
        compareAmount = conversion.convertedAmount;
      }
      
      // Check if this expense is closer to tourist pricing than local pricing
      const touristProbability = this.calculateTouristPriceProbability(
        compareAmount, 
        localPrice, 
        touristPrice
      );
      
      if (touristProbability > 0.7) {
        return {
          detected: true,
          probability: touristProbability,
          localPriceAvg: localPrice,
          touristPriceAvg: touristPrice,
          premiumPercent: premiumPercent,
          potentialSavings: compareAmount - localPrice,
          potentialSavingsPercent: ((compareAmount - localPrice) / compareAmount) * 100,
          advice: this.generateTouristPremiumAdvice(touristProbability, category, locationData.city)
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Error detecting tourist premium:', error);
      return null;
    }
  }
  
  /**
   * Calculate the probability that a price represents tourist pricing
   * @param {Number} actualPrice - The price paid
   * @param {Number} localPrice - Average local price
   * @param {Number} touristPrice - Average tourist price
   * @returns {Number} - Probability between 0 and 1
   */
  calculateTouristPriceProbability(actualPrice, localPrice, touristPrice) {
    // If price is below local average, it's not a tourist price
    if (actualPrice <= localPrice) {
      return 0;
    }
    
    // If price is above tourist average, it's very likely a tourist price
    if (actualPrice >= touristPrice) {
      return 0.95;
    }
    
    // Calculate where between local and tourist pricing this falls
    const priceRange = touristPrice - localPrice;
    if (priceRange <= 0) {
      return 0;
    }
    
    const position = (actualPrice - localPrice) / priceRange;
    return 0.5 + (position * 0.45); // Scale to between 0.5 and 0.95
  }
  
  /**
   * Generate advice for avoiding tourist premium prices
   * @param {Number} probability - Probability of tourist pricing
   * @param {String} category - Product category
   * @param {String} city - City name
   * @returns {String} - Advice text
   */
  generateTouristPremiumAdvice(probability, category, city) {
    if (probability > 0.9) {
      return `You likely paid tourist prices for ${category} in ${city}. Try shopping where locals go, a few blocks away from major attractions.`;
    }
    
    if (probability > 0.7) {
      return `You may have paid a slight tourist premium for ${category}. Consider exploring local neighborhoods for better prices.`;
    }
    
    return `Your ${category} purchase in ${city} was somewhat higher than local prices. Check local markets or shops for potentially better deals.`;
  }
  
  /**
   * Analyze geographic price variations for a product
   * @param {String} productName - Product name
   * @param {String} productLanguage - Language of product name
   * @param {Object} filters - Additional filters
   * @returns {Promise<Object>} - Geographic price analysis
   */
  async analyzeGeographicPriceVariations(productName, productLanguage, filters = {}) {
    try {
      // Normalize product name
      const normalized = await productNormalizer.normalizeProductName(productName, productLanguage);
      
      // Base query
      let query = `
        WITH product_expenses AS (
          SELECT 
            e.expense_id,
            e.amount,
            e.currency,
            e.expense_date,
            rl.city,
            rl.district,
            rl.region,
            rl.country,
            r.name as retailer_name,
            r.retailer_id
          FROM expense_items ei
          JOIN expenses e ON ei.expense_id = e.expense_id
          LEFT JOIN retailers r ON e.retailer_id = r.retailer_id
          LEFT JOIN retail_locations rl ON e.location_id = rl.location_id
          WHERE similarity(ei.product_name_normalized, $1) > 0.4
        )
        SELECT 
          COALESCE(city, region, country) as location,
          COUNT(*) as purchase_count,
          AVG(amount) as average_price,
          MIN(amount) as min_price,
          MAX(amount) as max_price,
          STRING_AGG(DISTINCT retailer_name, ', ') as retailers,
          CASE 
            WHEN city IS NOT NULL THEN 'city'
            WHEN region IS NOT NULL THEN 'region'
            ELSE 'country'
          END as location_type,
          currency
        FROM product_expenses
        WHERE 1=1
      `;
      
      const params = [normalized.normalized];
      let paramIndex = 2;
      
      // Add filters
      if (filters.country) {
        query += ` AND country = ${paramIndex}`;
        params.push(filters.country);
        paramIndex++;
      }
      
      if (filters.timeframe) {
        const monthsAgo = parseInt(filters.timeframe) || 3;
        query += ` AND expense_date >= NOW() - INTERVAL '${monthsAgo} months'`;
      }
      
      // Group by and order
      query += `
        GROUP BY location, location_type, currency
        HAVING COUNT(*) >= 3
        ORDER BY purchase_count DESC, average_price ASC
      `;
      
      const result = await pool.query(query, params);
      
      // Standardize currencies if needed
      const targetCurrency = filters.currency || 'EUR';
      let standardizedResults = [];
      
      for (const row of result.rows) {
        if (row.currency === targetCurrency) {
          standardizedResults.push({
            ...row,
            standardized_avg_price: parseFloat(row.average_price),
            standardized_min_price: parseFloat(row.min_price),
            standardized_max_price: parseFloat(row.max_price),
            standardized_currency: targetCurrency
          });
        } else {
          try {
            const avgConversion = await currencyConverter.convertAmount(
              parseFloat(row.average_price),
              row.currency,
              targetCurrency
            );
            
            const minConversion = await currencyConverter.convertAmount(
              parseFloat(row.min_price),
              row.currency,
              targetCurrency
            );
            
            const maxConversion = await currencyConverter.convertAmount(
              parseFloat(row.max_price),
              row.currency,
              targetCurrency
            );
            
            standardizedResults.push({
              ...row,
              standardized_avg_price: avgConversion.convertedAmount,
              standardized_min_price: minConversion.convertedAmount,
              standardized_max_price: maxConversion.convertedAmount,
              standardized_currency: targetCurrency,
              exchange_rate: avgConversion.exchangeRate
            });
          } catch (error) {
            logger.error('Error converting currency:', error);
            standardizedResults.push({
              ...row,
              standardized_avg_price: null,
              standardized_min_price: null,
              standardized_max_price: null,
              standardized_currency: targetCurrency,
              conversion_error: true
            });
          }
        }
      }
      
      // Sort by standardized price
      standardizedResults.sort((a, b) => {
        if (a.standardized_avg_price === null) return 1;
        if (b.standardized_avg_price === null) return -1;
        return a.standardized_avg_price - b.standardized_avg_price;
      });
      
      return {
        product: {
          original: productName,
          normalized: normalized.normalized,
          brand: normalized.brandRecognized ? normalized.brand : null
        },
        targetCurrency,
        geographicVariations: standardizedResults
      };
    } catch (error) {
      logger.error('Error analyzing geographic price variations:', error);
      throw error;
    }
  }
  
  /**
   * Get retailer recommendations for a product
   * @param {String} productName - Product name
   * @param {String} productLanguage - Language of product name
   * @param {Object} locationData - User's location
   * @returns {Promise<Object>} - Retailer recommendations
   */
  async getRetailerRecommendations(productName, productLanguage, locationData) {
    try {
      // Normalize product name
      const normalized = await productNormalizer.normalizeProductName(productName, productLanguage);
      
      // Find product purchases in the local area
      let query = `
        WITH product_expenses AS (
          SELECT 
            e.expense_id,
            e.amount,
            e.currency,
            e.expense_date,
            e.retailer_id,
            r.name as retailer_name,
            rl.city,
            rl.district
          FROM expense_items ei
          JOIN expenses e ON ei.expense_id = e.expense_id
          LEFT JOIN retailers r ON e.retailer_id = r.retailer_id
          LEFT JOIN retail_locations rl ON e.location_id = rl.location_id
          WHERE similarity(ei.product_name_normalized, $1) > 0.4
        )
        SELECT 
          retailer_id,
          retailer_name,
          COUNT(*) as purchase_count,
          AVG(amount) as average_price,
          MIN(amount) as min_price,
          MAX(amount) as max_price,
          currency
        FROM product_expenses
        WHERE 1=1
      `;
      
      const params = [normalized.normalized];
      let paramIndex = 2;
      
      // Add location filters if available
      if (locationData.city) {
        query += ` AND city = ${paramIndex}`;
        params.push(locationData.city);
        paramIndex++;
      }
      
      if (locationData.district) {
        query += ` AND district = ${paramIndex}`;
        params.push(locationData.district);
        paramIndex++;
      }
      
      // Complete the query
      query += `
        GROUP BY retailer_id, retailer_name, currency
        HAVING COUNT(*) >= 2
        ORDER BY average_price ASC
      `;
      
      const result = await pool.query(query, params);
      
      // If no results in local area, try wider search
      if (result.rows.length === 0 && locationData.city) {
        // Try without district filter
        return this.getRetailerRecommendations(productName, productLanguage, {
          city: locationData.city
        });
      }
      
      // If still no results, try without location filters
      if (result.rows.length === 0) {
        return this.getRetailerRecommendations(productName, productLanguage, {});
      }
      
      // Get price index for each retailer
      const retailersWithIndex = [];
      
      for (const row of result.rows) {
        if (row.retailer_id) {
          const priceIndex = await this.getRetailerPriceIndex(row.retailer_id);
          retailersWithIndex.push({
            ...row,
            price_index: priceIndex.priceIndex,
            price_interpretation: priceIndex.interpretation
          });
        } else {
          retailersWithIndex.push(row);
        }
      }
      
      return {
        product: {
          original: productName,
          normalized: normalized.normalized,
          brand: normalized.brandRecognized ? normalized.brand : null
        },
        location: locationData,
        recommendations: retailersWithIndex
      };
    } catch (error) {
      logger.error('Error getting retailer recommendations:', error);
      throw error;
    }
  }
  
  /**
   * Process location information from a document
   * @param {Object} documentData - Extracted document data
   * @param {String} documentType - Type of document
   * @returns {Promise<Object>} - Processed location data
   */
  async processLocationFromDocument(documentData, documentType) {
    try {
      // Extract location data based on document type
      let locationData = {};
      
      if (documentType === 'receipt') {
        // Try to extract from receipt
        locationData = this.extractLocationFromReceipt(documentData);
      } else if (documentType === 'utility_bill') {
        // Extract from utility bill
        locationData = this.extractLocationFromUtilityBill(documentData);
      } else if (documentType === 'bank_statement') {
        // Extract from transaction data
        locationData = this.extractLocationFromBankStatement(documentData);
      }
      
      // If we have a vendor/retailer name, process it
      let retailerId = null;
      let locationId = null;
      
      if (locationData.retailer) {
        const retailer = await this.findOrCreateRetailer(locationData.retailer);
        if (retailer) {
          retailerId = retailer.retailer_id;
          
          // Create retail location if we have enough data
          if (locationData.city || locationData.address_line1) {
            const location = await this.findOrCreateRetailLocation(retailerId, locationData);
            if (location) {
              locationId = location.location_id;
            }
          }
        }
      }
      
      return {
        ...locationData,
        retailerId,
        locationId,
        confidence: this.calculateLocationConfidence(locationData, documentType)
      };
    } catch (error) {
      logger.error('Error processing location from document:', error);
      return null;
    }
  }
  
  /**
   * Extract location data from a receipt
   * @param {Object} receiptData - Extracted receipt data
   * @returns {Object} - Location data
   */
  extractLocationFromReceipt(receiptData) {
    const locationData = {};
    
    // Extract retailer name
    if (receiptData.merchant || receiptData.vendor || receiptData.store) {
      locationData.retailer = receiptData.merchant || receiptData.vendor || receiptData.store;
    }
    
    // Extract address components
    if (receiptData.address) {
      locationData.address_line1 = receiptData.address;
      
      // Try to extract city from address
      const cityMatch = receiptData.address.match(/,\s*([^,]+)$/);
      if (cityMatch) {
        locationData.city = cityMatch[1].trim();
      }
    }
    
    // Extract city directly if available
    if (receiptData.city) {
      locationData.city = receiptData.city;
    }
    
    // Extract postal code
    if (receiptData.zip || receiptData.postal_code) {
      locationData.postal_code = receiptData.zip || receiptData.postal_code;
    }
    
    // Extract country
    if (receiptData.country) {
      locationData.country = receiptData.country;
    }
    
    return locationData;
  }
  
  /**
   * Extract location data from a utility bill
   * @param {Object} billData - Extracted bill data
   * @returns {Object} - Location data
   */
  extractLocationFromUtilityBill(billData) {
    const locationData = {};
    
    // Extract service provider
    if (billData.provider || billData.company) {
      locationData.retailer = billData.provider || billData.company;
    }
    
    // Extract service address
    if (billData.service_address) {
      locationData.address_line1 = billData.service_address;
    } else if (billData.address) {
      locationData.address_line1 = billData.address;
    }
    
    // Extract detailed address components if available
    if (billData.city) locationData.city = billData.city;
    if (billData.region || billData.state || billData.province) {
      locationData.region = billData.region || billData.state || billData.province;
    }
    if (billData.postal_code || billData.zip) {
      locationData.postal_code = billData.postal_code || billData.zip;
    }
    if (billData.country) locationData.country = billData.country;
    
    return locationData;
  }
  
  /**
   * Extract location data from a bank statement
   * @param {Object} statementData - Extracted statement data
   * @returns {Object} - Location data
   */
  extractLocationFromBankStatement(statementData) {
    const locationData = {};
    
    // For bank statements, we're mostly looking at transaction data
    if (statementData.transactions && Array.isArray(statementData.transactions)) {
      // Try to extract merchant names from transactions
      const merchants = statementData.transactions
        .filter(t => t.merchant || t.description)
        .map(t => t.merchant || this.extractMerchantFromDescription(t.description))
        .filter(Boolean);
      
      if (merchants.length > 0) {
        // Use the most frequent merchant
        const merchantCounts = {};
        merchants.forEach(m => {
          merchantCounts[m] = (merchantCounts[m] || 0) + 1;
        });
        
        let topMerchant = null;
        let topCount = 0;
        
        for (const [merchant, count] of Object.entries(merchantCounts)) {
          if (count > topCount) {
            topMerchant = merchant;
            topCount = count;
          }
        }
        
        if (topMerchant) {
          locationData.retailer = topMerchant;
        }
      }
    }
    
    // Extract bank location if available
    if (statementData.bank_address) {
      locationData.address_line1 = statementData.bank_address;
    }
    
    if (statementData.bank_city) {
      locationData.city = statementData.bank_city;
    }
    
    return locationData;
  }
  
  /**
   * Extract merchant name from transaction description
   * @param {String} description - Transaction description
   * @returns {String|null} - Merchant name if found
   */
  extractMerchantFromDescription(description) {
    if (!description) return null;
    
    // Common patterns in bank transaction descriptions
    const patterns = [
      /POS\s+(.+?)\s+\d{2}\/\d{2}\/\d{2,4}/i,    // POS MERCHANT NAME 01/02/2023
      /PURCHASE\s+(.+?)\s+\d{2}\/\d{2}\/\d{2,4}/i, // PURCHASE MERCHANT NAME 01/02/2023
      /PAYMENT\s+TO\s+(.+?)\s+REF/i,             // PAYMENT TO MERCHANT NAME REF
      /PAYPAL\s+\*(.+?)$/i,                       // PAYPAL *MERCHANT
      /\*\s*(.+?)\s*\d{2}\/\d{2}/i                // * MERCHANT NAME 01/02
    ];
    
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // If no patterns match, return the first word if it looks like a merchant name
    const firstWord = description.split(/\s+/)[0];
    if (firstWord && firstWord.length > 3 && !/^\d+$/.test(firstWord)) {
      return firstWord;
    }
    
    return null;
  }
  
  /**
   * Calculate confidence score for extracted location data
   * @param {Object} locationData - Extracted location data
   * @param {String} documentType - Source document type
   * @returns {Number} - Confidence score (0-100)
   */
  calculateLocationConfidence(locationData, documentType) {
    let confidence = 0;
    
    // Base confidence by document type
    if (documentType === 'receipt') {
      confidence = 70; // Receipts usually have reliable location info
    } else if (documentType === 'utility_bill') {
      confidence = 90; // Utility bills have very reliable location data
    } else if (documentType === 'bank_statement') {
      confidence = 40; // Bank statements have less reliable location data
    } else {
      confidence = 50; // Default for other document types
    }
    
    // Adjust based on available fields
    if (locationData.retailer) confidence += 10;
    if (locationData.address_line1) confidence += 10;
    if (locationData.city) confidence += 10;
    if (locationData.postal_code) confidence += 15;
    if (locationData.country) confidence += 5;
    
    // Cap at 100
    return Math.min(confidence, 100);
  }
}

module.exports = new LocationIntelligence();
