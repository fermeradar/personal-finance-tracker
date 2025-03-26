let $2;
const Redis = require('ioredis');
const { logger } = require('../../utils/logger');
const _monitoringService = require($2);

class AnalyticsService {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.initialize();
  }

  async initialize() {
    try {
      // Set up periodic analytics aggregation
      setInterval(() => this.aggregateAnalytics(), 60 * 60 * 1000); // Every hour
      
      logger.info('Analytics service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize analytics service:', error);
      throw error;
    }
  }

  // User Behavior Tracking
  async trackUserAction(userId, action, details = {}) {
    try {
      const timestamp = Date.now();
      const key = `analytics:user:${userId}:actions`;
      
      const actionData = {
        timestamp,
        action,
        details,
        userAgent: details.userAgent,
        ip: details.ip
      };
      
      await this.redis.lpush(key, JSON.stringify(actionData));
      await this.redis.ltrim(key, 0, 9999); // Keep last 10000 actions
      
      // Update action counts
      await this.redis.hincrby('analytics:action_counts', action, 1);
      
      // Track user session
      await this.trackUserSession(userId, details);
      
      // Track feature usage
      if (details.feature) {
        await this.trackFeatureUsage(details.feature, userId);
      }
    } catch (error) {
      logger.error('Failed to track user action:', error);
    }
  }

  async trackUserSession(userId, details) {
    try {
      const key = `analytics:user:${userId}:sessions`;
      const sessionData = {
        timestamp: Date.now(),
        ip: details.ip,
        userAgent: details.userAgent,
        duration: 0
      };
      
      await this.redis.lpush(key, JSON.stringify(sessionData));
      await this.redis.ltrim(key, 0, 99); // Keep last 100 sessions
      
      // Update active sessions
      await this.redis.sadd('analytics:active_sessions', userId);
    } catch (error) {
      logger.error('Failed to track user session:', error);
    }
  }

  async trackFeatureUsage(feature, userId) {
    try {
      const key = `analytics:features:${feature}`;
      
      // Track feature usage count
      await this.redis.hincrby(key, 'total_usage', 1);
      
      // Track unique users
      await this.redis.sadd(`${key}:users`, userId);
      
      // Track daily usage
      const today = new Date().toISOString().split('T')[0];
      await this.redis.hincrby(`${key}:daily`, today, 1);
    } catch (error) {
      logger.error('Failed to track feature usage:', error);
    }
  }

  // Analytics Aggregation
  async aggregateAnalytics() {
    try {
      const timestamp = Date.now();
      const date = new Date().toISOString().split('T')[0];
      
      // Aggregate daily metrics
      const dailyMetrics = {
        timestamp,
        date,
        totalUsers: await this.redis.scard('analytics:active_sessions'),
        totalActions: await this.getTotalActions(),
        featureUsage: await this.getFeatureUsage(),
        userRetention: await this.calculateUserRetention(),
        averageSessionDuration: await this.calculateAverageSessionDuration(),
        // New metrics
        userEngagement: await this.calculateUserEngagement(),
        errorRates: await this.getErrorRates(),
        performanceMetrics: await this.getPerformanceMetrics(),
        geographicDistribution: await this.getGeographicDistribution(),
        deviceUsage: await this.getDeviceUsage(),
        financialMetrics: await this.getFinancialMetrics()
      };
      
      // Store aggregated metrics
      await this.redis.lpush('analytics:daily_metrics', JSON.stringify(dailyMetrics));
      await this.redis.ltrim('analytics:daily_metrics', 0, 29); // Keep last 30 days
      
      // Clean up old data
      await this.cleanupOldData();
      
      logger.info('Analytics aggregation completed successfully');
    } catch (error) {
      logger.error('Failed to aggregate analytics:', error);
    }
  }

  async getTotalActions() {
    const counts = await this.redis.hgetall('analytics:action_counts');
    return Object.values(counts).reduce((sum, count) => sum + parseInt(count), 0);
  }

  async getFeatureUsage() {
    const features = await this.redis.keys('analytics:features:*');
    const usage = {};
    
    for (const feature of features) {
      if (!feature.includes(':users') && !feature.includes(':daily')) {
        const featureName = feature.split(':')[2];
        const totalUsage = await this.redis.hget(feature, 'total_usage');
        const uniqueUsers = await this.redis.scard(`${feature}:users`);
        
        usage[featureName] = {
          totalUsage: parseInt(totalUsage),
          uniqueUsers
        };
      }
    }
    
    return usage;
  }

  async calculateUserRetention() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));
    
    const users = await this.redis.keys('analytics:user:*:sessions');
    let retainedUsers = 0;
    let totalUsers = 0;
    
    for (const userKey of users) {
      const sessions = await this.redis.lrange(userKey, 0, -1);
      const userSessions = sessions.map(s => JSON.parse(s));
      
      const hasRecentSession = userSessions.some(s => 
        new Date(s.timestamp) > thirtyDaysAgo
      );
      
      if (hasRecentSession) {
        retainedUsers++;
      }
      totalUsers++;
    }
    
    return totalUsers > 0 ? (retainedUsers / totalUsers) * 100 : 0;
  }

  async calculateAverageSessionDuration() {
    const sessions = await this.redis.keys('analytics:user:*:sessions');
    let totalDuration = 0;
    let sessionCount = 0;
    
    for (const sessionKey of sessions) {
      const sessionData = await this.redis.lrange(sessionKey, 0, -1);
      const sessions = sessionData.map(s => JSON.parse(s));
      
      for (const session of sessions) {
        if (session.duration) {
          totalDuration += session.duration;
          sessionCount++;
        }
      }
    }
    
    return sessionCount > 0 ? totalDuration / sessionCount : 0;
  }

  // New analytics methods
  async calculateUserEngagement() {
    const users = await this.redis.keys('analytics:user:*:actions');
    let totalActions = 0;
    let totalUsers = users.length;
    
    for (const userKey of users) {
      const actions = await this.redis.lrange(userKey, 0, -1);
      totalActions += actions.length;
    }
    
    return {
      averageActionsPerUser: totalUsers > 0 ? totalActions / totalUsers : 0,
      totalActions,
      totalUsers,
      engagementScore: totalUsers > 0 ? (totalActions / totalUsers) * 100 : 0
    };
  }

  async getErrorRates() {
    const errors = await this.redis.lrange('monitoring:recent_errors', 0, -1);
    const errorTypes = {};
    let totalErrors = errors.length;
    
    for (const error of errors) {
      const errorData = JSON.parse(error);
      const type = errorData.message.split(':')[0];
      errorTypes[type] = (errorTypes[type] || 0) + 1;
    }
    
    return {
      totalErrors,
      errorTypes,
      errorRate: totalErrors / (await this.getTotalActions()) * 100
    };
  }

  async getPerformanceMetrics() {
    const metrics = await this.redis.get('monitoring:metrics');
    if (!metrics) return null;
    
    const data = JSON.parse(metrics);
    return {
      averageResponseTime: data.averageResponseTime,
      endpointPerformance: Object.entries(data.endpointUsage).map(([endpoint, count]) => ({
        endpoint,
        requestCount: count,
        averageResponseTime: data.endpointResponseTimes?.[endpoint] || 0
      }))
    };
  }

  async getGeographicDistribution() {
    const users = await this.redis.keys('analytics:user:*:sessions');
    const locations = {};
    
    for (const userKey of users) {
      const sessions = await this.redis.lrange(userKey, 0, -1);
      for (const session of sessions) {
        const sessionData = JSON.parse(session);
        if (sessionData.ip) {
          // In a real implementation, you would use a geolocation service
          // to convert IP to location
          const location = 'Unknown'; // Placeholder
          locations[location] = (locations[location] || 0) + 1;
        }
      }
    }
    
    return locations;
  }

  async getDeviceUsage() {
    const users = await this.redis.keys('analytics:user:*:sessions');
    const devices = {};
    
    for (const userKey of users) {
      const sessions = await this.redis.lrange(userKey, 0, -1);
      for (const session of sessions) {
        const sessionData = JSON.parse(session);
        if (sessionData.userAgent) {
          // Parse user agent to determine device type
          const deviceType = this.parseUserAgent(sessionData.userAgent);
          devices[deviceType] = (devices[deviceType] || 0) + 1;
        }
      }
    }
    
    return devices;
  }

  async getFinancialMetrics() {
    // This would integrate with your financial data
    // For now, returning placeholder data
    return {
      totalTransactions: 0,
      averageTransactionAmount: 0,
      totalIncome: 0,
      totalExpenses: 0,
      savingsRate: 0,
      topCategories: []
    };
  }

  parseUserAgent(userAgent) {
    // Simple user agent parsing
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop';
  }

  // Analytics Retrieval
  async getAnalytics(timeframe = 'daily') {
    try {
      const key = `analytics:${timeframe}_metrics`;
      const metrics = await this.redis.lrange(key, 0, -1);
      
      return metrics.map(m => JSON.parse(m));
    } catch (error) {
      logger.error('Failed to get analytics:', error);
      return [];
    }
  }

  async getFeatureAnalytics(feature) {
    try {
      const key = `analytics:features:${feature}`;
      const totalUsage = await this.redis.hget(key, 'total_usage');
      const uniqueUsers = await this.redis.scard(`${key}:users`);
      const dailyUsage = await this.redis.hgetall(`${key}:daily`);
      
      return {
        totalUsage: parseInt(totalUsage),
        uniqueUsers,
        dailyUsage
      };
    } catch (error) {
      logger.error('Failed to get feature analytics:', error);
      return null;
    }
  }

  // Cleanup
  async cleanupOldData() {
    try {
      // Remove old user sessions
      const userKeys = await this.redis.keys('analytics:user:*:sessions');
      for (const key of userKeys) {
        const sessions = await this.redis.lrange(key, 0, -1);
        const validSessions = sessions.filter(s => {
          const session = JSON.parse(s);
          return new Date(session.timestamp) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        });
        
        if (validSessions.length < sessions.length) {
          await this.redis.del(key);
          if (validSessions.length > 0) {
            await this.redis.rpush(key, ...validSessions);
          }
        }
      }
      
      // Clean up old feature data
      const featureKeys = await this.redis.keys('analytics:features:*:daily');
      for (const key of featureKeys) {
        const dailyData = await this.redis.hgetall(key);
        const validData = Object.entries(dailyData).filter(([date]) => 
          new Date(date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        );
        
        if (validData.length < Object.keys(dailyData).length) {
          await this.redis.del(key);
          if (validData.length > 0) {
            await this.redis.hmset(key, ...validData.flat());
          }
        }
      }
      
      logger.info('Analytics cleanup completed successfully');
    } catch (error) {
      logger.error('Failed to cleanup analytics data:', error);
    }
  }
}

// Create singleton instance
const analyticsService = new AnalyticsService();

module.exports = analyticsService; 