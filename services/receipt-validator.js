// src/services/receiptValidator.js
const { translate } = require('./i18n');

class ReceiptValidator {
  /**
   * Validate OCR results for a receipt
   * @param {Object} ocrResult - Extracted data from OCR
   * @returns {Object} - Validation results
   */
  validateOcrResult(ocrResult) {
    const confidenceThresholds = {
      total: 70,        // Confidence threshold for total amount
      date: 60,         // Confidence threshold for date
      vendor: 50,       // Confidence threshold for vendor
      items: 40         // Confidence threshold for individual items
    };
    
    const results = {
      isValid: true,
      needsReview: false,
      lowConfidenceFields: [],
      missingFields: []
    };
    
    // Check required fields
    if (!ocrResult.total) {
      results.isValid = false;
      results.missingFields.push('total');
    }
    
    if (!ocrResult.date) {
      results.missingFields.push('date');
    }
    
    // Check confidence scores
    if (ocrResult.totalConfidence && ocrResult.totalConfidence < confidenceThresholds.total) {
      results.needsReview = true;
      results.lowConfidenceFields.push('total');
    }
    
    if (ocrResult.dateConfidence && ocrResult.dateConfidence < confidenceThresholds.date) {
      results.needsReview = true;
      results.lowConfidenceFields.push('date');
    }
    
    if (ocrResult.vendorConfidence && ocrResult.vendorConfidence < confidenceThresholds.vendor) {
      results.needsReview = true;
      results.lowConfidenceFields.push('vendor');
    }
    
    // Handle items with low confidence
    if (ocrResult.items && ocrResult.items.length > 0) {
      const lowConfidenceItems = ocrResult.items.filter(
        item => item.confidence < confidenceThresholds.items
      );
      
      if (lowConfidenceItems.length > 0) {
        results.needsReview = true;
        results.lowConfidenceFields.push('items');
        results.lowConfidenceItems = lowConfidenceItems.map(item => item.name);
      }
    }
    
    return results;
  }
  
