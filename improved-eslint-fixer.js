// improved-eslint-fixer.js
// Script to automatically fix common ESLint issues
const fs = require('fs');
const path = require('path');
const { _execSync } = require('child_process');

// Configuration for how to handle different types of errors
const config = {
  unusedVarsPrefix: true,      // Add underscore prefix to unused variables
  removeConsoleStatements: false, // Set to true to remove console statements
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
function fixUnusedVariables(content, unusedVars) {
  let modifiedContent = content;
  
  for (const varName of unusedVars) {
    if (!varName.startsWith('_')) {
      const varRegex = new RegExp(`\\b(const|let|var)\\s+(${varName})\\b`, 'g');
      modifiedContent = modifiedContent.replace(varRegex, `$1 _${varName}`);
      
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
  const regex = /(case\s+[^:]+:(?:\s*\/\/[^\n]*)?\s*)(let|const)\s+([^=;]+)/g;
  return content.replace(regex, '$1{ $2 $3');
}

// Fix undefined variables by adding import statements
function fixNotFoundVariables(content, notFoundVars) {
  let modifiedContent = content;
  
  const importMap = {
    'pool': "const { pool } = require('../config/database');",
    'userLanguage': "const { userLanguage } = require('../services/localization/language-handling-service');",
    'currencyConverter': "const currencyConverter = require('../services/core/currency-conversion-service');",
    'looksLikeExpense': "const { looksLikeExpense } = require('../services/expense/expense-detection-service');",
    'processNaturalLanguageExpense': "const { processNaturalLanguageExpense } = require('../services/expense/expense-processing-service');"
  };
  
  for (const varName of notFoundVars) {
    if (importMap[varName] && !modifiedContent.includes(`const ${varName}`)) {
      modifiedContent = `${importMap[varName]}\n${modifiedContent}`;
    }
  }
  
  return modifiedContent;
}

// Replace process.exit() calls with throw new Error()
function fixProcessExit(content) {
  const regex = /process\.exit\(\s*(\d+)\s*\)\s*;/g;
  return content.replace(regex, (match, exitCode) => {
    return `throw new Error(\`Exiting with code ${exitCode}\`);`;
  });
}

// Handle console statements
function handleConsoleStatements(content) {
  if (config.removeConsoleStatements) {
    return content.replace(/\s*console\.(log|warn|error)\(.*?\);(\r?\n)?/g, '');
  } else {
    return content.replace(/(\n\s*)(console\.(log|warn|error)\(.*?\);)/g, '$1// eslint-disable-next-line no-console\n$1$2');
  }
}

// Process a single file
function processFile(filePath, unusedVars = [], notFoundVars = []) {
  console.log(`Processing ${filePath}...`);
  
  const content = readFile(filePath);
  if (!content) return;
  
  let modifiedContent = content;
  
  if (config.unusedVarsPrefix && unusedVars.length > 0) {
    modifiedContent = fixUnusedVariables(modifiedContent, unusedVars);
  }
  
  if (config.fixLexicalDeclarations) {
    modifiedContent = fixLexicalDeclarations(modifiedContent);
  }
  
  if (config.fixUndefinedVariables && notFoundVars.length > 0) {
    modifiedContent = fixNotFoundVariables(modifiedContent, notFoundVars);
  }
  
  if (config.fixProcessExit) {
    modifiedContent = fixProcessExit(modifiedContent);
  }
  
  modifiedContent = handleConsoleStatements(modifiedContent);
  
  if (modifiedContent !== content) {
    if (writeFile(filePath, modifiedContent)) {
      console.log(`Fixed issues in ${filePath}`);
    }
  } else {
    console.log(`No changes needed for ${filePath}`);
  }
}

// Extract problems from ESLint output
function extractProblemsFromOutput(eslintOutput) {
  const fileProblems = {};
  
  const lines = eslintOutput.split('\n');
  let currentFile = null;
  
  for (const line of lines) {
    const fileMatch = line.match(/^\/(.+):$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      fileProblems[currentFile] = { unused: [], notFound: [], files: [] };
      continue;
    }
    
    if (currentFile) {
      const unusedMatch = line.match(/'([^']+)' is (?:assigned a value|defined) but never used/);
      if (unusedMatch) {
        fileProblems[currentFile].unused.push(unusedMatch[1]);
      }
      
      const notFoundMatch = line.match(/'([^']+)' is not defined/);
      if (notFoundMatch) {
        fileProblems[currentFile].notFound.push(notFoundMatch[1]);
      }
    }
  }
  
  return fileProblems;
}

// Main function to process files
function main() {
  let eslintOutput;
  try {
    eslintOutput = fs.readFileSync('paste.txt', 'utf8');
  } catch (error) {
    console.error('Error reading ESLint output:', error);
    return;
  }
  
  const problems = extractProblemsFromOutput(eslintOutput);
  
  for (const [filePath, { unused, notFound }] of Object.entries(problems)) {
    const fullPath = path.join(process.cwd(), filePath);
    
    if (fs.existsSync(fullPath)) {
      processFile(fullPath, unused, notFound);
    } else {
      console.warn(`File not found: ${fullPath}`);
    }
  }
  
  console.log('Finished processing files');
  console.log('Run npm run lint to check for remaining issues');
}

// Execute the main function
main();