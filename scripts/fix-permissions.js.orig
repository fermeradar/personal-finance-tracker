const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function fixPermissions() {
    try {
        const projectRoot = path.resolve(__dirname, '..');
        const user = process.env.USER || process.env.USERNAME;

        console.log('🔧 Fixing project permissions...');

        // Fix ownership of all files
        execSync(`sudo chown -R ${user} "${projectRoot}"`, { stdio: 'inherit' });

        // Fix directory permissions
        execSync(`find "${projectRoot}" -type d -exec chmod 755 {} \\;`, { stdio: 'inherit' });

        // Fix file permissions
        execSync(`find "${projectRoot}" -type f -exec chmod 644 {} \\;`, { stdio: 'inherit' });

        // Make scripts executable
        execSync(`chmod +x "${projectRoot}/scripts/"*.js`, { stdio: 'inherit' });

        // Clean up node_modules if it exists
        const nodeModulesPath = path.join(projectRoot, 'node_modules');
        if (fs.existsSync(nodeModulesPath)) {
            console.log('🧹 Cleaning up node_modules...');
            execSync(`rm -rf "${nodeModulesPath}"`, { stdio: 'inherit' });
        }

        // Clean up package-lock.json if it exists
        const packageLockPath = path.join(projectRoot, 'package-lock.json');
        if (fs.existsSync(packageLockPath)) {
            console.log('🧹 Cleaning up package-lock.json...');
            fs.unlinkSync(packageLockPath);
        }

        console.log('✅ Permissions fixed successfully!');
    } catch (error) {
        console.error('❌ Error fixing permissions:', error.message);
        process.exit(1);
    }
}

fixPermissions(); 