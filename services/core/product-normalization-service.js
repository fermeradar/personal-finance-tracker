// src/services/productNormalizer.js
const { Pool } = require('pg');
const { translateText } = require('./translator');
const { detectLanguage } = require('./languageDetector');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Product Normalization Service
 * Handles normalizing product names across languages and standardizing measurements
 */
class ProductNormalizer {
  /**
   * Normalize a product name for cross-language comparison
   * @param {String} productName - Original product name
   * @param {String} language - Language of original name
   * @returns {Promise<Object>} - Normalized name and recognition info
   */
  async normalizeProductName(productName, language) {
    try {
      // Check for brand matches first
      const brandMatch = await this.recognizeBrand(productName);
      
      // Initialize result object
      const result = {
        original: productName,
        normalized: productName,
        language: language || 'en',
        brandRecognized: false,
        confidence: 1.0
      };
      
      // Apply brand normalization if found
      if (brandMatch) {
        result.brandRecognized = true;
        result.brand = brandMatch.standardName;
        
        // Keep brand name in standard form but translate the rest
        const nonBrandText = productName.replace(brandMatch.matchedVariation, '').trim();
        
        if (nonBrandText && language !== 'en') {
          const translatedNonBrand = await translateText(nonBrandText, language, 'en');
          result.normalized = `${brandMatch.standardName} ${translatedNonBrand}`.toLowerCase();
        } else {
          result.normalized = `${brandMatch.standardName} ${nonBrandText}`.toLowerCase();
        }
        
        result.confidence = 0.9; // High confidence for brand matches
      } else {
        // No brand match, translate entire name if not English
        if (language && language !== 'en') {
          const translatedName = await translateText(productName, language, 'en');
          result.normalized = translatedName.toLowerCase();
          result.confidence = 0.7; // Medium confidence for translation
        } else {
          result.normalized = productName.toLowerCase();
        }
      }
      
      // Clean up normalized name
      result.normalized = this.cleanProductName(result.normalized);
      
      return result;
    } catch (error) {
      console.error('Error normalizing product name:', error);
      // Return basic normalization (lowercase) in case of error
      return {
        original: productName,
        normalized: productName.toLowerCase(),
        language: language || 'en',
        brandRecognized: false,
        confidence: 0.5
      };
    }
  }
  
  /**
   * Clean a product name for better matching
   * @param {String} name - Product name to clean
   * @returns {String} - Cleaned product name
   */
  cleanProductName(name) {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')        // Replace multiple spaces with single space
      .replace(/[^\w\s-]/g, '')    // Remove special characters except spaces and hyphens
      .trim();
  }
  
  /**
   * Check if a product name contains a recognized brand
   * @param {String} productName - Product name to check
   * @returns {Promise<Object|null>} - Brand match info or null if no match
   */
  async recognizeBrand(productName) {
    try {
      // Get all brands from dictionary
      const brandResult = await pool.query(
        'SELECT * FROM brand_dictionary'
      );
      
      const lowerProduct = productName.toLowerCase();
      
      // Check each brand and its variations
      for (const brand of brandResult.rows) {
        // Check standard name
        if (lowerProduct.includes(brand.standard_name.toLowerCase())) {
          return {
            brandId: brand.brand_id,
            standardName: brand.standard_name,
            matchedVariation: brand.standard_name,
            category: brand.category
          };
        }
        
        // Check variations
        const variations = brand.variations || [];
        for (const variation of variations) {
          if (lowerProduct.includes(variation.toLowerCase())) {
            return {
              brandId: brand.brand_id,
              standardName: brand.standard_name,
              matchedVariation: variation,
              category: brand.category
            };
          }
        }
      }
      
      return null; // No brand match found
    } catch (error) {
      console.error('Error recognizing brand:', error);
      return null;
    }
  }
  
