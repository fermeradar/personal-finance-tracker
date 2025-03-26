const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');

async function fixCaseDeclarations() {
    try {
        const eslint = new ESLint();
        const results = await eslint.lintFiles([
            '**/*.js',
            '**/*.jsx'
        ]);
        
        const filesWithCaseIssues = new Map();
        
        // Collect all case declaration issues
        results.forEach(result => {
            const caseWarnings = result.messages.filter(msg => msg.ruleId === 'no-case-declarations');
            if (caseWarnings.length > 0) {
                filesWithCaseIssues.set(result.filePath, caseWarnings);
            }
        });

        // Process each file
        for (const [filePath, warnings] of filesWithCaseIssues) {
            console.log(`Processing ${path.basename(filePath)}...`);
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Fix case declarations by adding blocks
            content = content.replace(
                /case\s+(['"][^'"]+['"]|\w+):\s*\n?\s*(let|const|var)\s+/g,
                (match, caseValue) => `case ${caseValue}: {\n    `
            );
            
            // Add closing braces for case blocks
            content = content.replace(
                /(case\s+(['"][^'"]+['"]|\w+):\s*{[\s\S]*?)(?=\s*(?:case|default|}))/g,
                '$1\n    break;\n}'
            );
            
            fs.writeFileSync(filePath, content);
            console.log(`Updated ${path.basename(filePath)}`);
        }
        
        console.log('Done fixing case declarations.');
    } catch (error) {
        console.error('Error:', error);
    }
}

fixCaseDeclarations().catch(console.error);