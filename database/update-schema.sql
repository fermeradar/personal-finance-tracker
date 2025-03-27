-- Add missing columns to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS merchant_name TEXT;

-- Add missing columns to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_normalized TEXT;

-- Create document_extractions table if it doesn't exist
CREATE TABLE IF NOT EXISTS document_extractions (
    extraction_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(user_id),
    document_type VARCHAR(50),
    extracted_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create exchange_rates table if it doesn't exist
CREATE TABLE IF NOT EXISTS exchange_rates (
    currency_pair VARCHAR(10) PRIMARY KEY,
    rate DECIMAL(10,4),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create translations table if it doesn't exist
CREATE TABLE IF NOT EXISTS translations (
    key VARCHAR(255) PRIMARY KEY,
    language VARCHAR(5),
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