  /**
   * Add a new brand to the dictionary
   * @param {String} brandName - Primary brand name
   * @param {String} standardName - Normalized form of the brand
   * @param {Array} variations - Alternative names for the brand
   * @param {String} category - Product category
   * @returns {Promise<Object>} - Created brand entry
   */
  async addBrand(brandName, standardName, variations = [], category = null) {
    try {
      const result = await pool.query(
        `INSERT INTO brand_dictionary(brand_name, standard_name, variations, category, created_at)
         VALUES($1, $2, $3, $4, NOW())
         RETURNING *`,
        [brandName, standardName, JSON.stringify(variations), category]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error adding brand:', error);
      throw error;
    }
  }
  
  /**
   * Convert quantity to standard unit
   * @param {Number} value - Quantity value
   * @param {String} unit - Original unit
   * @param {String} quantityType - Type of quantity (weight, volume, etc.)
   * @returns {Promise<Object>} - Conversion result
   */
  async standardizeQuantity(value, unit, quantityType = null) {
    try {
      // If unit is already in standard form, return as is
      if (!unit) {
        return { 
          original: { value, unit }, 
          standardized: { value, unit: null },
          converted: false 
        };
      }
      
      // Normalize unit spelling
      const normalizedUnit = this.normalizeUnit(unit);
      
      // Determine quantity type if not provided
      if (!quantityType) {
        const typeResult = await pool.query(
          `SELECT DISTINCT quantity_type
           FROM unit_conversions
           WHERE from_unit = $1`,
          [normalizedUnit]
        );
        
        if (typeResult.rows.length > 0) {
          quantityType = typeResult.rows[0].quantity_type;
        } else {
          return { 
            original: { value, unit }, 
            standardized: { value, unit: normalizedUnit },
            converted: false 
          };
        }
      }
      
      // Get standard unit for this quantity type
      const standardResult = await pool.query(
        'SELECT standard_unit FROM standard_units WHERE unit_type = $1',
        [quantityType]
      );
      
      if (standardResult.rows.length === 0) {
        return { 
          original: { value, unit }, 
          standardized: { value, unit: normalizedUnit },
          converted: false 
        };
      }
      
      const standardUnit = standardResult.rows[0].standard_unit;
      
      // If already in standard unit, return as is
      if (normalizedUnit === standardUnit) {
        return { 
          original: { value, unit }, 
          standardized: { value, unit: standardUnit },
          converted: false 
        };
      }
      
      // Get conversion factor
      const conversionResult = await pool.query(
        `SELECT conversion_factor
         FROM unit_conversions
         WHERE from_unit = $1 AND to_unit = $2`,
        [normalizedUnit, standardUnit]
      );
      
      if (conversionResult.rows.length === 0) {
        // No direct conversion, try two-step conversion
        const indirectResult = await pool.query(
          `SELECT from_unit, to_unit, conversion_factor
           FROM unit_conversions
           WHERE (from_unit = $1 OR to_unit = $2) AND quantity_type = $3`,
          [normalizedUnit, standardUnit, quantityType]
        );
        
        // Process indirect conversions
        const conversionPath = this.findConversionPath(
          indirectResult.rows,
          normalizedUnit,
          standardUnit
        );
        
        if (conversionPath) {
          let convertedValue = value;
          
          for (const step of conversionPath) {
            convertedValue *= step.factor;
          }
          
          return {
            original: { value, unit },
            standardized: { value: convertedValue, unit: standardUnit },
            converted: true,
            path: conversionPath
          };
        } else {
          return { 
            original: { value, unit }, 
            standardized: { value, unit: normalizedUnit },
            converted: false 
          };
        }
      } else {
        // Direct conversion
        const factor = conversionResult.rows[0].conversion_factor;
        const convertedValue = value * factor;
        
        return {
          original: { value, unit },
          standardized: { value: convertedValue, unit: standardUnit },
          converted: true,
          factor
        };
      }
    } catch (error) {
      console.error('Error standardizing quantity:', error);
      return { 
        original: { value, unit }, 
        standardized: { value, unit },
        converted: false,
        error: error.message
      };
    }
  }
  
  /**
   * Normalize unit spelling variations
   * @param {String} unit - Unit to normalize
   * @returns {String} - Normalized unit
   */
  normalizeUnit(unit) {
    if (!unit) return unit;
    
    const normalized = unit.toLowerCase().trim();
    
    // Common unit variations
    const unitMap = {
      'kg': ['kilogram', 'kilograms', 'kilo', 'kilos', 'кг', 'килограмм', 'килограммы'],
      'g': ['gram', 'grams', 'gramme', 'grammes', 'г', 'грамм', 'граммы'],
      'l': ['liter', 'liters', 'litre', 'litres', 'л', 'литр', 'литры'],
      'ml': ['milliliter', 'milliliters', 'millilitre', 'millilitres', 'мл', 'миллилитр'],
      'oz': ['ounce', 'ounces', 'унция', 'унции'],
      'oz-fl': ['fluid ounce', 'fluid ounces', 'fl oz', 'жидкая унция'],
      'lb': ['pound', 'pounds', 'фунт', 'фунты'],
      'pc': ['piece', 'pieces', 'шт', 'штука', 'штуки']
    };
    
    // Check for matches in unit map
    for (const [standard, variations] of Object.entries(unitMap)) {
      if (variations.includes(normalized)) {
        return standard;
      }
    }
    
    return normalized;
  }
  
  /**
   * Find conversion path between units through multiple steps
   * @param {Array} conversions - Available conversion steps
   * @param {String} fromUnit - Starting unit
   * @param {String} toUnit - Target unit
   * @returns {Array|null} - Conversion path or null if no path found
   */
  findConversionPath(conversions, fromUnit, toUnit) {
    // Build conversion graph
    const graph = {};
    
    for (const conversion of conversions) {
      if (!graph[conversion.from_unit]) {
        graph[conversion.from_unit] = [];
      }
      
      if (!graph[conversion.to_unit]) {
        graph[conversion.to_unit] = [];
      }
      
      graph[conversion.from_unit].push({
        unit: conversion.to_unit,
        factor: conversion.conversion_factor
      });
      
      // Add reverse path with inverse factor
      graph[conversion.to_unit].push({
        unit: conversion.from_unit,
        factor: 1 / conversion.conversion_factor
      });
    }
    
    // BFS to find shortest path
    const queue = [{ unit: fromUnit, path: [] }];
    const visited = new Set([fromUnit]);
    
    while (queue.length > 0) {
      const { unit, path } = queue.shift();
      
      if (unit === toUnit) {
        return path;
      }
      
      if (!graph[unit]) continue;
      
      for (const neighbor of graph[unit]) {
        if (!visited.has(neighbor.unit)) {
          visited.add(neighbor.unit);
          queue.push({
            unit: neighbor.unit,
            path: [...path, { from: unit, to: neighbor.unit, factor: neighbor.factor }]
          });
        }
      }
    }
    
    return null; // No path found
  }
  
  /**
   * Process a product item for storage with proper normalization
   * @param {Object} item - Product item data
   * @returns {Promise<Object>} - Processed item ready for storage
   */
  async processProductItem(item) {
    try {
      // Detect language if not provided
      const language = item.language || await detectLanguage(item.product_name);
      
      // Normalize product name
      const normalizedProduct = await this.normalizeProductName(item.product_name, language);
      
      // Standardize quantity if provided
      let standardizedQuantity = null;
      
      if (item.quantity_value && item.quantity_unit) {
        standardizedQuantity = await this.standardizeQuantity(
          item.quantity_value,
          item.quantity_unit,
          this.guessQuantityTypeFromUnit(item.quantity_unit)
        );
      }
      
      // Create processed item
      const processedItem = {
        ...item,
        product_name_original: item.product_name,
        product_name: normalizedProduct.normalized,
        product_name_normalized: normalizedProduct.normalized,
        original_language: language,
        brand: normalizedProduct.brandRecognized ? normalizedProduct.brand : null
      };
      
      // Add standardized quantity if available
      if (standardizedQuantity && standardizedQuantity.converted) {
        processedItem.standard_quantity = standardizedQuantity.standardized.value;
        processedItem.standard_unit = standardizedQuantity.standardized.unit;
      }
      
      return processedItem;
    } catch (error) {
      console.error('Error processing product item:', error);
      // Return original item in case of error
      return {
        ...item,
        product_name_original: item.product_name,
        original_language: item.language || 'en'
      };
    }
  }
  
  /**
   * Guess quantity type based on unit
   * @param {String} unit - Unit to analyze
   * @returns {String|null} - Quantity type or null if unknown
   */
  guessQuantityTypeFromUnit(unit) {
    if (!unit) return null;
    
    const normalized = this.normalizeUnit(unit);
    
    // Common unit types
    const weightUnits = ['kg', 'g', 'oz', 'lb'];
    const volumeUnits = ['l', 'ml', 'oz-fl', 'gal', 'pt'];
    const lengthUnits = ['m', 'cm', 'in', 'ft'];
    const areaUnits = ['m2', 'cm2', 'in2', 'ft2'];
    const countUnits = ['pc', 'pcs', 'шт'];
    
    if (weightUnits.includes(normalized)) return 'weight';
    if (volumeUnits.includes(normalized)) return 'volume';
    if (lengthUnits.includes(normalized)) return 'length';
    if (areaUnits.includes(normalized)) return 'area';
    if (countUnits.includes(normalized)) return 'piece';
    
    return null;
  }
}

module.exports = new ProductNormalizer();
