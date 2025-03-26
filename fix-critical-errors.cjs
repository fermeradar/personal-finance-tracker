const fs = require('fs');
const path = require('path');

function fixCriticalErrors() {
    // 1. Fix benchmark-scene.js unreachable code and undefined variables
    const benchmarkPath = 'bot/scenes/benchmark-scene.js';
    if (fs.existsSync(benchmarkPath)) {
        console.log('Fixing benchmark-scene.js...');
        let content = fs.readFileSync(benchmarkPath, 'utf8');
        const lines = content.split('\n');
        
        // Remove unreachable code lines
        [192, 198, 204, 210, 671, 677, 683, 688, 751, 756, 761, 766].forEach(lineNum => {
            lines[lineNum - 1] = '';
        });

        // Add quarter declaration at the beginning of the function
        const functionStart = lines.findIndex(line => line.includes('async function getBenchmarkData'));
        if (functionStart !== -1) {
            lines.splice(functionStart + 1, 0, '    let quarter;');
        }

        fs.writeFileSync(benchmarkPath, lines.join('\n'));
    }

    // 2. Fix telegram-bot-command-handlers.js break token
    const handlersPath = 'bot/telegram-bot-command-handlers.js';
    if (fs.existsSync(handlersPath)) {
        console.log('Fixing telegram-bot-command-handlers.js...');
        let content = fs.readFileSync(handlersPath, 'utf8');
        // Fix break statement around line 389
        const lines = content.split('\n');
        if (lines[388] && lines[388].includes('break')) {
            lines[388] = '        break;';  // Add semicolon and proper indentation
        }
        fs.writeFileSync(handlersPath, lines.join('\n'));
    }

    // 3. Fix expense-benchmarking-service.js case token
    const benchmarkingPath = 'services/analytics/expense-benchmarking-service.js';
    if (fs.existsSync(benchmarkingPath)) {
        console.log('Fixing expense-benchmarking-service.js...');
        let content = fs.readFileSync(benchmarkingPath, 'utf8');
        // Fix case statement around line 115
        const lines = content.split('\n');
        if (lines[114] && lines[114].includes('case')) {
            // Add block structure
            lines[114] = lines[114].trim() + ' {';
            // Find next case/default or end of switch
            let endIndex = lines.findIndex((line, i) => i > 114 && (line.includes('case') || line.includes('default')));
            if (endIndex === -1) endIndex = lines.findIndex((line, i) => i > 114 && line.includes('}'));
            // Add break and closing brace
            lines.splice(endIndex, 0, '            break;\n        }');
        }
        fs.writeFileSync(benchmarkingPath, lines.join('\n'));
    }

    // 4. Fix telegram-example.js duplicate logger
    const examplePath = 'src/examples/telegram-example.js';
    if (fs.existsSync(examplePath)) {
        console.log('Fixing telegram-example.js...');
        let content = fs.readFileSync(examplePath, 'utf8');
        // Remove duplicate logger declaration
        const lines = content.split('\n');
        const loggerLines = lines.reduce((acc, line, index) => {
            if (line.trim().startsWith('const logger')) {
                acc.push(index);
            }
            return acc;
        }, []);
        
        if (loggerLines.length > 1) {
            // Keep first logger declaration, remove second
            lines.splice(loggerLines[1], 1);
            fs.writeFileSync(examplePath, lines.join('\n'));
        }
    }
}

try {
    fixCriticalErrors();
    console.log('Done fixing critical errors. Running ESLint to verify...');
} catch (error) {
    console.error('Error:', error);
}