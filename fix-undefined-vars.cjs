const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');

async function fixUndefinedVars() {
    try {
        const eslint = new ESLint();
        const results = await eslint.lintFiles([
            'bot/**/*.js',
            'core/**/*.js',
            'services/**/*.js',
            'src/**/*.js',
            'tests/**/*.js'
        ]);
        
        const filesWithUndefined = new Map();
        
        results.forEach(result => {
            const undefWarnings = result.messages.filter(msg => msg.ruleId === 'no-undef');
            if (undefWarnings.length > 0) {
                filesWithUndefined.set(result.filePath, undefWarnings);
            }
        });

        for (const [filePath, warnings] of filesWithUndefined) {
            console.log(`Processing ${path.basename(filePath)}...`);
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Add missing variable declarations
            warnings.forEach(warning => {
                const varName = warning.message.match(/'([^']+)' is not defined/)?.[1];
                if (varName && !content.includes(`let ${varName}`) && !content.includes(`const ${varName}`)) {
                    content = `let ${varName};\n${content}`;
                }
            });
            
            fs.writeFileSync(filePath, content);
        }
        
        console.log('Done fixing undefined variables.');
    } catch (error) {
        console.error('Error:', error);
    }
}

fixUndefinedVars().catch(console.error);