-- User Activity Logs Table
CREATE TABLE user_activity_logs (
    log_id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id),
    action_type VARCHAR(50) NOT NULL,
    command TEXT NULL,
    request_ip VARCHAR(50) NULL,
    request_data JSONB NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- OCR Cache Table
CREATE TABLE ocr_cache (
    cache_id SERIAL PRIMARY KEY,
    image_hash VARCHAR(64) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    ocr_text TEXT NOT NULL,
    parsed_data JSONB NOT NULL,
    ocr_method VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(image_hash)
);

-- User Session Data Table
CREATE TABLE user_sessions (
    session_id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id),
    session_data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(user_id)
);

-- Backup Metadata Table
CREATE TABLE backup_metadata (
    backup_id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NULL REFERENCES users(user_id),
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    db_version VARCHAR(50) NULL,
    metadata JSONB NULL
);

-- System Settings Table
CREATE TABLE system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) NOT NULL, -- 'string', 'number', 'boolean', 'json'
    description TEXT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(50) NULL REFERENCES users(user_id)
);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('backup_retention_days', '30', 'number', 'Number of days to keep backups'),
    ('ocr_daily_limit', '100', 'number', 'Daily limit for cloud OCR API calls'),
    ('admin_user_ids', '', 'string', 'Comma-separated list of admin user IDs'),
    ('enable_analytics', 'true', 'boolean', 'Enable anonymous analytics'),
    ('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode');

-- Update Users Table to include more security fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_token VARCHAR(64) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(50) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create indexes
CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_timestamp ON user_activity_logs(timestamp);
CREATE INDEX idx_ocr_cache_hash ON ocr_cache(image_hash);
CREATE INDEX idx_backup_metadata_created_at ON backup_metadata(created_at);
