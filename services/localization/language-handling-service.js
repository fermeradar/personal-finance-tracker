const logger = require('../core/logger-utility');
// src/services/languageHandler.js
const { Pool } = require('pg');
const { detectLanguage } = require('./languageDetector');
const { translateText } = require('./translator');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Handle mixed language input while maintaining user preferences
 */
class LanguageHandler {
  /**
   * Process text input with language detection and optional translation
   * @param {String} userId - User ID for preference lookup
   * @param {String} text - Text to process
   * @param {Boolean} translateToEnglish - Whether to translate non-English text to English
   * @param {Boolean} _storeOriginal - Whether to store the original text
   * @returns {Promise<Object>} - Processing result with detected language, original, and translated text
   */
  async processText(userId, text, translateToEnglish = true, _storeOriginal = true) {
    try {
      // Get user's preferred language
      const userLanguage = await this.getUserLanguage(userId);
      
      // Detect input language
      const detectedLanguage = await detectLanguage(text);
      
      // Initialize result object
      const result = {
        detectedLanguage,
        originalText: text,
        translatedText: text,
        userLanguage
      };
      
      // Translate to English for processing if needed and requested
      if (translateToEnglish && detectedLanguage !== 'en') {
        result.translatedText = await translateText(text, detectedLanguage, 'en');
      }
      
      return result;
    } catch (error) {
      logger.error('Error processing text with language detection:', error);
      // Return basic result in case of error
      return {
        detectedLanguage: 'en',
        originalText: text,
        translatedText: text,
        userLanguage: 'en'
      };
    }
  }
  
  /**
   * Process document extraction results with language awareness
   * @param {String} userId - User ID
   * @param {String} documentType - Type of document (receipt, bill, etc)
   * @param {String} extractedText - Raw text extracted from the document
   * @param {Object} extractedData - Structured data extracted from the document
   * @param {Number} confidenceScore - Confidence score of extraction
   * @returns {Promise<Object>} - Processing result with language info and extraction data
   */
  async processDocumentExtraction(userId, documentType, extractedText, extractedData, confidenceScore) {
    try {
      // Detect document language
      const detectedLanguage = await detectLanguage(extractedText);
      
      // Translate for processing if not English
      let translatedText = extractedText;
      if (detectedLanguage !== 'en') {
        translatedText = await translateText(extractedText, detectedLanguage, 'en');
      }
      
      // Store the extraction record
      const result = await pool.query(`
        INSERT INTO document_extractions(
          user_id, document_type, extraction_date, data_extracted,
          confidence_score, detected_language, original_text, translated_text
        )
        VALUES($1, $2, NOW(), $3, $4, $5, $6, $7)
        RETURNING extraction_id
      `, [
        userId,
        documentType,
        JSON.stringify(extractedData),
        confidenceScore,
        detectedLanguage,
        extractedText,
        detectedLanguage !== 'en' ? translatedText : null  // Only store if translated
      ]);
      
      return {
        extractionId: result.rows[0].extraction_id,
        detectedLanguage,
        extractedData,
        originalText: extractedText,
        translatedText
      };
    } catch (error) {
      logger.error('Error processing document extraction:', error);
      throw error;
    }
  }
  
  /**
   * Get user's preferred interface language
   * @param {String} userId - User ID
   * @returns {Promise<String>} - Language code (e.g., 'en', 'ru')
   */
  async getUserLanguage(userId) {
    try {
      const result = await pool.query(
        'SELECT preferred_language FROM users WHERE user_id = $1',
        [userId]
      );
      
      return result.rows.length > 0 
        ? result.rows[0].preferred_language 
        : 'en';  // Default to English
    } catch (error) {
      logger.error('Error fetching user language preference:', error);
      return 'en';  // Default to English in case of error
    }
  }
  
  /**
   * Update user's preferred language
   * @param {String} userId - User ID
   * @param {String} language - Language code (e.g., 'en', 'ru')
   * @returns {Promise<Boolean>} - Success flag
   */
  async setUserLanguage(userId, language) {
    try {
      await pool.query(
        'UPDATE users SET preferred_language = $1 WHERE user_id = $2',
        [language, userId]
      );
      
      return true;
    } catch (error) {
      logger.error('Error updating user language preference:', error);
      return false;
    }
  }
  
  /**
   * Format a response in the user's preferred language
   * @param {String} userId - User ID
   * @param {String} englishText - Text in English
   * @param {String} russianText - Text in Russian (optional)
   * @returns {Promise<String>} - Translated text in user's preferred language
   */
  async formatUserMessage(userId, englishText, russianText = null) {
    try {
      const userLanguage = await this.getUserLanguage(userId);
      
      // If user prefers English, use English text
      if (userLanguage === 'en') {
        return englishText;
      }
      
      // If user prefers Russian and Russian text is provided, use it
      if (userLanguage === 'ru' && russianText) {
        return russianText;
      }
      
      // Otherwise translate English text to user's language
      return await translateText(englishText, 'en', userLanguage);
    } catch (error) {
      logger.error('Error formatting user message:', error);
      return englishText;  // Default to English in case of error
    }
  }
  
  /**
   * Handle a receipt with mixed-language content
   * @param {String} userId - User ID
   * @param {String} receiptText - Raw text from receipt
   * @param {Object} extractedData - Structured data from receipt
   * @returns {Promise<Object>} - Processed receipt data
   */
  async handleMixedLanguageReceipt(userId, receiptText, extractedData) {
    try {
      // Process the document extraction
      const extraction = await this.processDocumentExtraction(
        userId, 
        'receipt', 
        receiptText, 
        extractedData,
        extractedData.confidence || 70
      );
      
      // Get product names in both original language and English
      if (extraction.detectedLanguage !== 'en' && extractedData.items) {
        for (const item of extractedData.items) {
          // Store original product name
          item.product_name_original = item.product_name;
          
          // Translate product name to English for categorization
          item.product_name = await translateText(
            item.product_name, 
            extraction.detectedLanguage, 
            'en'
          );
          
          // Keep track of original language
          item.original_language = extraction.detectedLanguage;
        }
      }
      
      return {
        ...extraction,
        extractedData
      };
    } catch (error) {
      logger.error('Error handling mixed language receipt:', error);
      throw error;
    }
  }
}

module.exports = new LanguageHandler();
