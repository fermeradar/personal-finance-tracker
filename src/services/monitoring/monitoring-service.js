const Redis = require('ioredis');
const { logger } = require('../../utils/logger');
const { telegramNotification } = require('./telegram-notification-service');

class MonitoringService {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      activeUsers: new Set(),
      endpointUsage: new Map(),
      resourceUsage: {
        cpu: 0,
        memory: 0,
        disk: 0
      }
    };
    this.healthChecks = new Map();
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize Redis keys
      await this.redis.set('monitoring:initialized', Date.now());
      
      // Set up periodic health checks
      setInterval(() => this.runHealthChecks(), 5 * 60 * 1000); // Every 5 minutes
      
      // Set up resource monitoring
      setInterval(() => this.monitorResources(), 1 * 60 * 1000); // Every minute
      
      logger.info('Monitoring service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize monitoring service:', error);
      throw error;
    }
  }

  // Performance Monitoring
  async trackRequest(req, res, next) {
    const startTime = Date.now();
    const path = req.path;
    
    // Track endpoint usage
    this.metrics.endpointUsage.set(
      path,
      (this.metrics.endpointUsage.get(path) || 0) + 1
    );
    
    // Track active users
    if (req.user) {
      this.metrics.activeUsers.add(req.user.id);
    }
    
    // Track response time
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      this.metrics.requestCount++;
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + duration) / 
        this.metrics.requestCount;
      
      // Store metrics in Redis
      this.storeMetrics();
    });
    
    next();
  }

  async trackError(error) {
    this.metrics.errorCount++;
    await this.redis.incr('monitoring:error_count');
    
    // Store error details
    await this.redis.lpush('monitoring:recent_errors', JSON.stringify({
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack
    }));
    
    // Trim recent errors list to last 100
    await this.redis.ltrim('monitoring:recent_errors', 0, 99);
    
    // Alert if error rate is high
    if (this.metrics.errorCount / this.metrics.requestCount > 0.1) {
      await telegramNotification.sendAlert(
        'High Error Rate Detected',
        `Current error rate: ${(this.metrics.errorCount / this.metrics.requestCount * 100).toFixed(2)}%`
      );
    }
  }

  // Usage Analytics
  async trackUserActivity(userId, action, details = {}) {
    const key = `user:${userId}:activity`;
    const activity = {
      timestamp: Date.now(),
      action,
      details
    };
    
    await this.redis.lpush(key, JSON.stringify(activity));
    await this.redis.ltrim(key, 0, 999); // Keep last 1000 activities
    
    // Update user session
    await this.redis.hset(
      `user:${userId}:session`,
      'last_active',
      Date.now()
    );
  }

  async getUsageStats() {
    const stats = {
      totalUsers: this.metrics.activeUsers.size,
      totalRequests: this.metrics.requestCount,
      errorRate: this.metrics.errorCount / this.metrics.requestCount,
      averageResponseTime: this.metrics.averageResponseTime,
      endpointUsage: Object.fromEntries(this.metrics.endpointUsage),
      resourceUsage: this.metrics.resourceUsage
    };
    
    return stats;
  }

  // Health Checks
  async addHealthCheck(name, check) {
    this.healthChecks.set(name, check);
  }

  async runHealthChecks() {
    const results = [];
    
    for (const [name, check] of this.healthChecks) {
      try {
        const result = await check();
        results.push({
          name,
          status: 'healthy',
          details: result
        });
      } catch (error) {
        results.push({
          name,
          status: 'unhealthy',
          error: error.message
        });
        
        // Alert on health check failure
        await telegramNotification.sendAlert(
          'Health Check Failed',
          `Health check "${name}" failed: ${error.message}`
        );
      }
    }
    
    // Store health check results
    await this.redis.set(
      'monitoring:health_checks',
      JSON.stringify(results)
    );
    
    return results;
  }

  // Resource Monitoring
  async monitorResources() {
    try {
      const usage = await this.getResourceUsage();
      this.metrics.resourceUsage = usage;
      
      // Alert on high resource usage
      if (usage.cpu > 80 || usage.memory > 80 || usage.disk > 80) {
        await telegramNotification.sendAlert(
          'High Resource Usage',
          `CPU: ${usage.cpu}%, Memory: ${usage.memory}%, Disk: ${usage.disk}%`
        );
      }
      
      // Store resource metrics
      await this.redis.set(
        'monitoring:resource_usage',
        JSON.stringify(usage)
      );
    } catch (error) {
      logger.error('Failed to monitor resources:', error);
    }
  }

  async getResourceUsage() {
    // This is a placeholder. In a real implementation,
    // you would use system-specific commands or libraries
    // to get actual resource usage
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100
    };
  }

  // Metrics Storage
  async storeMetrics() {
    try {
      await this.redis.set(
        'monitoring:metrics',
        JSON.stringify({
          requestCount: this.metrics.requestCount,
          errorCount: this.metrics.errorCount,
          averageResponseTime: this.metrics.averageResponseTime,
          activeUsers: Array.from(this.metrics.activeUsers),
          endpointUsage: Object.fromEntries(this.metrics.endpointUsage),
          resourceUsage: this.metrics.resourceUsage,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      logger.error('Failed to store metrics:', error);
    }
  }

  // Cleanup
  async cleanup() {
    try {
      // Remove old user sessions
      const keys = await this.redis.keys('user:*:session');
      for (const key of keys) {
        const lastActive = await this.redis.hget(key, 'last_active');
        if (Date.now() - parseInt(lastActive) > 24 * 60 * 60 * 1000) { // 24 hours
          await this.redis.del(key);
        }
      }
      
      // Clean up old activity logs
      const activityKeys = await this.redis.keys('user:*:activity');
      for (const key of activityKeys) {
        await this.redis.ltrim(key, 0, 999);
      }
      
      logger.info('Monitoring cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup monitoring data:', error);
    }
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService; 