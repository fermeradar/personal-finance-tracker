// src/services/backupService.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

class BackupService {
  constructor(options = {}) {
    this.backupDir = options.backupDir || path.join(process.cwd(), 'backups');
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    };
    
    // Default retention days
    this.retentionDays = 30;
    
    // Load retention setting from database
    this.loadSettings();
    
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }
  
  /**
   * Load settings from database
   */
  async loadSettings() {
    try {
      const settingsResult = await pool.query(
        "SELECT setting_value FROM system_settings WHERE setting_key = 'backup_retention_days'"
      );
      
      if (settingsResult.rows.length > 0) {
        this.retentionDays = parseInt(settingsResult.rows[0].setting_value) || 30;
      }
    } catch (error) {
      console.error('Error loading backup settings:', error);
      // Continue with default settings
    }
  }
  
  /**
   * Create a new database backup
   * @param {String} description - Optional backup description
   * @returns {Promise<Object>} - Result object with backup information
   */
  async createBackup(description = 'Automatic backup') {
    try {
      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup_${timestamp}.sql`;
      const backupPath = path.join(this.backupDir, filename);
      
      // Build the pg_dump command
      const command = [
        'pg_dump',
        `-h ${this.dbConfig.host}`,
        `-p ${this.dbConfig.port}`,
        `-U ${this.dbConfig.user}`,
        `-d ${this.dbConfig.database}`,
        `-f ${backupPath}`,
        '--format=custom',
        '--compress=9',
        '--no-owner',
        '--no-privileges'
      ].join(' ');
      
      // Set environment variable for password
      const env = { ...process.env, PGPASSWORD: this.dbConfig.password };
      
      // Execute the backup command
      await execPromise(command, { env });
      
      // Get file size
      const stats = fs.statSync(backupPath);
      const fileSize = stats.size;
      
      // Get database version
      const versionResult = await pool.query('SELECT version()');
      const dbVersion = versionResult.rows[0].version;
      
      // Store backup metadata
      const metadataResult = await pool.query(`
        INSERT INTO backup_metadata(
          filename, file_path, file_size, description, created_at, 
          db_version, metadata
        )
        VALUES($1, $2, $3, $4, NOW(), $5, $6)
        RETURNING backup_id
      `, [
        filename,
        backupPath,
        fileSize,
        description,
        dbVersion,
        JSON.stringify({
          tables: await this.getTableSummary(),
          timestamp: new Date().toISOString()
        })
      ]);
      
      return {
        success: true,
        path: backupPath,
        filename,
        size: fileSize,
        backupId: metadataResult.rows[0].backup_id,
        metadata: {
          description,
          dbVersion,
          size: fileSize,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Backup creation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Restore database from backup
   * @param {String} backupPath - Path to backup file
   * @returns {Promise<Object>} - Result object with restoration information
   */
  async restoreBackup(backupPath) {
    try {
      // Check if backup file exists
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }
      
      // Build the pg_restore command
      const command = [
        'pg_restore',
        `-h ${this.dbConfig.host}`,
        `-p ${this.dbConfig.port}`,
        `-U ${this.dbConfig.user}`,
        `-d ${this.dbConfig.database}`,
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        backupPath
      ].join(' ');
      
      // Set environment variable for password
      const env = { ...process.env, PGPASSWORD: this.dbConfig.password };
      
      // Execute the restore command
      const { stdout, stderr } = await execPromise(command, { env });
      
      // Log information about the restoration
      await pool.query(`
        INSERT INTO system_logs(
          log_type, log_message, log_details, created_at
        )
        VALUES($1, $2, $3, NOW())
      `, [
        'restore',
        `Database restored from backup: ${path.basename(backupPath)}`,
        JSON.stringify({ stdout, stderr })
      ]);
      
      return {
        success: true,
        message: 'Database restored successfully',
        details: { stdout, stderr }
      };
    } catch (error) {
      console.error('Backup restoration error:', error);
      
      // Log the restoration failure
      try {
        await pool.query(`
          INSERT INTO system_logs(
            log_type, log_message, log_details, created_at
          )
          VALUES($1, $2, $3, NOW())
        `, [
          'restore_error',
          `Failed to restore database from backup: ${path.basename(backupPath)}`,
          JSON.stringify({ error: error.message })
        ]);
      } catch (logError) {
        console.error('Error logging restoration failure:', logError);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get list of available backups
   * @returns {Array} - List of backup objects with metadata
   */
  getAvailableBackups() {
    try {
      // Check if backup directory exists
      if (!fs.existsSync(this.backupDir)) {
        return [];
      }
      
      // Get all backup files
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.endsWith('.sql'));
      
      // Build backup objects with metadata
      const backups = files.map(filename => {
        const filePath = path.join(this.backupDir, filename);
        const stats = fs.statSync(filePath);
        
        // Parse date from filename (backup_2023-01-15T12-30-45-000Z.sql)
        const dateMatch = filename.match(/backup_(.+)\.sql/);
        const dateStr = dateMatch ? dateMatch[1].replace(/-/g, function(match, offset) {
          // Keep the first 10 characters as-is (date part)
          return offset < 10 ? match : offset === 10 ? 'T' : ':';
        }) : null;
        
        const date = dateStr ? new Date(dateStr) : stats.ctime;
        
        return {
          filename,
          path: filePath,
          size: stats.size,
          sizeFormatted: this.formatSize(stats.size),
          date,
          dateFormatted: date.toLocaleString(),
          metadata: this.getBackupMetadata(filename)
        };
      });
      
      // Sort by date (newest first)
      return backups.sort((a, b) => b.date - a.date);
    } catch (error) {
      console.error('Error getting available backups:', error);
      return [];
    }
  }
  
  /**
   * Get backup metadata from database
   * @param {String} filename - Backup filename
   * @returns {Object|null} - Backup metadata or null if not found
   */
  getBackupMetadata(filename) {
    try {
      // Query metadata from database
      const metadataResult = pool.query(
        'SELECT * FROM backup_metadata WHERE filename = $1',
        [filename]
      );
      
      if (metadataResult.rows.length > 0) {
        return metadataResult.rows[0];
      }
      
      return null;
    } catch (error) {
      console.error('Error getting backup metadata:', error);
      return null;
    }
  }
  
  /**
   * Cleanup old backups based on retention policy
   * @returns {Promise<Object>} - Cleanup result
   */
  async cleanupOldBackups() {
    try {
      // Ensure settings are loaded
      await this.loadSettings();
      
      // Get all backups
      const backups = this.getAvailableBackups();
      
      // Calculate threshold date
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - this.retentionDays);
      
      // Filter backups older than retention period
      const oldBackups = backups.filter(backup => backup.date < thresholdDate);
      
      let deletedCount = 0;
      
      // Delete old backups
      for (const backup of oldBackups) {
        try {
          // Delete from filesystem
          fs.unlinkSync(backup.path);
          
          // Delete from metadata table
          await pool.query(
            'DELETE FROM backup_metadata WHERE filename = $1',
            [backup.filename]
          );
          
          deletedCount++;
        } catch (deleteError) {
          console.error(`Error deleting backup ${backup.filename}:`, deleteError);
        }
      }
      
      // Log cleanup operation
      await pool.query(`
        INSERT INTO system_logs(
          log_type, log_message, log_details, created_at
        )
        VALUES($1, $2, $3, NOW())
      `, [
        'backup_cleanup',
        `Cleaned up ${deletedCount} old backups based on ${this.retentionDays} day retention policy`,
        JSON.stringify({
          retentionDays: this.retentionDays,
          thresholdDate: thresholdDate.toISOString(),
          deletedCount,
          totalBackupsCount: backups.length
        })
      ]);
      
      return {
        success: true,
        deletedCount,
        retentionDays: this.retentionDays,
        remainingCount: backups.length - deletedCount
      };
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Format file size to human-readable string
   * @param {Number} bytes - Size in bytes
   * @returns {String} - Formatted size string
   */
  formatSize(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  }
  
  /**
   * Get summary of database tables
   * @returns {Promise<Object>} - Table summary information
   */
  async getTableSummary() {
    try {
      // Query to get table row counts
      const countQuery = `
        SELECT 
          relname as table_name,
          n_live_tup as row_count
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      `;
      
      const countResult = await pool.query(countQuery);
      
      // Query to get database size
      const sizeQuery = `
        SELECT
          pg_size_pretty(pg_database_size(current_database())) as db_size
      `;
      
      const sizeResult = await pool.query(sizeQuery);
      
      return {
        tables: countResult.rows,
        totalTables: countResult.rows.length,
        totalRows: countResult.rows.reduce((sum, table) => sum + parseInt(table.row_count), 0),
        databaseSize: sizeResult.rows[0].db_size
      };
    } catch (error) {
      console.error('Error getting table summary:', error);
      return {
        tables: [],
        totalTables: 0,
        totalRows: 0,
        databaseSize: 'Unknown'
      };
    }
  }
  
  /**
   * Schedule regular backups
   * @param {String} schedule - Cron-like schedule string
   * @returns {Object} - Scheduler information
   */
  scheduleBackups(schedule = '0 0 * * *') { // Default to daily at midnight
    if (typeof schedule !== 'string') {
      throw new Error('Schedule must be a cron-like string');
    }
    
    // This is a placeholder - in a real implementation, you would:
    // 1. Set up a cron job or use a scheduling library like node-schedule
    // 2. Configure it to run the createBackup method according to the schedule
    
    console.log(`Backup scheduling configured: ${schedule}`);
    
    return {
      status: 'Scheduled',
      schedule,
      message: 'This is a placeholder. Implement actual scheduling with cron or node-schedule.'
    };
  }
}

module.exports = new BackupService();
