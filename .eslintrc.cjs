// .eslintrc.cjs
module.exports = {
  // Set the ECMAScript version to modern JavaScript
  parserOptions: {
    ecmaVersion: 2022,  // This supports all modern JS features
    sourceType: 'module',  // Allows import/export statements
    ecmaFeatures: {
      jsx: true  // Enable JSX
    }
  },
  
  // Set the environment - adding test frameworks
  env: {
    node: true,      // For Node.js
    browser: true,   // For browser code
    es2022: true,    // Enable all ES2022 features
    jest: true,      // Add Jest environment
    mocha: true      // Add Mocha environment
  },
  
  globals: {
    // Add common test globals
    describe: 'readonly',
    it: 'readonly',
    expect: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    jest: 'readonly'
  },
  
  extends: [
    'eslint:recommended',
    'plugin:react/recommended'  // Add React plugin
  ],
  
  settings: {
    react: {
      version: 'detect'  // Automatically detect React version
    }
  },
  
  plugins: [
    'react'  // Add React plugin
  ],
  
  // Rules configuration
  rules: {
    // Allow console in development scripts
    "no-console": ["warn", { 
      allow: ["warn", "error"] 
    }],
    
    // Allow unused vars with underscore prefix
    "no-unused-vars": ["warn", { 
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }],
    
    // Other rules as warnings instead of errors
    "no-process-exit": "warn",
    "no-shadow-restricted-names": "warn",
    "no-dupe-keys": "warn"
  },
  
  // Override rules for specific files
  overrides: [
    {
      // For script files, allow console and process.exit
      files: [
        "scripts/**/*.js",
        "*eslint-fixer.js",
        "improved-eslint-fixer.js"
      ],
      rules: {
        "no-console": "off",
        "no-process-exit": "off"
      }
    },
    {
      // For test files, be more lenient
      files: ["tests/**/*.js", "**/*.test.js", "**/*.spec.js"],
      rules: {
        "no-console": "off",
        "no-unused-vars": "warn"
      }
    },
    {
      files: [
        "core/app.js",
        "src/app.js"
      ],
      rules: {
        "no-process-exit": "off"
      }
    }
  ]
};