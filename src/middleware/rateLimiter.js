const Redis = require('ioredis');
const { RateLimitError } = require('../utils/errors/AppError');
const { logger } = require('../utils/logger');

class RateLimiter {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.defaultWindowMs = 15 * 60 * 1000; // 15 minutes
    this.defaultMax = 100; // 100 requests per window
  }

  // Create rate limiter middleware
  createLimiter(options = {}) {
    const {
      windowMs = this.defaultWindowMs,
      max = this.defaultMax,
      keyGenerator = (req) => req.ip,
      handler = (req, res, next, options) => {
        next(new RateLimitError(`Too many requests, please try again later.`));
      },
      skip = () => false,
      standardHeaders = true,
      legacyHeaders = true,
      storeClient = this.redis
    } = options;

    return async (req, res, next) => {
      if (skip(req)) {
        return next();
      }

      const key = keyGenerator(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      try {
        // Get current count
        const count = await storeClient.zcount(key, windowStart, now);

        if (count >= max) {
          // Log rate limit exceeded
          logger.warn('Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            count,
            max,
            windowMs
          });

          return handler(req, res, next, options);
        }

        // Add current request
        await storeClient.zadd(key, now, `${now}-${Math.random()}`);
        
        // Set expiry on the key
        await storeClient.expire(key, Math.ceil(windowMs / 1000));

        // Set rate limit headers
        if (standardHeaders) {
          res.setHeader('X-RateLimit-Limit', max);
          res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count - 1));
          res.setHeader('X-RateLimit-Reset', Math.ceil((windowStart + windowMs) / 1000));
        }

        if (legacyHeaders) {
          res.setHeader('X-RateLimit-Limit', max);
          res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count - 1));
          res.setHeader('X-RateLimit-Reset', Math.ceil((windowStart + windowMs) / 1000));
        }

        next();
      } catch (error) {
        logger.error('Rate limiter error:', error);
        next(error);
      }
    };
  }

  // Create specific limiters for different endpoints
  createAuthLimiter() {
    return this.createLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // 5 attempts per hour
      keyGenerator: (req) => `auth:${req.ip}`,
      handler: (req, res, next) => {
        next(new RateLimitError('Too many login attempts, please try again later.'));
      }
    });
  }

  createApiLimiter() {
    return this.createLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
      keyGenerator: (req) => `api:${req.ip}`,
      handler: (req, res, next) => {
        next(new RateLimitError('API rate limit exceeded, please try again later.'));
      }
    });
  }

  createUploadLimiter() {
    return this.createLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 uploads per hour
      keyGenerator: (req) => `upload:${req.user?.id || req.ip}`,
      handler: (req, res, next) => {
        next(new RateLimitError('Upload limit exceeded, please try again later.'));
      }
    });
  }

  // Reset rate limit for a specific key
  async resetLimit(key) {
    try {
      await this.redis.del(key);
      logger.info(`Rate limit reset for key: ${key}`);
    } catch (error) {
      logger.error('Error resetting rate limit:', error);
      throw error;
    }
  }

  // Get current rate limit status
  async getLimitStatus(key) {
    try {
      const now = Date.now();
      const windowStart = now - this.defaultWindowMs;
      const count = await this.redis.zcount(key, windowStart, now);
      return {
        count,
        remaining: Math.max(0, this.defaultMax - count),
        reset: Math.ceil((windowStart + this.defaultWindowMs) / 1000)
      };
    } catch (error) {
      logger.error('Error getting rate limit status:', error);
      throw error;
    }
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

module.exports = rateLimiter; 