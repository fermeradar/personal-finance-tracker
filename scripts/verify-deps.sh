#!/bin/bash

# Exit on error
set -e

echo "🔍 Starting dependency verification..."

# Function to print colored output
print_status() {
    if [ "$1" = "success" ]; then
        echo -e "\033[32m✅ $2\033[0m"
    elif [ "$1" = "error" ]; then
        echo -e "\033[31m❌ $2\033[0m"
    else
        echo -e "\033[33m⚠️ $2\033[0m"
    fi
}

# Check if package.json exists
if [ ! -f "package.json" ]; then
    print_status "error" "package.json not found"
    exit 1
fi

# Check if package-lock.json exists
if [ ! -f "package-lock.json" ]; then
    print_status "error" "package-lock.json not found"
    exit 1
fi

# Clean npm cache
echo "🧹 Cleaning npm cache..."
npm cache clean --force

# Remove existing node_modules and package-lock.json
echo "🗑️ Removing existing node_modules and package-lock.json..."
rm -rf node_modules package-lock.json

# Install dependencies
echo "📦 Installing dependencies..."
npm install --no-audit --no-fund --legacy-peer-deps

# Verify package-lock.json was generated
if [ ! -f "package-lock.json" ]; then
    print_status "error" "package-lock.json was not generated"
    exit 1
fi

# Check for missing dependencies
echo "🔍 Checking for missing dependencies..."
if ! npm list --depth=0 > /dev/null 2>&1; then
    print_status "error" "Missing dependencies found"
    npm list --depth=0
    exit 1
fi

# Check for outdated dependencies
echo "📅 Checking for outdated dependencies..."
OUTDATED=$(npm outdated)
if [ ! -z "$OUTDATED" ]; then
    print_status "warning" "Outdated dependencies found:"
    echo "$OUTDATED"
    echo "Consider running 'npm update' to update dependencies"
fi

# Check for security vulnerabilities
echo "🔒 Checking for security vulnerabilities..."
AUDIT=$(npm audit)
if echo "$AUDIT" | grep -q "found [0-9] vulnerabilities"; then
    print_status "warning" "Security vulnerabilities found"
    echo "$AUDIT"
    echo "Consider running 'npm audit fix' to fix vulnerabilities"
fi

# Verify package.json and package-lock.json are in sync
echo "🔄 Verifying package.json and package-lock.json are in sync..."
if ! npm install --package-lock-only; then
    print_status "error" "package.json and package-lock.json are out of sync"
    exit 1
fi

# Check for duplicate dependencies
echo "🔍 Checking for duplicate dependencies..."
DUPLICATES=$(npm ls | grep "deduped" -v | grep -v "UNMET PEER DEPENDENCY" | grep -v "npm ERR!")
if [ ! -z "$DUPLICATES" ]; then
    print_status "warning" "Duplicate dependencies found:"
    echo "$DUPLICATES"
    echo "Consider running 'npm dedupe' to remove duplicates"
fi

# Check for circular dependencies
echo "🔄 Checking for circular dependencies..."
CIRCULAR=$(npm ls | grep "circular")
if [ ! -z "$CIRCULAR" ]; then
    print_status "warning" "Circular dependencies found:"
    echo "$CIRCULAR"
fi

print_status "success" "Dependency verification completed successfully!" 