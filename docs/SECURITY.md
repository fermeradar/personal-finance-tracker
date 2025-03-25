# Security Features Documentation

This document outlines the security features implemented in the Personal Finance Tracker application.

## Table of Contents
1. [Rate Limiting](#rate-limiting)
2. [Security Headers](#security-headers)
3. [Input Validation](#input-validation)
4. [Authentication & Authorization](#authentication--authorization)
5. [File Upload Security](#file-upload-security)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)

## Rate Limiting

The application implements rate limiting to prevent abuse and ensure fair usage of the API.

### Endpoint Limits

| Endpoint | Rate Limit | Window |
|----------|------------|---------|
| Authentication | 5 attempts | 1 hour |
| API Requests | 100 requests | 15 minutes |
| File Uploads | 10 uploads | 1 hour |

### Implementation Details

- Uses Redis for distributed rate limiting
- IP-based tracking
- Automatic reset after window expiration
- Configurable limits per endpoint

Example response when rate limit is exceeded:
```json
{
  "status": "error",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests, please try again later",
  "retryAfter": 3600
}
```

### Example Usage

```javascript
// Rate limiter configuration
const rateLimiter = {
  auth: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: {
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts, please try again later',
      retryAfter: 3600
    }
  }),
  api: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many API requests, please try again later',
      retryAfter: 900
    }
  })
};

// Apply rate limiting to routes
app.use('/api/auth', rateLimiter.auth);
app.use('/api', rateLimiter.api);
```

## Security Headers

The application sets various security headers to protect against common web vulnerabilities.

### Implemented Headers

| Header | Value | Purpose |
|--------|-------|---------|
| X-Content-Type-Options | nosniff | Prevents MIME type sniffing |
| X-Frame-Options | DENY | Prevents clickjacking |
| X-XSS-Protection | 1; mode=block | Enables browser XSS protection |
| Strict-Transport-Security | max-age=31536000 | Enforces HTTPS |
| Content-Security-Policy | See below | Controls resource loading |
| Permissions-Policy | See below | Restricts browser features |

### Content Security Policy

```javascript
// Helmet configuration with CSP
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

### CORS Configuration

```javascript
// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}));
```

## Input Validation

All user inputs are validated using Joi schemas to prevent injection attacks and ensure data integrity.

### User Input Validation

```javascript
// User validation schema
const userSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required'
    }),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  language: Joi.string().valid('en', 'ru').default('en'),
  timezone: Joi.string().required(),
  currency: Joi.string().valid('USD', 'EUR', 'RUB').required()
});

// Example usage in route
app.post('/api/users', validate(userSchema), async (req, res) => {
  // Handle user creation
});
```

### Expense Input Validation

```javascript
// Expense validation schema
const expenseSchema = Joi.object({
  amount: Joi.number().positive().required()
    .messages({
      'number.positive': 'Amount must be positive',
      'any.required': 'Amount is required'
    }),
  currency: Joi.string().valid('USD', 'EUR', 'RUB').required(),
  categoryId: Joi.string().uuid().required(),
  description: Joi.string().max(500).required(),
  date: Joi.date().iso().required(),
  paymentMethod: Joi.string().valid('cash', 'card', 'transfer').required(),
  merchant: Joi.string().max(100),
  tags: Joi.array().items(Joi.string().max(50)),
  receiptUrl: Joi.string().uri()
});

// Example usage in route
app.post('/api/expenses', validate(expenseSchema), async (req, res) => {
  // Handle expense creation
});
```

## Authentication & Authorization

### JWT Implementation

```javascript
// JWT configuration
const jwtConfig = {
  accessToken: {
    secret: process.env.JWT_SECRET,
    expiresIn: '24h',
    algorithm: 'HS256'
  },
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: '7d',
    algorithm: 'HS256'
  }
};

// Token generation
const generateToken = (payload) => {
  return jwt.sign(payload, jwtConfig.accessToken.secret, {
    expiresIn: jwtConfig.accessToken.expiresIn,
    algorithm: jwtConfig.accessToken.algorithm
  });
};

// Token verification middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }
    const decoded = jwt.verify(token, jwtConfig.accessToken.secret);
    req.user = decoded;
    next();
  } catch (err) {
    next(new UnauthorizedError('Invalid token'));
  }
};
```

### Password Security

```javascript
// Password hashing
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Password verification
const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// Password validation middleware
const validatePassword = (req, res, next) => {
  const { password } = req.body;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      status: 'error',
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    });
  }
  next();
};
```

## File Upload Security

### Restrictions

```javascript
// File upload configuration
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
      return;
    }
    cb(null, true);
  },
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix);
    }
  })
});

// Example usage in route
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      status: 'error',
      message: 'No file uploaded'
    });
  }
  // Handle file processing
});
```

## Error Handling

### Security-Related Errors

```javascript
// Custom error classes
class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  if (err instanceof UnauthorizedError) {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: err.message
    });
  }

  if (err instanceof ForbiddenError) {
    return res.status(403).json({
      status: 'error',
      code: 'FORBIDDEN',
      message: err.message
    });
  }

  res.status(500).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred'
  });
});
```

## Best Practices

### General Security

```javascript
// Request size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Compression
app.use(compression());

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));
```

### Development Guidelines

```javascript
// Environment variables validation
const validateEnv = () => {
  const required = [
    'NODE_ENV',
    'PORT',
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'REDIS_URL'
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
```

### Deployment Security

```javascript
// Production security middleware
if (process.env.NODE_ENV === 'production') {
  // Force HTTPS
  app.use((req, res, next) => {
    if (!req.secure) {
      return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
  });

  // Additional security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    }
  }));
}
```

## Testing

Security features are tested using the following test suite:
```bash
npm test tests/integration/security.test.js
```

Test coverage includes:
- Rate limiting functionality
- Security headers presence
- Input validation
- Authentication flows
- File upload restrictions
- Error handling

## Monitoring

Security events are monitored and logged:
- Failed authentication attempts
- Rate limit violations
- Input validation errors
- File upload issues
- Security header violations

## Updates and Maintenance

- Regular security patches
- Dependency updates
- Security policy reviews
- Penetration testing
- Security documentation updates

## Contact

For security-related issues or concerns, please contact:
- Security Team: security@example.com
- Emergency Contact: emergency@example.com 