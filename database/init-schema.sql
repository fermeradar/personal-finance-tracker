-- Drop tables in correct order
DROP TABLE IF EXISTS document_extractions CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS exchange_rates CASCADE;
DROP TABLE IF EXISTS translations CASCADE;

-- Create users table
CREATE TABLE users (
    user_id VARCHAR(50) PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    preferred_language VARCHAR(10) DEFAULT 'en',
    preferred_currency VARCHAR(3) DEFAULT 'USD',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table
CREATE TABLE sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

-- Create expenses table
CREATE TABLE expenses (
    expense_id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create document_extractions table
CREATE TABLE document_extractions (
    extraction_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    extracted_amount DECIMAL(12,2),
    extracted_date DATE,
    extracted_currency VARCHAR(3),
    confidence_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create exchange_rates table
CREATE TABLE exchange_rates (
    currency_pair VARCHAR(7) PRIMARY KEY,
    rate DECIMAL(12,6) NOT NULL,
    last_updated TIMESTAMP NOT NULL
);

-- Create translations table
CREATE TABLE translations (
    translation_key VARCHAR(255) NOT NULL,
    language_code VARCHAR(5) NOT NULL,
    translation_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (translation_key, language_code)
);

-- Insert default test user
INSERT INTO users (user_id, first_name, last_name, email, password)
VALUES ('test_user', 'Test', 'User', 'test@example.com', '$2b$10$TestHashedPassword') 
ON CONFLICT DO NOTHING;

-- Insert default categories
INSERT INTO categories (user_id, name, description)
VALUES 
    ('test_user', 'Food', 'Food and dining expenses'),
    ('test_user', 'Transport', 'Transportation expenses'),
    ('test_user', 'Utilities', 'Utility bills')
ON CONFLICT DO NOTHING;
