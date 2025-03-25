// src/services/receiptProcessor.js
const { Pool } = require('pg');
const documentSourceHandler = require('./documentSourceHandler');
const receiptValidator = require('./receiptValidator');
const productNormalizer = require('./productNormalizer');
const languageHandler = require('./languageHandler');
const currencyConverter = require('./currencyConverter');
const locationIntelligence = require('./locationIntelligence');
const dataSourceTracker = require('./dataSourceTracker');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Receipt Processor Service
 * Coordinates multiple services to process receipts end-to-end
 */
class ReceiptProcessor {
  /**
   * Process a receipt image and create an expense
   * @param {String} userId - User ID
   * @param {Buffer|String} receiptData - Receipt image data or file path
   * @param {String} sourceType - Source of receipt (user_upload, api_import, etc.)
   * @returns {Promise<Object>} - Processing result with expense data
   */
  async processReceiptToExpense(userId, receiptData, sourceType = 'user_upload') {
    try {
      // Step 1: Extract data from receipt using document source handler
      const extractionResult = await documentSourceHandler.processDocument(
        userId, 
        'receipt', 
        receiptData, 
        sourceType
      );
      
      if (!extractionResult.success) {
        return {
          success: false,
          message: 'Failed to extract data from receipt',
          stage: 'extraction',
          error: extractionResult.message
        };
      }
      
      // Step 2: Get user preferences
      const userPrefs = await this.getUserPreferences(userId);
      
      // Step 3: Validate the extracted data
      const extractedData = extractionResult.extractedData;
      const validationResult = receiptValidator.validateOcrResult(extractedData);
      
      let receiptData = extractedData;
      
      // If validation indicates user review is needed
      if (validationResult.needsReview) {
        // In a real implementation, we would wait for user confirmation
        // For now, we'll continue with the data we have
        
        // Generate review prompt that could be sent to user
        const reviewPrompt = receiptValidator.generateReviewPrompt(
          extractedData, 
          validationResult, 
          userPrefs.language
        );
        
        // Store the review prompt for later reference
        await pool.query(`
          UPDATE document_extractions
          SET review_prompt = $1, needs_review = true
          WHERE extraction_id = $2
        `, [reviewPrompt, extractionResult.extractionId]);
      }
      
      // Step 4: Process location data if available
      let locationData = null;
      if (extractedData.merchant || extractedData.address) {
        locationData = await locationIntelligence.processLocationFromDocument(
          extractedData, 
          'receipt'
        );
      }
      
      // Step 5: Normalize items if present
      let normalizedItems = [];
      if (Array.isArray(extractedData.items) && extractedData.items.length > 0) {
        normalizedItems = await this.normalizeReceiptItems(
          extractedData.items,
          extractedData.language || userPrefs.language
        );
      }
      
      // Step 6: Convert currency if needed
      const currencyResult = await this.handleCurrency(
        extractedData.total,
        extractedData.currency || 'EUR',
        userPrefs.currency,
        extractedData.date || new Date()
      );
      
      // Step 7: Create the expense record
      const expenseData = {
        user_id: userId,
        amount: currencyResult.originalAmount,
        currency: currencyResult.originalCurrency,
        expense_date: extractedData.date ? new Date(extractedData.date) : new Date(),
        description: extractedData.description || '',
        category_id: await this.determineCategoryId(extractedData, normalizedItems),
        payment_method: extractedData.payment_method || 'unknown',
        data_source: sourceType,
        merchant_name: extractedData.merchant || '',
        items: normalizedItems
      };
      
      // Enrich with source tracking metadata
      const enrichedExpenseData = dataSourceTracker.enrichExpenseWithSourceInfo(
        expenseData, 
        sourceType
      );
      
      // Add location data if available
      if (locationData) {
        enrichedExpenseData.retailer_id = locationData.retailerId;
        enrichedExpenseData.location_id = locationData.locationId;
      }
      
      // Add extraction reference
      enrichedExpenseData.document_extraction_id = extractionResult.extractionId;
      
      // Add currency conversion data if applicable
      if (currencyResult.converted) {
        enrichedExpenseData.converted_amount = currencyResult.convertedAmount;
        enrichedExpenseData.converted_currency = currencyResult.convertedCurrency;
        enrichedExpenseData.exchange_rate = currencyResult.exchangeRate;
      }
      
      // Step 8: Store the expense in the database
      const expense = await this.saveExpense(enrichedExpenseData);
      
      return {
        success: true,
        expense,
        needsReview: validationResult.needsReview,
        message: validationResult.needsReview ? 
          'Receipt processed but requires review' : 
          'Receipt processed successfully',
        extractionId: extractionResult.extractionId,
        reviewPrompt: validationResult.needsReview ? 
          receiptValidator.generateReviewPrompt(extractedData, validationResult, userPrefs.language) : 
          null
      };
    } catch (error) {
      console.error('Error processing receipt to expense:', error);
      return {
        success: false,
        message: 'Error processing receipt',
        error: error.message
      };
    }
  }
  
