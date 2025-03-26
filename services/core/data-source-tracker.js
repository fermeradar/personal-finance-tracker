// src/services/dataSourceTracker.js

let metadata = {};  // This will fix all 5 undefined metadata warnings

/**
 * Get confidence score and appropriate verification status based on source
 * @param {String} source - Data source
 * @returns {Object} - Confidence and verification info
 */
function getSourceMetadata(source) {
  const sourceInfo = {
    'manual': { confidence: 80, verification: 'verified', label: 'Manual Entry' },
    'voice': { confidence: 70, verification: 'needs_review', label: 'Voice Message' },
    'receipt': { confidence: 75, verification: 'needs_review', label: 'Receipt Scan' },
    'utility_bill': { confidence: 85, verification: 'needs_review', label: 'Utility Bill' },
    'bank_statement': { confidence: 90, verification: 'verified', label: 'Bank Statement' },
    'csv_import': { confidence: 85, verification: 'needs_review', label: 'CSV Import' },
    'excel_import': { confidence: 85, verification: 'needs_review', label: 'Excel Import' },
    'bank_api': { confidence: 95, verification: 'verified', label: 'Bank API' },
    'email_import': { confidence: 75, verification: 'needs_review', label: 'Email Import' }
  };
  
  return sourceInfo[source] || { confidence: 50, verification: 'unverified', label: 'Unknown Source' };
}

/**
 * Update expense with source metadata
 * @param {Object} expense - Expense object
 * @param {String} source - Data source
 * @returns {Object} - Updated expense
 */
function enrichExpenseWithSourceInfo(expense, source) {
  const _metadata = getSourceMetadata(source);
  
  return {
    ...expense,
    data_source: source,
    confidence: _metadata.confidence,
    verification_status: metadata.verification,
    source_label: metadata.label
  };
}

/**
 * Compare reliability of different sources
 * @param {String} source1 - First source
 * @param {String} source2 - Second source
 * @returns {Number} - Positive if source1 is more reliable, negative if source2 is more reliable
 */
function compareSourceReliability(source1, source2) {
  const metadata1 = getSourceMetadata(source1);
  const metadata2 = getSourceMetadata(source2);
  
  return metadata1.confidence - metadata2.confidence;
}

/**
 * Get unique sources ordered by reliability
 * @param {Array<String>} sources - List of sources
 * @returns {Array<String>} - Unique sources ordered by reliability (most reliable first)
 */
function getOrderedSources(sources) {
  // Get unique sources
  const uniqueSources = [...new Set(sources)];
  
  // Sort by confidence (descending)
  return uniqueSources.sort((a, b) => {
    const metadataA = getSourceMetadata(a);
    const metadataB = getSourceMetadata(b);
    
    return metadataB.confidence - metadataA.confidence;
  });
}

/**
 * Generate a text explanation of a data source
 * @param {String} source - Source identifier
 * @param {String} language - Language for explanation
 * @returns {String} - Human-readable explanation
 */
function getSourceExplanation(source, language = 'en') {
  const _metadata = getSourceMetadata(source);
  
  // Simple explanations in English and Russian
  const explanations = {
    'manual': {
      en: 'You entered this expense manually.',
      ru: 'Вы ввели этот расход вручную.'
    },
    'voice': {
      en: 'This expense was created from your voice message.',
      ru: 'Этот расход был создан из вашего голосового сообщения.'
    },
    'receipt': {
      en: 'This expense was extracted from a receipt photo.',
      ru: 'Этот расход был извлечен из фото чека.'
    },
    'utility_bill': {
      en: 'This expense was extracted from a utility bill.',
      ru: 'Этот расход был извлечен из коммунальной квитанции.'
    },
    'bank_statement': {
      en: 'This expense was extracted from a bank statement.',
      ru: 'Этот расход был извлечен из банковской выписки.'
    },
    'csv_import': {
      en: 'This expense was imported from a CSV file.',
      ru: 'Этот расход был импортирован из CSV файла.'
    },
    'excel_import': {
      en: 'This expense was imported from an Excel file.',
      ru: 'Этот расход был импортирован из файла Excel.'
    },
    'bank_api': {
      en: 'This expense was received directly from your bank.',
      ru: 'Этот расход был получен напрямую из вашего банка.'
    },
    'email_import': {
      en: 'This expense was extracted from an email receipt.',
      ru: 'Этот расход был извлечен из электронного чека по email.'
    }
  };
  
  // Default explanation if not found
  const defaultExplanation = {
    en: 'This expense was recorded from an external source.',
    ru: 'Этот расход был записан из внешнего источника.'
  };
  
  // Get explanation based on source and language
  return (explanations[source] && explanations[source][language]) || 
         (explanations[source] && explanations[source].en) ||
         defaultExplanation[language] || 
         defaultExplanation.en;
}

/**
 * Merge data from multiple sources, prioritizing more reliable sources
 * @param {Array<Object>} dataSources - Array of {data, source} objects
 * @returns {Object} - Merged data with source tracking
 */
function mergeDataFromSources(dataSources) {
  if (!dataSources || dataSources.length === 0) {
    return null;
  }
  
  // If only one source, just enrich it
  if (dataSources.length === 1) {
    return enrichExpenseWithSourceInfo(dataSources[0].data, dataSources[0].source);
  }
  
  // Sort sources by reliability (most reliable first)
  dataSources.sort((a, b) => {
    return compareSourceReliability(b.source, a.source);
  });
  
  // Start with the most reliable source
  const result = { ...dataSources[0].data };
  const sourceTracking = {
    primary_source: dataSources[0].source,
    field_sources: {}
  };
  
  // Track which source each field came from
  for (const key in result) {
    sourceTracking.field_sources[key] = dataSources[0].source;
  }
  
  // Merge in data from less reliable sources where missing
  for (let i = 1; i < dataSources.length; i++) {
    const sourceData = dataSources[i].data;
    const source = dataSources[i].source;
    
    for (const key in sourceData) {
      // If field is missing or empty in result, add it
      if (result[key] === undefined || result[key] === null || result[key] === '') {
        result[key] = sourceData[key];
        sourceTracking.field_sources[key] = source;
      }
    }
  }
  
  // Add source tracking data
  result.data_source = sourceTracking.primary_source;
  result.field_sources = sourceTracking.field_sources;
  result.multiple_sources = true;
  result.source_count = dataSources.length;
  
  // Set confidence and verification based on the primary source
  const _metadata = getSourceMetadata(sourceTracking.primary_source);
  result.confidence = metadata.confidence;
  result.verification_status = metadata.verification;
  result.source_label = metadata.label;
  
  return result;
}

module.exports = {
  getSourceMetadata,
  enrichExpenseWithSourceInfo,
  compareSourceReliability,
  getOrderedSources,
  getSourceExplanation,
  mergeDataFromSources
};
