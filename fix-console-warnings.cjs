const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');

async function fixConsoleStatements() {
    try {
        const eslint = new ESLint();
        const results = await eslint.lintFiles([
            'bot/**/*.js',
            'core/**/*.js',
            'services/**/*.js',
            'src/**/*.js',
            'tests/**/*.js'
        ]);
        
        const filesWithConsole = new Map();
        
        // Collect all console statements
        results.forEach(result => {
            const consoleWarnings = result.messages.filter(msg => msg.ruleId === 'no-console');
            if (consoleWarnings.length > 0) {
                filesWithConsole.set(result.filePath, consoleWarnings);
            }
        });

        // Process each file
        for (const [filePath, warnings] of filesWithConsole) {
            console.log(`Processing ${path.basename(filePath)}...`);
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Replace console statements with logger
            content = content.replace(
                /console\.(log|error|warn|info|debug)\((.*?)\);?/g,
                (match, level, args) => {
                    switch (level) {
                        case 'log':
                        case 'info':
                            return `logger.info(${args});`;
                        case 'error':
                            return `logger.error(${args});`;
                        case 'warn':
                            return `logger.warn(${args});`;
                        case 'debug':
                            return `logger.debug(${args});`;
                        default:
                            return match;
                    }
                }
            );
            
            // Add logger import if not present
            if (!content.includes('const logger')) {
                content = `const logger = require('../core/logger-utility');\n${content}`;
            }
            
            fs.writeFileSync(filePath, content);
        }
        
        console.log('Done replacing console statements with logger.');
    } catch (error) {
        console.error('Error:', error);
    }
}

fixConsoleStatements().catch(console.error);