  /**
   * Process user corrections to a receipt and update the expense
   * @param {String} userId - User ID
   * @param {String} expenseId - Expense ID
   * @param {Object} userCorrections - User's corrections to receipt data
   * @returns {Promise<Object>} - Updated expense data
   */
  async processUserCorrections(userId, expenseId, userCorrections) {
    try {
      // Get the original expense
      const expenseResult = await pool.query(
        'SELECT * FROM expenses WHERE expense_id = $1 AND user_id = $2',
        [expenseId, userId]
      );
      
      if (expenseResult.rows.length === 0) {
        throw new Error('Expense not found or does not belong to user');
      }
      
      const expense = expenseResult.rows[0];
      
      // Get the document extraction
      const extractionResult = await pool.query(
        'SELECT * FROM document_extractions WHERE extraction_id = $1',
        [expense.document_extraction_id]
      );
      
      if (extractionResult.rows.length === 0) {
        throw new Error('Document extraction not found');
      }
      
      const extraction = extractionResult.rows[0];
      const extractedData = extraction.data_extracted;
      
      // Process user corrections with receipt validator
      const correctedData = receiptValidator.processUserCorrections(
        extractedData,
        userCorrections
      );
      
      // Update the document extraction
      await pool.query(`
        UPDATE document_extractions
        SET data_extracted = $1, needs_review = false, user_reviewed = true
        WHERE extraction_id = $2
      `, [JSON.stringify(correctedData), extraction.extraction_id]);
      
      // Update expense record with corrections
      const updates = {};
      
      if (userCorrections.total !== undefined) {
        updates.amount = parseFloat(userCorrections.total);
      }
      
      if (userCorrections.date !== undefined) {
        updates.expense_date = new Date(userCorrections.date);
      }
      
      if (userCorrections.merchant !== undefined) {
        updates.merchant_name = userCorrections.merchant;
      }
      
      if (userCorrections.description !== undefined) {
        updates.description = userCorrections.description;
      }
      
      if (userCorrections.category_id !== undefined) {
        updates.category_id = userCorrections.category_id;
      }
      
      // Handle items if provided
      if (userCorrections.items && Array.isArray(userCorrections.items)) {
        // Get user's language preference
        const userPrefs = await this.getUserPreferences(userId);
        
        // Normalize corrected items
        const normalizedItems = await this.normalizeReceiptItems(
          userCorrections.items,
          userPrefs.language
        );
        
        // Delete existing items
        await pool.query(
          'DELETE FROM expense_items WHERE expense_id = $1',
          [expenseId]
        );
        
        // Insert corrected items
        await this.saveExpenseItems(expenseId, normalizedItems);
      }
      
      // Update the expense
      const updateQueryParts = [];
      const updateValues = [expenseId];
      let paramIndex = 2;
      
      for (const [key, value] of Object.entries(updates)) {
        updateQueryParts.push(`${key} = $${paramIndex}`);
        updateValues.push(value);
        paramIndex++;
      }
      
      // Add verification status
      updateQueryParts.push(`verification_status = 'verified'`);
      updateQueryParts.push(`verified_by_user = true`);
      updateQueryParts.push(`updated_at = NOW()`);
      
      if (updateQueryParts.length > 0) {
        const updateQuery = `
          UPDATE expenses
          SET ${updateQueryParts.join(', ')}
          WHERE expense_id = $1
          RETURNING *
        `;
        
        const updateResult = await pool.query(updateQuery, updateValues);
        return {
          success: true,
          expense: updateResult.rows[0],
          message: 'Receipt corrections applied successfully'
        };
      }
      
      return {
        success: true,
        expense,
        message: 'No changes were needed'
      };
    } catch (error) {
      console.error('Error processing user corrections:', error);
      return {
        success: false,
        message: 'Error processing corrections',
        error: error.message
      };
    }
  }
  
