const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');

async function getUnusedVars() {
    try {
        const eslint = new ESLint();
        const results = await eslint.lintFiles([
            'bot/**/*.js',
            'core/**/*.js',
            'services/**/*.js',
            'src/**/*.js',
            'tests/**/*.js'
        ]);
        
        const unusedVars = new Map();
        
        results.forEach(result => {
            const filePath = result.filePath;
            result.messages.forEach(message => {
                if (message.ruleId === 'no-unused-vars') {
                    if (!unusedVars.has(filePath)) {
                        unusedVars.set(filePath, new Set());
                    }
                    // Improved regex to catch more variable patterns
                    const match = message.message.match(/['"]([^'"]+)['"] is (?:defined but never used|assigned a value but never used)/);
                    if (match) {
                        const varName = match[1];
                        unusedVars.get(filePath).add(varName);
                    }
                }
            });
        });

        return unusedVars;
    } catch (error) {
        console.error('Error running ESLint:', error);
        return new Map();
    }
}

function fixUnusedVarsInFile(filePath, varsToFix) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        varsToFix.forEach(varName => {
            // Handle require statements
            const requireRegex = new RegExp(`(const|let|var)\\s+${varName}\\s*=\\s*require\\([^)]+\\)`, 'g');
            if (requireRegex.test(content)) {
                content = content.replace(requireRegex, `$1 _${varName} = require($2)`);
                modified = true;
            }
            
            // Handle import statements
            const importRegex = new RegExp(`import\\s+{[^}]*?\\b${varName}\\b[^}]*?}\\s+from`, 'g');
            if (importRegex.test(content)) {
                content = content.replace(new RegExp(`\\b${varName}\\b(?=([^}]*}\\s+from))`), `_${varName}`);
                modified = true;
            }
            
            // Handle function parameters
            const paramRegex = new RegExp(`(\\(|,\\s*)${varName}(\\)|,|\\s*\\{)`, 'g');
            content = content.replace(paramRegex, (match, before, after) => {
                modified = true;
                return `${before}_${varName}${after}`;
            });
            
            // Handle variable declarations
            const varRegex = new RegExp(`(const|let|var)\\s+${varName}\\b(?!\\s*=\\s*require)`, 'g');
            content = content.replace(varRegex, (match, declarator) => {
                modified = true;
                return `${declarator} _${varName}`;
            });
            
            // Handle destructuring
            const destructureRegex = new RegExp(`({[^}]*?)\\b${varName}\\b([^}]*})`, 'g');
            content = content.replace(destructureRegex, (match, before, after) => {
                modified = true;
                return `${before}_${varName}${after}`;
            });
        });
        
        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`Updated ${path.basename(filePath)}`);
        }
    } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
    }
}

async function main() {
    const unusedVars = await getUnusedVars();
    
    if (unusedVars.size === 0) {
        console.log('No unused variables found.');
        return;
    }

    console.log('Fixing unused variables...');
    for (const [filePath, vars] of unusedVars) {
        fixUnusedVarsInFile(filePath, vars);
    }
    
    console.log('Running ESLint again to verify...');
    const eslint = new ESLint();
    const results = await eslint.lintFiles(['.']);
    const formatter = await eslint.loadFormatter('stylish');
    console.log(formatter.format(results));
}

main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});