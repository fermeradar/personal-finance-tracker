const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

function getConsoleStatementsFromLintOutput() {
  try {
    const output = execSync('npm run lint', { encoding: 'utf8' });
    const consoleStatements = new Map();
    
    const lines = output.split('\n');
    let currentFile = '';
    
    for (const line of lines) {
      const fileMatch = line.match(/\/([^:]+):/);
      if (fileMatch) {
        currentFile = fileMatch[1];
        if (!consoleStatements.has(currentFile)) {
          consoleStatements.set(currentFile, []);
        }
      }
      
      if (line.includes('Unexpected console statement')) {
        const lineNumber = line.match(/:(\d+):/)?.[1];
        if (lineNumber) {
          consoleStatements.get(currentFile).push(parseInt(lineNumber));
        }
      }
    }
    
    return consoleStatements;
  } catch (error) {
    console.error('Error getting console statements:', error);
    return new Map();
  }
}

function getRelativeLoggerPath(filePath) {
  const segments = filePath.split('/');
  const depth = segments.length - 1;
  const relativePath = '../'.repeat(depth) + 'utils/logger';
  return relativePath;
}

function fixConsoleStatementsInFile(filePath, lineNumbers) {
  console.log(`Processing ${filePath}...`);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    let needsLoggerImport = false;
    
    for (const lineNum of lineNumbers) {
      const line = lines[lineNum - 1];
      if (line.includes('console.')) {
        // Replace console statements with logger
        if (line.includes('console.log')) {
          lines[lineNum - 1] = line.replace('console.log', 'logger.info');
        } else if (line.includes('console.error')) {
          lines[lineNum - 1] = line.replace('console.error', 'logger.error');
        } else if (line.includes('console.warn')) {
          lines[lineNum - 1] = line.replace('console.warn', 'logger.warn');
        } else if (line.includes('console.debug')) {
          lines[lineNum - 1] = line.replace('console.debug', 'logger.debug');
        }
        modified = true;
        needsLoggerImport = true;
      }
    }

    if (modified) {
      // Add logger import if needed
      if (needsLoggerImport && !content.includes('const logger')) {
        const loggerPath = getRelativeLoggerPath(filePath);
        const importStatement = `const logger = require('${loggerPath}');\n`;
        lines.unshift(importStatement);
      }
      
      fs.writeFileSync(filePath, lines.join('\n'));
      console.log(`✓ Fixed console statements in ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return false;
  }
}

// Main execution
console.log('Starting to fix console statements...');
const consoleStatementsMap = getConsoleStatementsFromLintOutput();
let fixedFiles = 0;

for (const [file, lineNumbers] of consoleStatementsMap) {
  if (lineNumbers.length > 0) {
    if (fixConsoleStatementsInFile(file, lineNumbers)) {
      fixedFiles++;
    }
  }
}

console.log(`\nFixed console statements in ${fixedFiles} files.`);
console.log('Running ESLint to verify changes...');

try {
  execSync('npm run lint', { stdio: 'inherit' });
} catch (error) {
  console.log('ESLint found remaining issues to fix.');
}