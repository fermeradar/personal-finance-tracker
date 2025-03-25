# Security Troubleshooting Guide

This guide provides solutions for common security-related issues in the Personal Finance Tracker application.

## Table of Contents
1. [Rate Limiting Issues](#rate-limiting-issues)
2. [Authentication Problems](#authentication-problems)
3. [Input Validation Errors](#input-validation-errors)
4. [File Upload Issues](#file-upload-issues)
5. [Security Header Problems](#security-header-problems)
6. [CORS Issues](#cors-issues)
7. [Performance Issues](#performance-issues)

## Rate Limiting Issues

### Problem: Rate Limit Exceeded
**Symptoms:**
- Receiving 429 (Too Many Requests) errors
- Unable to make API calls
- Rate limit reset not working

**Solutions:**
1. Check Redis Connection:
```bash
# Test Redis connection
redis-cli ping
# Should return PONG

# Check rate limit keys
redis-cli keys "rate_limit:*"
```

2. Verify Rate Limit Configuration:
```javascript
// Check rate limit settings in config
const rateLimitConfig = {
  auth: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5
  },
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
  }
};
```

3. Monitor Rate Limit Usage:
```javascript
// Add logging to rate limiter
app.use((req, res, next) => {
  const key = `rate_limit:${req.ip}`;
  redis.get(key, (err, count) => {
    if (err) {
      logger.error('Rate limit check failed:', err);
      return next();
    }
    logger.info(`Rate limit for ${req.ip}: ${count}`);
    next();
  });
});
```

### Problem: Rate Limits Not Being Applied
**Symptoms:**
- No rate limiting on endpoints
- Multiple requests allowed beyond limits

**Solutions:**
1. Check Redis Connection Pool:
```javascript
// Verify Redis connection pool
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});
```

2. Verify Middleware Order:
```javascript
// Ensure rate limiter is before routes
app.use(rateLimiter.auth);
app.use(rateLimiter.api);
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
```

## Authentication Problems

### Problem: JWT Token Expiration
**Symptoms:**
- Frequent token expiration
- Users being logged out unexpectedly

**Solutions:**
1. Check Token Configuration:
```javascript
// Verify JWT settings
const jwtConfig = {
  accessToken: {
    expiresIn: '24h',
    algorithm: 'HS256'
  },
  refreshToken: {
    expiresIn: '7d',
    algorithm: 'HS256'
  }
};
```

2. Implement Token Refresh:
```javascript
// Add refresh token endpoint
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const newToken = generateToken({ id: decoded.id });
    res.json({ token: newToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

### Problem: Password Reset Issues
**Symptoms:**
- Password reset emails not being sent
- Reset tokens not working

**Solutions:**
1. Check Email Configuration:
```javascript
// Verify email settings
const emailConfig = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};
```

2. Implement Password Reset Flow:
```javascript
// Add password reset endpoints
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findByEmail(email);
  if (user) {
    const resetToken = generateResetToken();
    await user.update({ resetToken, resetExpires: Date.now() + 3600000 });
    await sendResetEmail(user.email, resetToken);
  }
  res.json({ message: 'Reset email sent if user exists' });
});
```

## Input Validation Errors

### Problem: Validation Not Working
**Symptoms:**
- Invalid data being accepted
- Missing validation errors

**Solutions:**
1. Check Validation Middleware:
```javascript
// Verify validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) {
      logger.error('Validation error:', error);
      return res.status(400).json({
        status: 'error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    next();
  };
};
```

2. Add Request Logging:
```javascript
// Add request logging middleware
app.use((req, res, next) => {
  logger.info('Request:', {
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query,
    params: req.params
  });
  next();
});
```

## File Upload Issues

### Problem: File Size Limits
**Symptoms:**
- Large files being rejected
- Upload failures

**Solutions:**
1. Check Multer Configuration:
```javascript
// Verify file upload settings
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type'));
      return;
    }
    cb(null, true);
  }
});
```

2. Add Upload Error Handling:
```javascript
// Add error handling for uploads
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'File too large. Maximum size is 5MB'
      });
    }
  }
  next(err);
});
```

## Security Header Problems

### Problem: Missing Security Headers
**Symptoms:**
- Security headers not present in responses
- Security warnings in browser console

**Solutions:**
1. Verify Helmet Configuration:
```javascript
// Check security headers configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
```

2. Add Header Verification:
```javascript
// Add header verification middleware
app.use((req, res, next) => {
  const requiredHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'X-XSS-Protection',
    'Strict-Transport-Security'
  ];
  
  const missingHeaders = requiredHeaders.filter(header => !res.getHeader(header));
  if (missingHeaders.length > 0) {
    logger.error('Missing security headers:', missingHeaders);
  }
  next();
});
```

## CORS Issues

### Problem: CORS Errors
**Symptoms:**
- Cross-origin requests failing
- Browser CORS errors

**Solutions:**
1. Check CORS Configuration:
```javascript
// Verify CORS settings
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}));
```

2. Add CORS Debugging:
```javascript
// Add CORS debugging middleware
app.use((req, res, next) => {
  logger.info('CORS request:', {
    origin: req.headers.origin,
    method: req.method,
    path: req.path
  });
  next();
});
```

## Performance Issues

### Problem: Rate Limiter Performance
**Symptoms:**
- Slow API responses
- Redis connection issues

**Solutions:**
1. Optimize Redis Configuration:
```javascript
// Configure Redis for better performance
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  enableOfflineQueue: true,
  connectTimeout: 10000,
  commandTimeout: 5000
});
```

2. Add Performance Monitoring:
```javascript
// Add performance monitoring
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request performance:', {
      method: req.method,
      path: req.path,
      duration,
      status: res.statusCode
    });
  });
  next();
});
```

## General Troubleshooting Tips

1. **Check Logs**
   - Review application logs for errors
   - Monitor Redis logs for connection issues
   - Check server logs for configuration problems

2. **Verify Environment Variables**
   ```bash
   # Check required environment variables
   echo $REDIS_URL
   echo $JWT_SECRET
   echo $ALLOWED_ORIGINS
   ```

3. **Test Security Features**
   ```bash
   # Run security tests
   npm test tests/integration/security.test.js
   
   # Check for vulnerabilities
   npm audit
   ```

4. **Monitor System Resources**
   ```bash
   # Check Redis memory usage
   redis-cli info memory
   
   # Monitor application memory
   node --trace-gc app.js
   ```

## Contact

For additional support:
- Technical Support: support@example.com
- Security Team: security@example.com
- Emergency Contact: emergency@example.com 