// src/services/i18n.js
const { format } = require('date-fns');
const { ru, enUS } = require('date-fns/locale');

// Translations
const translations = {
  en: require('../locales/en.json'),
  ru: require('../locales/ru.json'),
  // Add more languages as needed
};

// Currency formatting options by locale
const currencyFormatters = {
  en: {
    style: 'currency',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  },
  ru: {
    style: 'currency',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    currencyDisplay: 'symbol'
  }
};

// Date locale mappers
const dateLocales = {
  en: enUS,
  ru: ru
};

// Date formats by locale
const dateFormats = {
  en: 'yyyy-MM-dd',
  ru: 'dd.MM.yyyy'
};

/**
 * Translate a key to the target language
 * @param {String} key - Translation key
 * @param {String} language - Target language
 * @param {Object} params - Parameters for interpolation
 * @returns {String} - Translated text
 */
function translate(key, language = 'en', params = {}) {
  const langTranslations = translations[language] || translations.en;
  let text = langTranslations[key] || key;
  
  // Simple parameter replacement
  Object.entries(params).forEach(([param, value]) => {
    text = text.replace(new RegExp(`\\{\\{\\s*${param}\\s*\\}\\}`, 'g'), value);
  });
  
  return text;
}

/**
 * Format currency for display
 * @param {Number} amount - Amount to format
 * @param {String} currency - Currency code
 * @param {String} language - Target language
 * @returns {String} - Formatted currency
 */
function formatCurrency(amount, currency = 'EUR', language = 'en') {
  const options = {
    ...currencyFormatters[language] || currencyFormatters.en,
    currency
  };
  
  return new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', options).format(amount);
}

/**
 * Format date for display
 * @param {Date|String} date - Date to format
 * @param {String} formatString - Optional custom format string
 * @param {String} language - Target language
 * @returns {String} - Formatted date
 */
function formatDate(date, formatString = null, language = 'en') {
  const dateObj = date instanceof Date ? date : new Date(date);
  const locale = dateLocales[language] || dateLocales.en;
  const dateFormat = formatString || dateFormats[language] || dateFormats.en;
  
  return format(dateObj, dateFormat, { locale });
}

/**
 * Get localized emoji based on language
 * @param {String} key - Emoji key
 * @param {String} language - Target language
 * @returns {String} - Emoji
 */
function getEmoji(key, language = 'en') {
  // Some cultures might prefer different emoji for the same concept
  // For simplicity, we use the same emoji for all languages here
  const emojiMap = {
    'expense': '💰',
    'income': '💵',
    'budget': '📊',
    'saving': '💲',
    'settings': '⚙️',
    'report': '📈',
    'receipt': '🧾',
    'category': '📂',
    'date': '📅',
    'time': '⏰',
    'location': '📍',
    'vendor': '🏪',
    'add': '➕',
    'remove': '➖',
    'edit': '✏️',
    'delete': '🗑️',
    'confirm': '✅',
    'cancel': '❌',
    'warning': '⚠️',
    'error': '❗',
    'info': 'ℹ️',
    'help': '❓',
    'language': '🌐',
    'currency': '💱',
    'search': '🔍',
    'filter': '🔍',
    'sort': '🔢',
    'export': '📤',
    'import': '📥',
    'user': '👤',
    'users': '👥',
    'admin': '👑',
    'backup': '💾',
    'restore': '🔄',
    'chart': '📊',
    'success': '✅',
    'failure': '❌',
    'loading': '⏳',
    'done': '✅'
  };
  
  return emojiMap[key] || '';
}

/**
 * Format a message with emoji and translation
 * @param {String} key - Translation key
 * @param {String} emojiKey - Emoji key 
 * @param {String} language - Target language
 * @param {Object} params - Translation parameters
 * @returns {String} - Formatted message with emoji and translation
 */
function formatMessage(key, emojiKey, language = 'en', params = {}) {
  const emoji = getEmoji(emojiKey, language);
  const text = translate(key, language, params);
  
  return `${emoji} ${text}`;
}

/**
 * Get list of supported languages
 * @returns {Array} - List of supported language codes
 */
function getSupportedLanguages() {
  return Object.keys(translations);
}

/**
 * Get display name for a language code
 * @param {String} code - Language code
 * @param {String} displayLanguage - Language to display the name in
 * @returns {String} - Language display name
 */
function getLanguageDisplayName(code, displayLanguage = 'en') {
  const languageNames = {
    en: {
      en: 'English',
      ru: 'Russian'
      // Add more languages as needed
    },
    ru: {
      en: 'Английский',
      ru: 'Русский'
      // Add more languages as needed
    }
  };
  
  // Default to English names if translation not available
  const names = languageNames[displayLanguage] || languageNames.en;
  return names[code] || code;
}

module.exports = {
  translate,
  formatCurrency,
  formatDate,
  getEmoji,
  formatMessage,
  getSupportedLanguages,
  getLanguageDisplayName,
  // Export for direct use of translations
  translations
};
