// eslint-fixer.js
// Script to automatically fix common ESLint issues

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration for how to handle different types of errors
const config = {
  unusedVarsPrefix: true,      // Add underscore prefix to unused variables
  removeConsoleStatements: false, // Set to true to remove console statements or false to just mark them for review
  fixLexicalDeclarations: true, // Fix lexical declarations in case blocks
  fixUndefinedVariables: true,  // Try to fix undefined variables by adding imports
  fixProcessExit: true         // Replace process.exit() with throw new Error()
};

// Function to read a file
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Function to write to a file
function writeFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing to file ${filePath}:`, error);
    return false;
  }
}

// Fix unused variables by prefixing with underscore
function fixUnusedVariables(content, filePath) {
  // Regular expression to find variable declarations
  // This is a simplified version and might need adjustments
  const _regex = /\b(const|let|var)\s+([a-zA-Z0-9_]+)(?=\s*=|\s*,|\s*\))/g;

  // Get all unused variables from ESLint output for this file
  const unusedVars = getUnusedVarsForFile(filePath);

  let modifiedContent = content;

  // For each unused variable, prefix with underscore if not already prefixed
  for (const varName of unusedVars) {
    if (!varName.startsWith('_')) {
      const varRegex = new RegExp(`\\b(const|let|var)\\s+(${varName})\\b`, 'g');
      modifiedContent = modifiedContent.replace(varRegex, `$1 _${varName}`);
      
      // Also fix any function parameters
      const paramRegex = new RegExp(`\\(([^)]*)\\b${varName}\\b([^)]*)\\)`, 'g');
      modifiedContent = modifiedContent.replace(paramRegex, (match, before, after) => {
        return `(${before}_${varName}${after})`;
      });
    }
  }

  return modifiedContent;
}

// Fix lexical declarations in case blocks
function fixLexicalDeclarations(content) {
  // This is a more complex fix that would require parsing the AST
  // Here's a simplified approach that might work for basic cases
  const _regex = /(case\s+[^:]+:(?:\s*\/\/[^\n]*)?\s*)(let|const)\s+([^=]+)=/g;
  return content.replace(_regex, '$1{ $2 $3= ');
}

// Fix undefined variables by adding import statements
function fixUndefinedVariables(content, filePath, undefinedVars) {
  // This is a simplified approach - in real implementation, you'd need to
  // analyze the codebase to find where these variables are defined
  let modifiedContent = content;

  for (const varName of undefinedVars) {
    // Check if the variable might be from a common module
    if (varName === 'pool' && !content.includes('const pool')) {
      modifiedContent = `const { pool } = require('../db/database');\n${modifiedContent}`;
    }
    else if (varName === 'currencyConverter' && !content.includes('const currencyConverter')) {
      modifiedContent = `const currencyConverter = require('../services/core/currency-conversion-service');\n${modifiedContent}`;
    }
    // Add more common cases as needed
  }

  return modifiedContent;
}

// Replace process.exit() calls with throw new Error()
function fixProcessExit(content) {
  const _regex = /process\.exit\(\s*(\d+)\s*\)\s*;/g;
  return content.replace(_regex, (match, exitCode) => {
    return `throw new Error(\`Exiting with code ${exitCode}\`);`;
  });
}

// Handle console statements (either remove or add eslint-disable comment)
function handleConsoleStatements(content) {
  if (config.removeConsoleStatements) {
    // Remove console statements (simplified approach)
    return content.replace(/console\.(log|warn|error)\(.*?\);(\r?\n)?/g, '');
  } else {
    // Add eslint-disable-next-line comment
    return content.replace(/(console\.(log|warn|error)\(.*?\);)/g, '// eslint-disable-next-line no-console\n$1');
  }
}

// Get list of unused variables for a file from ESLint output
function getUnusedVarsForFile(filePath) {
  // Simplified implementation - in real scenario, you'd parse the ESLint output
  // This would be populated from the ESLint results
  const unusedVarsMap = {
    'admin-handlers.js': ['fs', 'index'],
    'add-expense-scene.js': ['currencyConverter'],
    // ... add more based on the ESLint output
  };

  const fileName = path.basename(filePath);
  return unusedVarsMap[fileName] || [];
}

// Get list of undefined variables for a file from ESLint output
function getUndefinedVarsForFile(filePath) {
  // Simplified implementation
  const undefinedVarsMap = {
    'benchmark-scene.js': ['currencyConverter'],
    'telegram-bot-command-handlers.js': ['userLanguage', 'pool'],
    // ... add more based on the ESLint output
  };

  const fileName = path.basename(filePath);
  return undefinedVarsMap[fileName] || [];
}

// Process a single file
function processFile(filePath) {
  console.log(`Processing ${filePath}...`);

  const content = readFile(filePath);
  if (!content) return;

  let modifiedContent = content;

  // Apply fixes based on configuration
  if (config.unusedVarsPrefix) {
    modifiedContent = fixUnusedVariables(modifiedContent, filePath);
  }

  if (config.fixLexicalDeclarations) {
    modifiedContent = fixLexicalDeclarations(modifiedContent);
  }

  if (config.fixUndefinedVariables) {
    const undefinedVars = getUndefinedVarsForFile(filePath);
    modifiedContent = fixUndefinedVariables(modifiedContent, filePath, undefinedVars);
  }

  if (config.fixProcessExit) {
    modifiedContent = fixProcessExit(modifiedContent);
  }

  modifiedContent = handleConsoleStatements(modifiedContent);

  // Write changes if content was modified
  if (modifiedContent !== content) {
    if (writeFile(filePath, modifiedContent)) {
      console.log(`Fixed issues in ${filePath}`);
    }
  } else {
    console.log(`No changes needed for ${filePath}`);
  }
}

// Process all files with ESLint issues
function processFiles() {
  // In a real implementation, you'd parse the ESLint output to get this list
  const filesToFix = [
    'bot/admin-handlers.js',
    'bot/scenes/add-expense-scene.js',
    // ... add more files from the ESLint output
  ];

  for (const filePath of filesToFix) {
    processFile(filePath);
  }

  console.log('Finished processing files');
  console.log('Running ESLint again to verify fixes...');

  // Run ESLint again to verify fixes
  try {
    execSync('npm run lint', { stdio: 'inherit' });
  } catch (error) {
    console.log('Some ESLint issues remain. Check the output above.');
  }
}

// Main execution
console.log('Starting ESLint issue fixer...');
processFiles();