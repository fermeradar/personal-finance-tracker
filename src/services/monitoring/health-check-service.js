const { Pool } = require('pg');
const Redis = require('ioredis');
const { logger } = require('../../utils/logger');
const monitoringService = require('./monitoring-service');

class HealthCheckService {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    this.redis = new Redis(process.env.REDIS_URL);
    this.initialize();
  }

  async initialize() {
    try {
      // Register health checks
      await monitoringService.addHealthCheck('database', this.checkDatabase.bind(this));
      await monitoringService.addHealthCheck('redis', this.checkRedis.bind(this));
      await monitoringService.addHealthCheck('api', this.checkApi.bind(this));
      await monitoringService.addHealthCheck('disk_space', this.checkDiskSpace.bind(this));
      
      logger.info('Health check service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize health check service:', error);
      throw error;
    }
  }

  async checkDatabase() {
    try {
      const client = await this.pool.connect();
      try {
        // Check database connection
        await client.query('SELECT 1');
        
        // Check database size
        const sizeResult = await client.query(`
          SELECT pg_database_size(current_database()) as size
        `);
        
        // Check active connections
        const connectionsResult = await client.query(`
          SELECT count(*) as count 
          FROM pg_stat_activity 
          WHERE state = 'active'
        `);
        
        return {
          status: 'healthy',
          size: sizeResult.rows[0].size,
          activeConnections: parseInt(connectionsResult.rows[0].count)
        };
      } finally {
        client.release();
      }
    } catch (error) {
      throw new Error(`Database health check failed: ${error.message}`);
    }
  }

  async checkRedis() {
    try {
      // Check Redis connection
      await this.redis.ping();
      
      // Check Redis memory usage
      const info = await this.redis.info('memory');
      const usedMemory = info.match(/used_memory:(\d+)/)[1];
      
      return {
        status: 'healthy',
        usedMemory: parseInt(usedMemory)
      };
    } catch (error) {
      throw new Error(`Redis health check failed: ${error.message}`);
    }
  }

  async checkApi() {
    try {
      // Check API endpoints
      const endpoints = [
        '/api/health',
        '/api/auth/login',
        '/api/users/me'
      ];
      
      const results = await Promise.all(
        endpoints.map(async (endpoint) => {
          try {
            const response = await fetch(`${process.env.API_URL}${endpoint}`);
            return {
              endpoint,
              status: response.status,
              responseTime: response.headers.get('x-response-time')
            };
          } catch (error) {
            return {
              endpoint,
              status: 'error',
              error: error.message
            };
          }
        })
      );
      
      const unhealthy = results.filter(r => r.status !== 200);
      
      if (unhealthy.length > 0) {
        throw new Error(`API health check failed for endpoints: ${unhealthy.map(r => r.endpoint).join(', ')}`);
      }
      
      return {
        status: 'healthy',
        endpoints: results
      };
    } catch (error) {
      throw new Error(`API health check failed: ${error.message}`);
    }
  }

  async checkDiskSpace() {
    try {
      // This is a placeholder. In a real implementation,
      // you would use system-specific commands or libraries
      // to get actual disk space usage
      const usage = await monitoringService.getResourceUsage();
      
      if (usage.disk > 90) {
        throw new Error(`High disk usage: ${usage.disk}%`);
      }
      
      return {
        status: 'healthy',
        diskUsage: usage.disk
      };
    } catch (error) {
      throw new Error(`Disk space check failed: ${error.message}`);
    }
  }

  // Cleanup
  async cleanup() {
    try {
      await this.pool.end();
      await this.redis.quit();
      logger.info('Health check service cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup health check service:', error);
    }
  }
}

// Create singleton instance
const healthCheckService = new HealthCheckService();

module.exports = healthCheckService; 