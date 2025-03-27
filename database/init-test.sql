-- Migration: 20230101_000000_initial_schema
-- Created at: 2023-01-01T00:00:00.000Z

BEGIN;

-- Drop tables if they exist
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS user_locations CASCADE;
DROP TABLE IF EXISTS currency_exchange_rates CASCADE;
DROP TABLE IF EXISTS default_currencies CASCADE;
DROP TABLE IF EXISTS regional_benchmarks CASCADE;

-- Create tables with correct schema
CREATE TABLE users (
    user_id VARCHAR(255) PRIMARY KEY,
    first_name VARCHAR(255),
    currency VARCHAR(3),
    region VARCHAR(255)
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    name_normalized VARCHAR(255),
    icon VARCHAR(255),
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE expenses (
    expense_id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    category_id INTEGER,
    expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    merchant_name VARCHAR(255),
    data_source VARCHAR(50),
    converted_amount DECIMAL(10,2),
    converted_currency VARCHAR(3),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE user_locations (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    city VARCHAR(255),
    country VARCHAR(255),
    is_primary BOOLEAN DEFAULT true,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE currency_exchange_rates (
    id SERIAL PRIMARY KEY,
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(10,6) NOT NULL,
    effective_date DATE NOT NULL,
    source VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_currency, to_currency, effective_date)
);

CREATE TABLE default_currencies (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_value VARCHAR(255) NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    effective_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_value)
);

-- Insert test data
INSERT INTO users (user_id, first_name, currency, region) 
VALUES ('test_user', 'Test User', 'EUR', 'EU');

INSERT INTO categories (name, name_normalized, icon, is_system, user_id) 
VALUES 
    ('Food', 'food', '🍽️', true, 'test_user'),
    ('Transport', 'transport', '🚗', true, 'test_user'),
    ('Entertainment', 'entertainment', '🎭', true, 'test_user'),
    ('Shopping', 'shopping', '🛍️', true, 'test_user'),
    ('Bills', 'bills', '📄', true, 'test_user');

-- Add some test exchange rates
INSERT INTO currency_exchange_rates (from_currency, to_currency, rate, effective_date, source)
VALUES 
    ('EUR', 'USD', 1.08, CURRENT_DATE, 'test'),
    ('USD', 'EUR', 0.93, CURRENT_DATE, 'test');

-- Expense Items Table
CREATE TABLE IF NOT EXISTS expense_items (
    item_id SERIAL PRIMARY KEY,
    expense_id INTEGER NOT NULL REFERENCES expenses(expense_id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    product_name_original VARCHAR(255),
    product_name_normalized VARCHAR(255),
    original_language VARCHAR(10),
    amount DECIMAL(10, 2) NOT NULL,
    quantity DECIMAL(10, 3) DEFAULT 1,
    unit_price DECIMAL(10, 2),
    quantity_value DECIMAL(10, 3),
    quantity_unit VARCHAR(20),
    standard_quantity DECIMAL(10, 3),
    standard_unit VARCHAR(20),
    product_category VARCHAR(100),
    brand VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Retailers Table
CREATE TABLE IF NOT EXISTS retailers (
    retailer_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_normalized VARCHAR(255) NOT NULL,
    name_variations JSONB,
    website VARCHAR(255),
    global_chain BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Retail Locations Table
CREATE TABLE IF NOT EXISTS retail_locations (
    location_id SERIAL PRIMARY KEY,
    retailer_id INTEGER NOT NULL REFERENCES retailers(retailer_id),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    postal_code VARCHAR(20),
    city VARCHAR(100),
    district VARCHAR(100),
    region VARCHAR(100),
    country VARCHAR(100),
    latitude DECIMAL(10, 6),
    longitude DECIMAL(10, 6),
    store_type VARCHAR(50),
    price_tier VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Vendor Table (Simplified version of Retailers)
CREATE TABLE IF NOT EXISTS vendors (
    vendor_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_normalized VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Document Extractions Table
CREATE TABLE IF NOT EXISTS document_extractions (
    extraction_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id),
    document_type VARCHAR(50) NOT NULL,
    extraction_date TIMESTAMP NOT NULL,
    data_extracted JSONB NOT NULL,
    confidence_score INTEGER,
    detected_language VARCHAR(10),
    original_text TEXT,
    translated_text TEXT,
    storage_path VARCHAR(255),
    processed_status VARCHAR(20) DEFAULT 'pending',
    source_type VARCHAR(50),
    review_prompt TEXT,
    needs_review BOOLEAN DEFAULT FALSE,
    user_reviewed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User Activity Logs Table
CREATE TABLE IF NOT EXISTS user_activity_logs (
    log_id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id),
    action_type VARCHAR(50) NOT NULL,
    command TEXT,
    request_ip VARCHAR(50),
    request_data JSONB,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Regional Benchmarks Table
CREATE TABLE IF NOT EXISTS regional_benchmarks (
    benchmark_id SERIAL PRIMARY KEY,
    region VARCHAR(100) NOT NULL,
    city VARCHAR(100),
    country VARCHAR(100) NOT NULL,
    time_period VARCHAR(50) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    currency VARCHAR(3) NOT NULL,
    user_count INTEGER NOT NULL,
    avg_spent DECIMAL(10, 2) NOT NULL,
    median_spent DECIMAL(10, 2) NOT NULL,
    p25_spent DECIMAL(10, 2),
    p75_spent DECIMAL(10, 2),
    avg_transaction_count DECIMAL(5, 2),
    category_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Brand Dictionary Table
CREATE TABLE IF NOT EXISTS brand_dictionary (
    brand_id SERIAL PRIMARY KEY,
    brand_name VARCHAR(255) NOT NULL,
    standard_name VARCHAR(255) NOT NULL,
    variations JSONB,
    category VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Merchant Category Mappings Table
CREATE TABLE IF NOT EXISTS merchant_category_mappings (
    mapping_id SERIAL PRIMARY KEY,
    merchant_name_normalized VARCHAR(255) NOT NULL,
    category_mapping INTEGER NOT NULL REFERENCES categories(id),
    confidence INTEGER DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Standard Units Table
CREATE TABLE IF NOT EXISTS standard_units (
    unit_id SERIAL PRIMARY KEY,
    unit_type VARCHAR(50) NOT NULL,
    standard_unit VARCHAR(20) NOT NULL,
    unit_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(unit_type)
);

-- Unit Conversions Table
CREATE TABLE IF NOT EXISTS unit_conversions (
    conversion_id SERIAL PRIMARY KEY,
    from_unit VARCHAR(20) NOT NULL,
    to_unit VARCHAR(20) NOT NULL,
    quantity_type VARCHAR(50) NOT NULL,
    conversion_factor DECIMAL(16, 6) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(from_unit, to_unit, quantity_type)
);

-- OCR Cache Table
CREATE TABLE IF NOT EXISTS ocr_cache (
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
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id),
    session_data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(user_id)
);

-- Backup Metadata Table
CREATE TABLE IF NOT EXISTS backup_metadata (
    backup_id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) REFERENCES users(user_id),
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    db_version VARCHAR(50),
    metadata JSONB
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) NOT NULL, -- 'string', 'number', 'boolean', 'json'
    description TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(50) REFERENCES users(user_id)
);

-- System Logs Table
CREATE TABLE IF NOT EXISTS system_logs (
    log_id SERIAL PRIMARY KEY, 
    log_type VARCHAR(50) NOT NULL,
    log_message TEXT NOT NULL,
    log_details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('backup_retention_days', '30', 'number', 'Number of days to keep backups'),
    ('ocr_daily_limit', '100', 'number', 'Daily limit for cloud OCR API calls'),
    ('admin_user_ids', '', 'string', 'Comma-separated list of admin user IDs'),
    ('enable_analytics', 'true', 'boolean', 'Enable anonymous analytics'),
    ('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode');

-- Insert standard units
INSERT INTO standard_units (unit_type, standard_unit, unit_name)
VALUES
    ('weight', 'kg', 'kilogram'),
    ('volume', 'l', 'liter'),
    ('length', 'm', 'meter'),
    ('area', 'm2', 'square meter'),
    ('piece', 'pc', 'piece');

-- Insert common unit conversions
INSERT INTO unit_conversions (from_unit, to_unit, quantity_type, conversion_factor)
VALUES
    ('g', 'kg', 'weight', 0.001),
    ('kg', 'g', 'weight', 1000),
    ('lb', 'kg', 'weight', 0.45359237),
    ('oz', 'kg', 'weight', 0.0283495),
    ('ml', 'l', 'volume', 0.001),
    ('l', 'ml', 'volume', 1000),
    ('gal', 'l', 'volume', 3.78541),
    ('qt', 'l', 'volume', 0.946353),
    ('pt', 'l', 'volume', 0.473176),
    ('oz-fl', 'l', 'volume', 0.0295735),
    ('cm', 'm', 'length', 0.01),
    ('m', 'cm', 'length', 100),
    ('in', 'm', 'length', 0.0254),
    ('ft', 'm', 'length', 0.3048);

-- Create indexes
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expense_items_expense_id ON expense_items(expense_id);
CREATE INDEX idx_expense_items_product_name_normalized ON expense_items(product_name_normalized);
CREATE INDEX idx_document_extractions_user_id ON document_extractions(user_id);
CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_timestamp ON user_activity_logs(timestamp);
CREATE INDEX idx_retailers_name_normalized ON retailers(name_normalized);
CREATE INDEX idx_vendors_name_normalized ON vendors(name_normalized);
CREATE INDEX idx_brand_dictionary_standard_name ON brand_dictionary(standard_name);

COMMIT;