  /**
   * Generate review prompt for user to verify OCR results
   * @param {Object} ocrResult - Extracted data from OCR
   * @param {Object} validationResults - Results from validateOcrResult
   * @param {String} language - User's language preference
   * @returns {String} - Formatted prompt for review
   */
  generateReviewPrompt(ocrResult, validationResults, language = 'en') {
    let promptText = '';
    
    if (language === 'en') {
      promptText = 'I need your help to verify this receipt. Please check these details:\n\n';
    } else if (language === 'ru') {
      promptText = 'Мне нужна ваша помощь в проверке этого чека. Пожалуйста, проверьте эти детали:\n\n';
    } else {
      promptText = translate('receipt.review_prompt', language);
    }
    
    // Add fields that need review
    if (validationResults.lowConfidenceFields.includes('total')) {
      if (language === 'en') {
        promptText += `Total: ${ocrResult.total} (confidence is low, please verify)\n`;
      } else if (language === 'ru') {
        promptText += `Итого: ${ocrResult.total} (низкая уверенность, пожалуйста проверьте)\n`;
      } else {
        promptText += translate('receipt.review.total_low', language, { 
          total: ocrResult.total 
        }) + '\n';
      }
    } else if (ocrResult.total) {
      if (language === 'en') {
        promptText += `Total: ${ocrResult.total}\n`;
      } else if (language === 'ru') {
        promptText += `Итого: ${ocrResult.total}\n`;
      } else {
        promptText += translate('receipt.review.total', language, { 
          total: ocrResult.total 
        }) + '\n';
      }
    } else {
      // Missing total field
      if (language === 'en') {
        promptText += `Total: (not detected, please enter)\n`;
      } else if (language === 'ru') {
        promptText += `Итого: (не обнаружено, пожалуйста введите)\n`;
      } else {
        promptText += translate('receipt.review.total_missing', language) + '\n';
      }
    }
    
    // Date field
    if (validationResults.lowConfidenceFields.includes('date')) {
      if (language === 'en') {
        promptText += `Date: ${ocrResult.date ? ocrResult.date : '(not detected)'} (confidence is low, please verify)\n`;
      } else if (language === 'ru') {
        promptText += `Дата: ${ocrResult.date ? ocrResult.date : '(не обнаружено)'} (низкая уверенность, пожалуйста проверьте)\n`;
      } else {
        promptText += translate('receipt.review.date_low', language, { 
          date: ocrResult.date || translate('receipt.not_detected', language) 
        }) + '\n';
      }
    } else if (ocrResult.date) {
      if (language === 'en') {
        promptText += `Date: ${ocrResult.date}\n`;
      } else if (language === 'ru') {
        promptText += `Дата: ${ocrResult.date}\n`;
      } else {
        promptText += translate('receipt.review.date', language, { 
          date: ocrResult.date 
        }) + '\n';
      }
    } else {
      // Missing date field
      if (language === 'en') {
        promptText += `Date: (not detected, please enter)\n`;
      } else if (language === 'ru') {
        promptText += `Дата: (не обнаружено, пожалуйста введите)\n`;
      } else {
        promptText += translate('receipt.review.date_missing', language) + '\n';
      }
    }
    
    // Vendor field
    if (validationResults.lowConfidenceFields.includes('vendor')) {
      if (language === 'en') {
        promptText += `Vendor: ${ocrResult.merchant ? ocrResult.merchant : '(not detected)'} (confidence is low, please verify)\n`;
      } else if (language === 'ru') {
        promptText += `Продавец: ${ocrResult.merchant ? ocrResult.merchant : '(не обнаружено)'} (низкая уверенность, пожалуйста проверьте)\n`;
      } else {
        promptText += translate('receipt.review.vendor_low', language, { 
          vendor: ocrResult.merchant || translate('receipt.not_detected', language) 
        }) + '\n';
      }
    } else if (ocrResult.merchant) {
      if (language === 'en') {
        promptText += `Vendor: ${ocrResult.merchant}\n`;
      } else if (language === 'ru') {
        promptText += `Продавец: ${ocrResult.merchant}\n`;
      } else {
        promptText += translate('receipt.review.vendor', language, { 
          vendor: ocrResult.merchant 
        }) + '\n';
      }
    }
    
    // Items field
    if (validationResults.lowConfidenceFields.includes('items') && ocrResult.items && ocrResult.items.length > 0) {
      if (language === 'en') {
        promptText += `\nSome items have low confidence and may need correction:\n`;
      } else if (language === 'ru') {
        promptText += `\nНекоторые позиции имеют низкую уверенность и могут требовать корректировки:\n`;
      } else {
        promptText += '\n' + translate('receipt.review.items_low', language) + '\n';
      }
      
      // List items with low confidence
      for (const itemName of validationResults.lowConfidenceItems) {
        promptText += `- ${itemName}\n`;
      }
    } else if (ocrResult.items && ocrResult.items.length > 0) {
      // Just mention detected items count
      if (language === 'en') {
        promptText += `\nDetected ${ocrResult.items.length} items.\n`;
      } else if (language === 'ru') {
        promptText += `\nОбнаружено ${ocrResult.items.length} позиций.\n`;
      } else {
        promptText += '\n' + translate('receipt.review.items_count', language, { 
          count: ocrResult.items.length 
        }) + '\n';
      }
    }
    
    // Final instructions
    if (language === 'en') {
      promptText += `\nPlease verify this information and make corrections if needed.`;
    } else if (language === 'ru') {
      promptText += `\nПожалуйста, проверьте эту информацию и внесите корректировки при необходимости.`;
    } else {
      promptText += '\n' + translate('receipt.review.instructions', language);
    }
    
    return promptText;
  }
  
  /**
   * Process user corrections for receipt data
   * @param {Object} originalData - Original OCR data
   * @param {Object} userCorrections - User corrections
   * @returns {Object} - Merged and validated data
   */
  processUserCorrections(originalData, userCorrections) {
    const mergedData = { ...originalData };
    
    // Apply user corrections
    for (const [field, value] of Object.entries(userCorrections)) {
      if (value !== undefined && value !== null) {
        mergedData[field] = value;
      }
    }
    
    // Special handling for total field
    if (userCorrections.total !== undefined) {
      // Set confidence to maximum for user-corrected fields
      mergedData.totalConfidence = 100;
    }
    
    // Special handling for date field
    if (userCorrections.date !== undefined) {
      mergedData.dateConfidence = 100;
    }
    
    // Special handling for merchant field
    if (userCorrections.merchant !== undefined) {
      mergedData.vendorConfidence = 100;
    }
    
    // Special handling for items
    if (userCorrections.items) {
      // Replace or update items
      if (Array.isArray(userCorrections.items)) {
        mergedData.items = userCorrections.items.map(item => ({
          ...item,
          confidence: 100  // User-corrected items have max confidence
        }));
      }
    }
    
    // Set overall verification status
    mergedData.verification_status = 'verified';
    mergedData.verified_by_user = true;
    
    return mergedData;
  }
  
  /**
   * Check if a receipt is complete enough to save
   * @param {Object} receiptData - Receipt data to validate
   * @returns {Object} - Validation result with missing fields
   */
  validateCompleteness(receiptData) {
    const requiredFields = ['total', 'date'];
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!receiptData[field]) {
        missingFields.push(field);
      }
    }
    
    return {
      isComplete: missingFields.length === 0,
      missingFields
    };
  }
}

module.exports = new ReceiptValidator();
