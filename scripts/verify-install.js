const fs = require('fs');
const path = require('path');

function verifyInstall() {
    try {
        console.log('🔍 Verifying installation...');

        // Check if node_modules exists
        const nodeModulesPath = path.resolve(__dirname, '..', 'node_modules');
        if (!fs.existsSync(nodeModulesPath)) {
            throw new Error('node_modules directory not found');
        }

        // Check if package-lock.json exists
        const packageLockPath = path.resolve(__dirname, '..', 'package-lock.json');
        if (!fs.existsSync(packageLockPath)) {
            throw new Error('package-lock.json not found');
        }

        // Check permissions of node_modules
        const stats = fs.statSync(nodeModulesPath);
        const _user = process.env.USER || process.env.USERNAME;
        const owner = stats.uid;

        if (owner !== process.getuid()) {
            console.warn('⚠️  Warning: node_modules is not owned by the current _user');
        }

        // Check for critical dependencies
        const criticalDeps = [
            'express',
            'pg',
            'node-telegram-bot-api',
            'winston'
        ];

        for (const dep of criticalDeps) {
            const depPath = path.join(nodeModulesPath, dep);
            if (!fs.existsSync(depPath)) {
                throw new Error(`Critical dependency ${dep} not found`);
            }
        }

        console.log('✅ Installation verified successfully!');
    } catch (error) {
        console.error('❌ Installation verification failed:', error.message);
        process.exit(1);
    }
}

verifyInstall(); 