  /**
   * Normalize receipt items with product normalization service
   * @param {Array} items - Receipt item data
   * @param {String} language - Language of items
   * @returns {Promise<Array>} - Normalized items
   */
  async normalizeReceiptItems(items, language) {
    try {
      const normalizedItems = [];
      
      for (const item of items) {
        // Skip items without names or with 0 price
        if (!item.name || item.price === 0) continue;
        
        // Process with product normalizer
        const processed = await productNormalizer.processProductItem({
          product_name: item.name,
          language,
          quantity_value: item.quantity || 1,
          quantity_unit: item.unit || null,
          amount: item.price || item.amount || 0
        });
        
        normalizedItems.push(processed);
      }
      
      return normalizedItems;
    } catch (error) {
      console.error('Error normalizing receipt items:', error);
      // Return original items as fallback
      return items.map(item => ({
        product_name: item.name,
        product_name_original: item.name,
        amount: item.price || item.amount || 0,
        quantity: item.quantity || 1,
        unit_price: (item.price || item.amount || 0) / (item.quantity || 1),
        original_language: language
      }));
    }
  }
  
  /**
   * Handle currency conversion if needed
   * @param {Number} amount - Original amount
   * @param {String} originalCurrency - Original currency
   * @param {String} targetCurrency - Target currency
   * @param {Date} date - Transaction date
   * @returns {Promise<Object>} - Currency conversion result
   */
  async handleCurrency(amount, originalCurrency, targetCurrency, date) {
    try {
      // If currencies are the same, no conversion needed
      if (originalCurrency === targetCurrency) {
        return {
          originalAmount: amount,
          originalCurrency,
          converted: false
        };
      }
      
      // Convert through currency service
      const conversion = await currencyConverter.convertAmount(
        amount,
        originalCurrency,
        targetCurrency,
        date
      );
      
      return {
        originalAmount: amount,
        originalCurrency,
        convertedAmount: conversion.convertedAmount,
        convertedCurrency: targetCurrency,
        exchangeRate: conversion.exchangeRate,
        converted: true
      };
    } catch (error) {
      console.error('Error handling currency conversion:', error);
      return {
        originalAmount: amount,
        originalCurrency,
        converted: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get user preferences from database
   * @param {String} userId - User ID
   * @returns {Promise<Object>} - User preferences
   */
  async getUserPreferences(userId) {
    try {
      const userResult = await pool.query(
        'SELECT preferred_language, currency, time_zone FROM users WHERE user_id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        // Return defaults if user not found
        return {
          language: 'en',
          currency: 'EUR',
          timeZone: 'UTC'
        };
      }
      
      const user = userResult.rows[0];
      
      return {
        language: user.preferred_language || 'en',
        currency: user.currency || 'EUR',
        timeZone: user.time_zone || 'UTC'
      };
    } catch (error) {
      console.error('Error getting user preferences:', error);
      // Return defaults in case of error
      return {
        language: 'en',
        currency: 'EUR',
        timeZone: 'UTC'
      };
    }
  }
  
  /**
   * Determine category ID based on receipt and items
   * @param {Object} receipt - Receipt data
   * @param {Array} items - Normalized items
   * @returns {Promise<String|null>} - Category ID or null if not determined
   */
  async determineCategoryId(receipt, items) {
    try {
      // First, check if receipt has a category hint from merchant
      if (receipt.merchant) {
        const merchantResult = await pool.query(`
          SELECT category_mapping
          FROM merchant_category_mappings
          WHERE merchant_name_normalized = LOWER($1)
        `, [receipt.merchant.toLowerCase()]);
        
        if (merchantResult.rows.length > 0) {
          return merchantResult.rows[0].category_mapping;
        }
      }
      
      // Next, check items - if most items have same category, use that
      if (items && items.length > 0) {
        const categories = {};
        
        for (const item of items) {
          if (item.product_category) {
            categories[item.product_category] = (categories[item.product_category] || 0) + 1;
          }
        }
        
        // Find most common category
        let dominantCategory = null;
        let maxCount = 0;
        
        for (const [category, count] of Object.entries(categories)) {
          if (count > maxCount) {
            maxCount = count;
            dominantCategory = category;
          }
        }
        
        if (dominantCategory && maxCount >= items.length / 2) {
          // Look up category ID from name
          const categoryResult = await pool.query(`
            SELECT category_id
            FROM categories
            WHERE name = $1 OR name_normalized = LOWER($1)
          `, [dominantCategory]);
          
          if (categoryResult.rows.length > 0) {
            return categoryResult.rows[0].category_id;
          }
        }
      }
      
      // If no category determined, use "Uncategorized"
      const uncategorizedResult = await pool.query(`
        SELECT category_id
        FROM categories
        WHERE is_system = true AND name = 'Uncategorized'
      `);
      
      if (uncategorizedResult.rows.length > 0) {
        return uncategorizedResult.rows[0].category_id;
      }
      
      return null; // No category found
    } catch (error) {
      console.error('Error determining category:', error);
      return null;
    }
  }
  
  /**
   * Save expense to database
   * @param {Object} expenseData - Expense data
   * @returns {Promise<Object>} - Saved expense
   */
  async saveExpense(expenseData) {
    try {
      // Start a transaction
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Extract items to save separately
        const items = expenseData.items || [];
        delete expenseData.items;
        
        // Insert expense
        const expenseFields = Object.keys(expenseData);
        const expenseValues = Object.values(expenseData);
        const expenseParams = expenseFields.map((_, i) => `$${i + 1}`).join(', ');
        
        const expenseQuery = `
          INSERT INTO expenses(${expenseFields.join(', ')}, created_at, updated_at)
          VALUES(${expenseParams}, NOW(), NOW())
          RETURNING *
        `;
        
        const expenseResult = await client.query(expenseQuery, expenseValues);
        const expense = expenseResult.rows[0];
        
        // Insert items if any
        if (items.length > 0) {
          await this.saveExpenseItems(expense.expense_id, items, client);
        }
        
        await client.query('COMMIT');
        
        // Fetch complete expense with items
        const completeExpense = await this.getExpenseWithItems(expense.expense_id);
        
        return completeExpense;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error saving expense:', error);
      throw error;
    }
  }
  
  /**
   * Save expense items to database
   * @param {String} expenseId - Expense ID
   * @param {Array} items - Expense items
   * @param {Object} client - Optional database client for transactions
   * @returns {Promise<Array>} - Saved items
   */
  async saveExpenseItems(expenseId, items, client = null) {
    try {
      const useClient = client || pool;
      const savedItems = [];
      
      for (const item of items) {
        item.expense_id = expenseId;
        
        const itemFields = Object.keys(item);
        const itemValues = Object.values(item);
        const itemParams = itemFields.map((_, i) => `$${i + 1}`).join(', ');
        
        const itemQuery = `
          INSERT INTO expense_items(${itemFields.join(', ')}, created_at)
          VALUES(${itemParams}, NOW())
          RETURNING *
        `;
        
        const itemResult = await useClient.query(itemQuery, itemValues);
        savedItems.push(itemResult.rows[0]);
      }
      
      return savedItems;
    } catch (error) {
      console.error('Error saving expense items:', error);
      throw error;
    }
  }
  
  /**
   * Get complete expense with items
   * @param {String} expenseId - Expense ID
   * @returns {Promise<Object>} - Expense with items
   */
  async getExpenseWithItems(expenseId) {
    try {
      const expenseResult = await pool.query(
        'SELECT * FROM expenses WHERE expense_id = $1',
        [expenseId]
      );
      
      if (expenseResult.rows.length === 0) {
        throw new Error('Expense not found');
      }
      
      const expense = expenseResult.rows[0];
      
      // Get items
      const itemsResult = await pool.query(
        'SELECT * FROM expense_items WHERE expense_id = $1',
        [expenseId]
      );
      
      expense.items = itemsResult.rows;
      expense.has_items = itemsResult.rows.length > 0;
      
      return expense;
    } catch (error) {
      console.error('Error getting expense with items:', error);
      throw error;
    }
  }
}

module.exports = new ReceiptProcessor();
