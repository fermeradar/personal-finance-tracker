const logger = require('../core/logger-utility');
// src/middleware/securityMiddleware.js
const rateLimit = require('telegraf-ratelimit');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Rate limiting configuration
const rateLimitConfig = {
  window: 3000, // 3 seconds
  limit: 5,     // 5 messages per window
  onLimitExceeded: (ctx) => ctx.reply('Please slow down, too many requests!')
};

// Authentication middleware
async function authMiddleware(ctx, next) {
  if (!ctx.from) return next();
  
  const userId = ctx.from.id.toString();
  
  try {
    // Check if user exists in database
    const userResult = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      // User not registered, generate a one-time token
      const token = Math.random().toString(36).substring(2, 15);
      
      // Store token in the database
      await pool.query(
        'INSERT INTO users(user_id, first_name, username, join_date, registration_token, registration_ip) VALUES($1, $2, $3, NOW(), $4, $5)',
        [
          userId,
          ctx.from.first_name || 'User',
          ctx.from.username || null,
          token,
          ctx.clientInfo?.ip || null
        ]
      );
      
      // Store token in session for verification
      ctx.session = ctx.session || {};
      ctx.session.registrationToken = token;
      
      // Ask user to register
      return ctx.reply(`Welcome! To use this bot, please register first.\nUse command: /register ${token}`);
    }
    
    // Check if account is active
    if (userResult.rows[0].account_status !== 'active') {
      return ctx.reply('Your account is not active. Please contact support.');
    }
    
    // Update last activity
    await pool.query(
      'UPDATE users SET last_activity = NOW() WHERE user_id = $1',
      [userId]
    );
    
    // Add user data to context for easy access
    ctx.state.user = userResult.rows[0];
    
    // Store session in database if needed
    if (ctx.session && Object.keys(ctx.session).length > 0) {
      try {
        // One hour from now
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        
        await pool.query(`
          INSERT INTO user_sessions(user_id, session_data, expires_at)
          VALUES($1, $2, $3)
          ON CONFLICT(user_id)
          DO UPDATE SET
            session_data = $2,
            updated_at = NOW(),
            expires_at = $3
        `, [userId, JSON.stringify(ctx.session), expiresAt]);
      } catch (sessionError) {
        logger.error('Error storing session:', sessionError);
        // Non-critical, continue with request
      }
    }
    
    return next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return ctx.reply('Authentication error. Please try again later.');
  }
}

// Activity logging middleware
async function loggingMiddleware(ctx, next) {
  const userId = ctx.from?.id.toString();
  const action = ctx.updateType || '';
  const command = ctx.message?.text || '';
  
  // Log to database
  if (userId) {
    try {
      await pool.query(
        'INSERT INTO user_activity_logs(user_id, action_type, command, request_ip, request_data, timestamp) VALUES($1, $2, $3, $4, $5, NOW())',
        [
          userId, 
          action, 
          command,
          ctx.clientInfo?.ip || null,
          ctx.message ? JSON.stringify(ctx.message) : null
        ]
      );
    } catch (err) {
      logger.error('Logging error:', err);
      // Non-critical, continue with request
    }
  }
  
  return next();
}

// Admin verification middleware
async function adminMiddleware(ctx, next) {
  const userId = ctx.from?.id.toString();
  
  if (!userId) return ctx.reply('User ID not found.');
  
  try {
    // Check if user is admin in database
    const userResult = await pool.query(
      'SELECT is_admin FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return ctx.reply('You are not authorized to perform this action.');
    }
    
    // Add admin flag to context
    ctx.state.isAdmin = true;
    
    return next();
  } catch (error) {
    logger.error('Admin middleware error:', error);
    return ctx.reply('Authorization error. Please try again later.');
  }
}

// Load session from database
async function loadSessionMiddleware(ctx, next) {
  const userId = ctx.from?.id.toString();
  
  if (!userId) return next();
  
  try {
    // Check for existing session
    const sessionResult = await pool.query(
      'SELECT session_data FROM user_sessions WHERE user_id = $1 AND expires_at > NOW()',
      [userId]
    );
    
    if (sessionResult.rows.length > 0) {
      // Merge with existing session
      ctx.session = {
        ...ctx.session,
        ...JSON.parse(sessionResult.rows[0].session_data)
      };
    }
  } catch (error) {
    logger.error('Session loading error:', error);
    // Non-critical, continue with request
  }
  
  return next();
}

module.exports = {
  rateLimitMiddleware: rateLimit(rateLimitConfig),
  authMiddleware,
  loggingMiddleware,
  adminMiddleware,
  loadSessionMiddleware
};
