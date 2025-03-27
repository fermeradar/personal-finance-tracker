-- Drop and recreate categories table with correct schema
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table first
CREATE TABLE users (
    user_id VARCHAR(255) PRIMARY KEY,
    first_name VARCHAR(255),
    currency VARCHAR(3) DEFAULT 'EUR',
    region VARCHAR(255)
);

-- Create categories table with correct schema
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_normalized VARCHAR(255),
    icon VARCHAR(50),
    is_system BOOLEAN DEFAULT false,
    user_id VARCHAR(255) REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create expenses table
CREATE TABLE expenses (
    expense_id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(user_id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    category_id INTEGER REFERENCES categories(category_id),
    expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    merchant_name VARCHAR(255),
    data_source VARCHAR(50)
);

-- Insert test user
INSERT INTO users (user_id, first_name, currency, region)
VALUES ('test_user', 'Test User', 'EUR', 'EU');

-- Insert default categories
INSERT INTO categories (name, name_normalized, icon, is_system, user_id)
VALUES 
    ('Food', 'food', '🍽️', true, 'test_user'),
    ('Transport', 'transport', '🚗', true, 'test_user'),
    ('Entertainment', 'entertainment', '🎭', true, 'test_user');
