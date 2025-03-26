const logger = require('../core/logger-utility');
let $2;
// src/services/documentSourceHandler.js
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const _axios = require($2);

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Document Source Handler Service
 * Manages document-based inputs vs. direct user inputs
 */
class DocumentSourceHandler {
  /**
   * Process document from various sources
   * @param {String} userId - User ID
   * @param {String} documentType - Type of document ('receipt', 'utility_bill', 'bank_statement', etc.)
   * @param {Buffer|String} documentData - Document data or path
   * @param {String} sourceType - Source of document ('user_upload', 'api_import', 'bank_api', 'email_import')
   * @returns {Promise<Object>} - Processing result
   */
  async processDocument(userId, documentType, documentData, sourceType = 'user_upload') {
    try {
      // Generate a unique ID for this extraction
      const extractionId = uuidv4();
      
      // Choose processing method based on document type and source
      let processingResult;
      
      switch (documentType) {
        case 'receipt':
          processingResult = await this.processReceipt(documentData, sourceType);
          break;
          
        case 'utility_bill':
          processingResult = await this.processUtilityBill(documentData, sourceType);
          break;
          
        case 'bank_statement':
          processingResult = await this.processBankStatement(documentData, sourceType);
          break;
          
        default:
          processingResult = await this.processGenericDocument(documentData, sourceType);
      }
      
      // Store the extraction record
      const storagePath = processingResult.storagePath || null;
      
      const _extractionRecord = await pool.query(`
        INSERT INTO document_extractions(
          extraction_id, user_id, document_type, extraction_date,
          data_extracted, confidence_score, detected_language,
          original_text, translated_text, storage_path, processed_status, source_type
        )
        VALUES($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        extractionId,
        userId,
        documentType,
        JSON.stringify(processingResult.extractedData),
        processingResult.confidence || 70,
        processingResult.language || 'en',
        processingResult.originalText || null,
        processingResult.translatedText || null,
        storagePath,
        processingResult.success ? 'processed' : 'failed',
        sourceType
      ]);
      
      return {
        extractionId,
        documentType,
        sourceType,
        extractedData: processingResult.extractedData,
        confidence: processingResult.confidence || 70,
        success: processingResult.success,
        message: processingResult.message,
        storagePath
      };
    } catch (error) {
      logger.error('Error processing document:', error);
      
      // Log the failed extraction attempt
      try {
        await pool.query(`
          INSERT INTO document_extractions(
            extraction_id, user_id, document_type, extraction_date,
            data_extracted, processed_status, source_type
          )
          VALUES($1, $2, $3, NOW(), $4, $5, $6)
        `, [
          uuidv4(),
          userId,
          documentType,
          JSON.stringify({ error: error.message }),
          'failed',
          sourceType
        ]);
      } catch (logError) {
        logger.error('Error logging document processing failure:', logError);
      }
      
      throw error;
    }
  }
  
  /**
   * Process receipt document
   * @param {Buffer|String} documentData - Receipt image or data
   * @param {String} sourceType - Source of document
   * @returns {Promise<Object>} - Extracted receipt data
   */
  async processReceipt(documentData, sourceType) {
    try {
      let extractedData = {};
      let confidence = 0;
      let originalText = '';
      let language = 'en';
      
      // Process based on source type
      if (sourceType === 'user_upload') {
        // For user uploads, we need to run OCR
        const ocrResult = await this.performOCR(documentData);
        originalText = ocrResult._text;
        language = ocrResult.language;
        confidence = ocrResult.confidence;
        
        // Parse the OCR text
        extractedData = this.parseReceiptText(originalText);
        extractedData.rawText = originalText;
      } else if (sourceType === 'api_import') {
        // For API imports, data is already structured
        extractedData = typeof documentData === 'string' 
          ? JSON.parse(documentData) 
          : documentData;
        
        confidence = 90; // Higher confidence for pre-structured data
      }
      
      // Store the document if it's a file
      const storagePath = this.isBuffer(documentData) 
        ? await this.storeDocument(documentData, 'receipt') 
        : null;
      
      return {
        extractedData,
        confidence,
        originalText,
        language,
        storagePath,
        success: true,
        message: 'Receipt processed successfully'
      };
    } catch (error) {
      logger.error('Error processing receipt:', error);
      return {
        extractedData: { error: error.message },
        confidence: 0,
        success: false,
        message: 'Failed to process receipt'
      };
    }
  }
  
  /**
   * Process utility bill document
   * @param {Buffer|String} documentData - Utility bill image or data
   * @param {String} sourceType - Source of document
   * @returns {Promise<Object>} - Extracted bill data
   */
  async processUtilityBill(documentData, sourceType) {
    try {
      let extractedData = {};
      let confidence = 0;
      let originalText = '';
      let language = 'en';
      
      // Process based on source type
      if (sourceType === 'user_upload') {
        // For user uploads, we need to run OCR
        const ocrResult = await this.performOCR(documentData);
        originalText = ocrResult._text;
        language = ocrResult.language;
        confidence = ocrResult.confidence;
        
        // Parse the OCR text
        extractedData = this.parseUtilityBillText(originalText);
        extractedData.rawText = originalText;
      } else if (sourceType === 'api_import' || sourceType === 'email_import') {
        // For API imports, data is already structured
        extractedData = typeof documentData === 'string' 
          ? JSON.parse(documentData) 
          : documentData;
        
        confidence = 85; // Higher confidence for pre-structured data
      }
      
      // Store the document if it's a file
      const storagePath = this.isBuffer(documentData) 
        ? await this.storeDocument(documentData, 'utility_bill') 
        : null;
      
      return {
        extractedData,
        confidence,
        originalText,
        language,
        storagePath,
        success: true,
        message: 'Utility bill processed successfully'
      };
    } catch (error) {
      logger.error('Error processing utility bill:', error);
      return {
        extractedData: { error: error.message },
        confidence: 0,
        success: false,
        message: 'Failed to process utility bill'
      };
    }
  }
  
  /**
   * Process bank statement document
   * @param {Buffer|String} documentData - Bank statement data
   * @param {String} sourceType - Source of document
   * @returns {Promise<Object>} - Extracted statement data
   */
  async processBankStatement(documentData, sourceType) {
    try {
      let extractedData = {};
      let confidence = 0;
      let originalText = '';
      let language = 'en';
      
      // Process based on source type
      if (sourceType === 'user_upload') {
        // For user uploads, we need to run OCR
        const ocrResult = await this.performOCR(documentData);
        originalText = ocrResult._text;
        language = ocrResult.language;
        confidence = ocrResult.confidence;
        
        // Parse the OCR text
        extractedData = this.parseBankStatementText(originalText);
        extractedData.rawText = originalText;
      } else if (sourceType === 'api_import' || sourceType === 'bank_api') {
        // For API imports, data is already structured
        extractedData = typeof documentData === 'string' 
          ? JSON.parse(documentData) 
          : documentData;
        
        confidence = 95; // Very high confidence for bank API data
      }
      
      // Store the document if it's a file
      const storagePath = this.isBuffer(documentData) 
        ? await this.storeDocument(documentData, 'bank_statement') 
        : null;
      
      return {
        extractedData,
        confidence,
        originalText,
        language,
        storagePath,
        success: true,
        message: 'Bank statement processed successfully'
      };
    } catch (error) {
      logger.error('Error processing bank statement:', error);
      return {
        extractedData: { error: error.message },
        confidence: 0,
        success: false,
        message: 'Failed to process bank statement'
      };
    }
  }
  
  /**
   * Process generic document
   * @param {Buffer|String} documentData - Document data
   * @param {String} sourceType - Source of document
   * @returns {Promise<Object>} - Extracted document data
   */
  async processGenericDocument(documentData, sourceType) {
    try {
      let extractedData = {};
      let confidence = 0;
      let originalText = '';
      let language = 'en';
      
      // Process based on source type
      if (sourceType === 'user_upload') {
        // For user uploads, we need to run OCR
        const ocrResult = await this.performOCR(documentData);
        originalText = ocrResult._text;
        language = ocrResult.language;
        confidence = ocrResult.confidence;
        
        // Just store the text for generic documents
        extractedData = {
          text: originalText,
          language
        };
      } else if (sourceType === 'api_import') {
        // For API imports, data is already structured
        extractedData = typeof documentData === 'string' 
          ? JSON.parse(documentData) 
          : documentData;
        
        confidence = 80;
      }
      
      // Store the document if it's a file
      const storagePath = this.isBuffer(documentData) 
        ? await this.storeDocument(documentData, 'generic') 
        : null;
      
      return {
        extractedData,
        confidence,
        originalText,
        language,
        storagePath,
        success: true,
        message: 'Document processed successfully'
      };
    } catch (error) {
      logger.error('Error processing generic document:', error);
      return {
        extractedData: { error: error.message },
        confidence: 0,
        success: false,
        message: 'Failed to process document'
      };
    }
  }
  
  /**
   * Perform OCR on document image
   * @param {Buffer} imageData - Image data
   * @returns {Promise<Object>} - OCR result
   */
  async performOCR(_imageData) {
    // This is a placeholder - in a real implementation, you would:
    // 1. Use Tesseract.js or connect to Google Vision API
    // 2. Process the image and extract _text
    // 3. Detect language and confidence level
    
    // For this example, we'll simulate a response
    return {
      text: "This is placeholder OCR text. In a real implementation, you would get actual text from the image.",
      language: 'en',
      confidence: 70
    };
  }
  
  /**
   * Parse receipt text into structured data
   * @param {String} text - OCR text from receipt
   * @returns {Object} - Structured receipt data
   */
  parseReceiptText(_text) {
    // This is a placeholder - in a real implementation, you would:
    // 1. Parse the _text using regular expressions or NLP
    // 2. Extract details like merchant, date, items, total, etc.
    
    // For this example, we'll return a basic structure
    return {
      merchant: "Example Store",
      date: new Date().toISOString(),
      total: 0,
      items: [],
      parsed: false,
      needsReview: true
    };
  }
  
  /**
   * Parse utility bill text into structured data
   * @param {String} text - OCR text from utility bill
   * @returns {Object} - Structured bill data
   */
  parseUtilityBillText(_text) {
    // Placeholder implementation
    return {
      provider: "Example Utility",
      service_type: "Electricity",
      account_number: "12345",
      service_address: "123 Example St",
      amount_due: 0,
      due_date: new Date().toISOString(),
      parsed: false,
      needsReview: true
    };
  }
  
  /**
   * Parse bank statement text into structured data
   * @param {String} text - OCR text from bank statement
   * @returns {Object} - Structured statement data
   */
  parseBankStatementText(_text) {
    // Placeholder implementation
    return {
      bank_name: "Example Bank",
      account_number: "XXXX1234",
      statement_period: "01/01/2023 - 01/31/2023",
      transactions: [],
      parsed: false,
      needsReview: true
    };
  }
  
  /**
   * Store document file
   * @param {Buffer} fileData - File data
   * @param {String} docType - Document type
   * @returns {Promise<String>} - Storage path
   */
  async storeDocument(fileData, docType) {
    try {
      // Create unique filename
      const fileName = `${docType}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.pdf`;
      
      // Create storage directory if it doesn't exist
      const storageDir = path.join(__dirname, '..', '..', 'uploads', docType);
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      
      // Save file
      const filePath = path.join(storageDir, fileName);
      fs.writeFileSync(filePath, fileData);
      
      return filePath;
    } catch (error) {
      logger.error('Error storing document:', error);
      return null;
    }
  }
  
  /**
   * Check if value is a Buffer
   * @param {any} value - Value to check
   * @returns {Boolean} - True if Buffer
   */
  isBuffer(value) {
    return Buffer.isBuffer(value);
  }
  
  /**
   * Compare confidence between document source and direct user input
   * @param {Object} documentData - Data extracted from document
   * @param {Object} userInputData - Data provided directly by user
   * @returns {Object} - Merged data with confidence indicators
   */
  mergeDataSources(documentData, userInputData) {
    // Start with empty result
    const result = {};
    
    // Define default confidence levels
    const confidenceLevels = {
      receipt: 85,
      utility_bill: 90,
      bank_statement: 95,
      user_voice: 60,
      user_text: 70
    };
    
    // Get base confidence for each source
    const docConfidence = documentData.documentType 
      ? confidenceLevels[documentData.documentType] || 80
      : 80;
    
    const userConfidence = userInputData.inputType 
      ? confidenceLevels[userInputData.inputType] || 65
      : 65;
    
    // For each field in document data
    for (const [key, value] of Object.entries(documentData)) {
      if (key === 'documentType' || key === 'inputType' || key === 'confidence') continue;
      
      result[key] = {
        value,
        source: 'document',
        confidence: docConfidence
      };
    }
    
    // For each field in user input data
    for (const [key, value] of Object.entries(userInputData)) {
      if (key === 'documentType' || key === 'inputType' || key === 'confidence') continue;
      
      // If field exists in document data, use the higher confidence value
      if (result[key]) {
        if (userConfidence > result[key].confidence) {
          result[key] = {
            value,
            source: 'user_input',
            confidence: userConfidence
          };
        }
      } else {
        // If field doesn't exist in document data, add it
        result[key] = {
          value,
          source: 'user_input',
          confidence: userConfidence
        };
      }
    }
    
    return result;
  }
  
  /**
   * Get reliability score for a data source type
   * @param {String} sourceType - Type of source ('user_upload', 'api_import', etc.)
   * @returns {Number} - Reliability score (0-100)
   */
  getSourceReliability(sourceType) {
    const reliabilityScores = {
      'bank_api': 95,       // Direct bank API connection is highly reliable
      'api_import': 90,     // Data from external APIs is quite reliable
      'user_upload': 80,    // Document uploads are moderately reliable
      'email_import': 75,   // Email imports can have formatting issues
      'user_text': 65,      // Direct _text input from user
      'user_voice': 60      // Voice input has potential for misunderstanding
    };
    
    return reliabilityScores[sourceType] || 70;
  }
  
  /**
   * Check if a document source is more reliable than user input
   * @param {String} documentSource - Document source type
   * @param {String} inputType - User input type
   * @returns {Boolean} - True if document is more reliable
   */
  isDocumentMoreReliable(documentSource, inputType) {
    const documentReliability = this.getSourceReliability(documentSource);
    const inputReliability = this.getSourceReliability(inputType);
    
    return documentReliability > inputReliability;
  }
  
  /**
   * Validate document against known patterns
   * @param {Object} extractedData - Data extracted from document
   * @param {String} documentType - Type of document
   * @returns {Object} - Validation result
   */
  validateDocument(extractedData, documentType) {
    let isValid = false;
    let validationScore = 0;
    let issues = [];
    
    switch (documentType) {
      case 'receipt':
        // Check for minimum receipt fields
        if (!extractedData.merchant) {
          issues.push('Missing merchant name');
        }
        
        if (!extractedData.date) {
          issues.push('Missing date');
        }
        
        if (!extractedData.total && extractedData.total !== 0) {
          issues.push('Missing total amount');
        }
        
        // Calculate validation score
        validationScore = 100;
        if (!extractedData.merchant) validationScore -= 30;
        if (!extractedData.date) validationScore -= 20;
        if (!extractedData.total && extractedData.total !== 0) validationScore -= 30;
        if (!extractedData.items || extractedData.items.length === 0) validationScore -= 20;
        
        isValid = validationScore >= 60;
        break;
        
      case 'utility_bill':
        // Check for minimum utility bill fields
        if (!extractedData.provider) {
          issues.push('Missing service provider');
        }
        
        if (!extractedData.amount_due && extractedData.amount_due !== 0) {
          issues.push('Missing amount due');
        }
        
        // Calculate validation score
        validationScore = 100;
        if (!extractedData.provider) validationScore -= 25;
        if (!extractedData.service_type) validationScore -= 15;
        if (!extractedData.amount_due && extractedData.amount_due !== 0) validationScore -= 30;
        if (!extractedData.due_date) validationScore -= 20;
        
        isValid = validationScore >= 60;
        break;
        
      case 'bank_statement':
        // Check for minimum bank statement fields
        if (!extractedData.bank_name) {
          issues.push('Missing bank name');
        }
        
        if (!extractedData.transactions || !Array.isArray(extractedData.transactions)) {
          issues.push('Missing transactions data');
        }
        
        // Calculate validation score
        validationScore = 100;
        if (!extractedData.bank_name) validationScore -= 20;
        if (!extractedData.account_number) validationScore -= 20;
        if (!extractedData.statement_period) validationScore -= 15;
        if (!extractedData.transactions || extractedData.transactions.length === 0) validationScore -= 45;
        
        isValid = validationScore >= 60;
        break;
        
      default:
        isValid = true;
        validationScore = 70;
    }
    
    return {
      isValid,
      validationScore,
      issues
    };
  }
}

module.exports = new DocumentSourceHandler();
