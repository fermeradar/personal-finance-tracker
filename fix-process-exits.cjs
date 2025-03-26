const fs = require('fs');
const { execSync } = require('child_process');

function getProcessExitsFromLintOutput() {
  try {
    const output = execSync('npm run lint', { encoding: 'utf8' });
    const processExits = new Map();
    
    const lines = output.split('\n');
    let currentFile = '';
    
    for (const line of lines) {
      const fileMatch = line.match(/\/([^:]+):/);
      if (fileMatch) {
        currentFile = fileMatch[1];
        if (!processExits.has(currentFile)) {
          processExits.set(currentFile, []);
        }
      }
      
      if (line.includes("Don't use process.exit(); throw an error instead")) {
        const lineNumber = line.match(/:(\d+):/)?.[1];
        if (lineNumber) {
          processExits.get(currentFile).push(parseInt(lineNumber));
        }
      }
    }
    
    return processExits;
  } catch (error) {
    console.error('Error getting process.exit calls:', error);
    return new Map();
  }
}

function fixProcessExitsInFile(filePath, lineNumbers) {
  console.log(`Processing ${filePath}...`);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    
    for (const lineNum of lineNumbers) {
      const line = lines[lineNum - 1];
      if (line.includes('process.exit')) {
        // Replace process.exit with throw
        const exitCode = line.match(/process\.exit\((\d+)\)/)?.[1] || '1';
        const errorMessage = exitCode === '0' ? 
          'Process completed' : 
          `Process failed with code ${exitCode}`;
        
        lines[lineNum - 1] = line.replace(
          /process\.exit\(\d*\)/,
          `throw new Error('${errorMessage}')`
        );
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, lines.join('\n'));
      console.log(`✓ Fixed process.exit calls in ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return false;
  }
}

// Main execution
console.log('Starting to fix process.exit calls...');
const processExitsMap = getProcessExitsFromLintOutput();
let fixedFiles = 0;

for (const [file, lineNumbers] of processExitsMap) {
  if (lineNumbers.length > 0) {
    if (fixProcessExitsInFile(file, lineNumbers)) {
      fixedFiles++;
    }
  }
}

console.log(`\nFixed process.exit calls in ${fixedFiles} files.`);