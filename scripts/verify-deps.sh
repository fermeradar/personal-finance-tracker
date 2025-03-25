#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Starting dependency verification...${NC}"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found${NC}"
    exit 1
fi

# Clean npm cache
echo -e "${YELLOW}🧹 Cleaning npm cache...${NC}"
npm cache clean --force

# Remove existing node_modules and package-lock.json
echo -e "${YELLOW}🗑️ Removing existing node_modules and package-lock.json...${NC}"
rm -rf node_modules package-lock.json

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install --no-audit --no-fund

# Check if installation was successful
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

# Check for missing dependencies
echo -e "${YELLOW}🔍 Checking for missing dependencies...${NC}"
if [ ! -f "package-lock.json" ]; then
    echo -e "${RED}❌ package-lock.json not found after installation${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dependency verification completed successfully${NC}"
exit 0 