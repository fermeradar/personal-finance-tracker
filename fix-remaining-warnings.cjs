const fs = require('fs');
const path = require('path');

function fixFiles() {
    // 1. Fix shadowing in improved-eslint-fixer.js
    const eslintFixerPath = 'improved-eslint-fixer.js';
    if (fs.existsSync(eslintFixerPath)) {
        let content = fs.readFileSync(eslintFixerPath, 'utf8');
        // Replace 'undefined' with 'isUndefined' or similar
        content = content.replace(/const undefined = /g, 'const isUndefined = ');
        fs.writeFileSync(eslintFixerPath, content);
        console.log('✓ Fixed shadowing in improved-eslint-fixer.js');
    }

    // 2. Fix unused variables in expense-benchmarking-service.js
    const benchmarkPath = 'services/analytics/expense-benchmarking-service.js';
    if (fs.existsSync(benchmarkPath)) {
        let content = fs.readFileSync(benchmarkPath, 'utf8');
        // Add underscore prefix to benchmarkType
        content = content.replace(/const benchmarkType = /g, 'const _benchmarkType = ');
        fs.writeFileSync(benchmarkPath, content);
        console.log('✓ Fixed unused variable in expense-benchmarking-service.js');
    }

    // 3. Fix unused variables in i18n-service.js
    const i18nPath = 'services/localization/i18n-service.js';
    if (fs.existsSync(i18nPath)) {
        let content = fs.readFileSync(i18nPath, 'utf8');
        // Add underscore prefix to all 'language' variables
        content = content.replace(/(\b(?:const|let|var)\s+)language(\s*=)/g, '$1_language$2');
        fs.writeFileSync(i18nPath, content);
        console.log('✓ Fixed unused variables in i18n-service.js');
    }

    // 4. Fix duplicate keys in error-monitoring-service.js
    const monitoringPath = 'src/services/monitoring/error-monitoring-service.js';
    if (fs.existsSync(monitoringPath)) {
        let content = fs.readFileSync(monitoringPath, 'utf8');
        // Find the configuration object and remove duplicate keys
        const configStart = content.indexOf('{', content.indexOf('Sentry.init'));
        const configEnd = content.indexOf('}', configStart);
        if (configStart !== -1 && configEnd !== -1) {
            // Extract config object
            const configText = content.slice(configStart, configEnd + 1);
            // Parse and remove duplicates
            const config = eval(`(${configText})`);
            const cleanConfig = JSON.stringify(config, null, 2)
                .replace(/"([^"]+)":/g, '$1:')
                .replace(/"/g, "'");
            
            // Replace old config with new one
            content = content.slice(0, configStart) + cleanConfig + content.slice(configEnd + 1);
            fs.writeFileSync(monitoringPath, content);
            console.log('✓ Fixed duplicate keys in error-monitoring-service.js');
        }
    }
}

try {
    fixFiles();
    console.log('\nDone! Running ESLint to verify...');
    require('child_process').execSync('npm run lint', { stdio: 'inherit' });
} catch (error) {
    console.error('Error:', error);
}