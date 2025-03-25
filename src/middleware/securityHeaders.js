const helmet = require('helmet');
const { logger } = require('../utils/logger');

// Security headers configuration
const securityHeaders = {
  // Basic security headers
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      sandbox: ['allow-forms', 'allow-scripts', 'allow-same-origin'],
      upgradeInsecureRequests: []
    }
  },
  
  // CORS configuration
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true,
    maxAge: 86400 // 24 hours
  },

  // Rate limiting headers
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },

  // Other security headers
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: 'deny' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
};

// Create security headers middleware
const securityHeadersMiddleware = (req, res, next) => {
  try {
    // Set basic security headers
    helmet(securityHeaders)(req, res, next);

    // Set custom headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Set CORS headers
    const origin = req.headers.origin;
    if (securityHeaders.cors.origin.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', securityHeaders.cors.methods.join(','));
      res.setHeader('Access-Control-Allow-Headers', securityHeaders.cors.allowedHeaders.join(','));
      res.setHeader('Access-Control-Expose-Headers', securityHeaders.cors.exposedHeaders.join(','));
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', securityHeaders.cors.maxAge);
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  } catch (error) {
    logger.error('Error setting security headers:', error);
    next(error);
  }
};

// Create CSP middleware
const cspMiddleware = helmet.contentSecurityPolicy(securityHeaders.contentSecurityPolicy);

// Create HSTS middleware
const hstsMiddleware = helmet.hsts(securityHeaders.hsts);

// Create frame guard middleware
const frameGuardMiddleware = helmet.frameguard(securityHeaders.frameguard);

module.exports = {
  securityHeadersMiddleware,
  cspMiddleware,
  hstsMiddleware,
  frameGuardMiddleware,
  securityHeaders
}; 