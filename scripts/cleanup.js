const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function cleanup() {
    try {
        console.log('🧹 Starting cleanup...');

        const projectRoot = path.resolve(__dirname, '..');

        // Clean up node_modules
        const nodeModulesPath = path.join(projectRoot, 'node_modules');
        if (fs.existsSync(nodeModulesPath)) {
            console.log('Removing node_modules...');
            execSync(`rm -rf "${nodeModulesPath}"`, { stdio: 'inherit' });
        }

        // Clean up package-lock.json
        const packageLockPath = path.join(projectRoot, 'package-lock.json');
        if (fs.existsSync(packageLockPath)) {
            console.log('Removing package-lock.json...');
            fs.unlinkSync(packageLockPath);
        }

        // Clean up logs
        const logsPath = path.join(projectRoot, 'logs');
        if (fs.existsSync(logsPath)) {
            console.log('Cleaning up logs...');
            execSync(`rm -rf "${logsPath}"/*`, { stdio: 'inherit' });
        }

        // Clean up coverage reports
        const coveragePath = path.join(projectRoot, 'coverage');
        if (fs.existsSync(coveragePath)) {
            console.log('Removing coverage reports...');
            execSync(`rm -rf "${coveragePath}"`, { stdio: 'inherit' });
        }

        // Clean up temporary files
        const tempFiles = [
            '.DS_Store',
            '*.log',
            '*.tmp',
            '*.temp'
        ];

        for (const pattern of tempFiles) {
            console.log(`Removing ${pattern}...`);
            execSync(`find "${projectRoot}" -name "${pattern}" -type f -delete`, { stdio: 'inherit' });
        }

        console.log('✅ Cleanup completed successfully!');
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        process.exit(1);
    }
}

cleanup(); 