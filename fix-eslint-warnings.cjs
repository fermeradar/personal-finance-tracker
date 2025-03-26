const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');

async function fixConsoleStatements() {
    try {
        const eslint = new ESLint();
        const results = await eslint.lintFiles([
            '**/*.js',
            '**/*.jsx'
        ]);
        
        const filesWithConsole = new Map();
        let modified = false;
        
        // Collect all console statements
        results.forEach(result => {
            const consoleWarnings = result.messages.filter(msg => msg.ruleId === 'no-console');
            if (consoleWarnings.length > 0) {
                filesWithConsole.set(result.filePath, consoleWarnings);
            }
        });

        // Create logger utility if it doesn't exist
        const loggerUtilPath = path.join(process.cwd(), 'core/logger-utility.js');
        if (!fs.existsSync(loggerUtilPath)) {
            console.log('Creating logger utility...');
            const loggerContent = `
const logger = {
    info: (...args) => console.log(...args),
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    debug: (...args) => console.debug(...args)
};

module.exports = logger;
`;
            fs.mkdirSync(path.dirname(loggerUtilPath), { recursive: true });
            fs.writeFileSync(loggerUtilPath, loggerContent);
        }

        // Process each file
        for (const [filePath, warnings] of filesWithConsole) {
            console.log(`Processing ${path.basename(filePath)}...`);
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Add logger import if needed
            if (!content.includes('logger') && warnings.length > 0) {
                const relativePath = path.relative(path.dirname(filePath), path.join(process.cwd(), 'core')).replace(/\\/g, '/');
                content = `const logger = require('${relativePath}/logger-utility');\n${content}`;
                modified = true;
            }
            
            // Replace console statements
            content = content.replace(
                /console\.(log|error|warn|info|debug)\((.*?)\);?/g,
                (match, level, args) => {
                    modified = true;
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
            
            if (modified) {
                fs.writeFileSync(filePath, content);
                console.log(`Updated ${path.basename(filePath)}`);
            }
        }
        
        console.log('Done replacing console statements with logger.');
    } catch (error) {
        console.error('Error:', error);
    }
}

fixConsoleStatements().catch(console.error);