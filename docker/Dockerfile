# Telegram Bot Dockerfile
# Use Node.js 18 as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies including PostgreSQL client
RUN apk add --no-cache postgresql-client curl tzdata

# Set timezone
ENV TZ=UTC

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads/temp logs backups cache

# Make scripts executable
RUN chmod +x scripts/*.sh

# Set node environment
ENV NODE_ENV=production

# Expose port if needed (for webhook server)
EXPOSE 9000

# Set health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:9000/health || exit 1

# Run the application
CMD ["node", "src/app.js"]
