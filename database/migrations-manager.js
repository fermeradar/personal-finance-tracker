// src/utils/migrationManager.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const logger = require('./logger');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Database Migration Manager
 * Handles application of database migrations
 */
class MigrationManager {
  /**
   * Check for and apply pending migrations
   * @returns {Promise<Object>} - Migration results
   */
  async applyMigrations() {
    try {
      // Ensure migrations table exists
      await this.createMigrationsTable();

      // Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      
      // Get available migration files
      const availableMigrations = this.getAvailableMigrations();
      
      // Find pending migrations
      const pendingMigrations = availableMigrations.filter(
        migration => !appliedMigrations.includes(migration)
      );
      
      if (pendingMigrations.length === 0) {
        return {
          success: true,
          message: 'No pending migrations',
          migrationsApplied: []
        };
      }
      
      // Sort migrations by name for consistent application order
      pendingMigrations.sort();
      
      // Apply each pending migration
      const migrationsDir = path.join(__dirname, '..', '..', 'migrations');
      const appliedList = [];
      const errors = [];
      
      for (const migration of pendingMigrations) {
        try {
          logger.info(`Applying migration: ${migration}`);
          const migrationPath = path.join(migrationsDir, `${migration}.sql`);
          const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
          
          const client = await pool.connect();
          
          try {
            await client.query('BEGIN');
            
            // Execute the migration
            await client.query(migrationSql);
            
            // Record the migration
            await client.query(
              'INSERT INTO migrations(migration_name, applied_at) VALUES($1, NOW())',
              [migration]
            );
            
            await client.query('COMMIT');
            appliedList.push(migration);
            logger.info(`Migration ${migration} applied successfully`);
          } catch (migrationError) {
            await client.query('ROLLBACK');
            errors.push({
              migration,
              error: migrationError.message
            });
            logger.error(`Migration ${migration} failed:`, migrationError);
            break; // Stop on first error
          } finally {
            client.release();
          }
        } catch (fileError) {
          errors.push({
            migration,
            error: fileError.message
          });
          logger.error(`Error reading migration file ${migration}:`, fileError);
          break; // Stop on first error
        }
      }
      
      return {
        success: errors.length === 0,
        migrationsApplied: appliedList,
        errors,
        pendingMigrations: pendingMigrations.length,
        appliedCount: appliedList.length
      };
    } catch (error) {
      logger.error('Error applying migrations:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Create migrations tracking table if it doesn't exist
   * @returns {Promise<void>}
   */
  async createMigrationsTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          migration_name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
          applied_by VARCHAR(100),
          UNIQUE(migration_name)
        )
      `);
    } catch (error) {
      logger.error('Error creating migrations table:', error);
      throw error;
    }
  }
  
  /**
   * Get list of already applied migrations
   * @returns {Promise<Array<String>>} - List of applied migration names
   */
  async getAppliedMigrations() {
    try {
      const result = await pool.query(`
        SELECT migration_name 
        FROM migrations 
        ORDER BY applied_at
      `);
      
      return result.rows.map(row => row.migration_name);
    } catch (error) {
      logger.error('Error getting applied migrations:', error);
      throw error;
    }
  }
  
  /**
   * Get list of available migration files
   * @returns {Array<String>} - List of available migration names
   */
  getAvailableMigrations() {
    try {
      const migrationsDir = path.join(__dirname, '..', '..', 'migrations');
      
      if (!fs.existsSync(migrationsDir)) {
        logger.warn('Migrations directory does not exist');
        return [];
      }
      
      return fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .map(file => file.replace('.sql', ''));
    } catch (error) {
      logger.error('Error getting available migrations:', error);
      throw error;
    }
  }
  
  /**
   * Create a new migration file
   * @param {String} name - Migration name
   * @returns {Promise<Object>} - Created migration info
   */
  async createMigration(name) {
    try {
      // Sanitize name
      const sanitizedName = name.toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_');
      
      // Add timestamp for ordering
      const timestamp = new Date().toISOString()
        .replace(/[-:]/g, '')
        .replace('T', '_')
        .split('.')[0];
      
      const migrationName = `${timestamp}_${sanitizedName}`;
      const migrationsDir = path.join(__dirname, '..', '..', 'migrations');
      
      // Ensure migrations directory exists
      if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
      }
      
      const migrationPath = path.join(migrationsDir, `${migrationName}.sql`);
      
      // Create migration file with template
      const template = `-- Migration: ${migrationName}
-- Created at: ${new Date().toISOString()}

-- Up migration
BEGIN;

-- Your SQL goes here

COMMIT;
`;
      
      fs.writeFileSync(migrationPath, template, 'utf-8');
      
      return {
        success: true,
        migration: {
          name: migrationName,
          path: migrationPath
        }
      };
    } catch (error) {
      logger.error('Error creating migration file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Rollback the most recent migration
   * @returns {Promise<Object>} - Rollback result
   */
  async rollbackMigration() {
    try {
      // Get the most recently applied migration
      const result = await pool.query(`
        SELECT id, migration_name, applied_at
        FROM migrations
        ORDER BY applied_at DESC
        LIMIT 1
      `);
      
      if (result.rows.length === 0) {
        return {
          success: false,
          message: 'No migrations to roll back'
        };
      }
      
      const migration = result.rows[0];
      
      // Look for a rollback file (convention: migration_name.rollback.sql)
      const migrationsDir = path.join(__dirname, '..', '..', 'migrations');
      const rollbackPath = path.join(migrationsDir, `${migration.migration_name}.rollback.sql`);
      
      if (!fs.existsSync(rollbackPath)) {
        return {
          success: false,
          message: `No rollback script found for migration ${migration.migration_name}`
        };
      }
      
      // Execute rollback
      const rollbackSql = fs.readFileSync(rollbackPath, 'utf-8');
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Execute the rollback
        await client.query(rollbackSql);
        
        // Remove the migration record
        await client.query(
          'DELETE FROM migrations WHERE id = $1',
          [migration.id]
        );
        
        await client.query('COMMIT');
        
        return {
          success: true,
          migration: migration.migration_name,
          applied_at: migration.applied_at
        };
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Rollback failed for ${migration.migration_name}:`, error);
        
        return {
          success: false,
          migration: migration.migration_name,
          error: error.message
        };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error rolling back migration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new MigrationManager();
