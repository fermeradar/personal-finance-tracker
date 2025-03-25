-- Seed data for development environment
BEGIN;

-- Insert test users
INSERT INTO users (user_id, first_name, last_name, username, preferred_language, currency, time_zone, join_date, is_admin)
VALUES 
  ('test_admin_1', 'Admin', 'User', 'admin_user', 'en', 'USD', 'UTC', NOW(), true),
  ('test_user_1', 'John', 'Doe', 'john_doe', 'en', 'USD', 'UTC', NOW(), false),
  ('test_user_2', 'Jane', 'Smith', 'jane_smith', 'ru', 'RUB', 'Europe/Moscow', NOW(), false);

-- Insert system categories
INSERT INTO categories (name, name_normalized, icon, color, is_system, user_id)
VALUES 
  ('Food & Dining', 'food_dining', '🍽️', '#FF6B6B', true, 'test_admin_1'),
  ('Transportation', 'transportation', '🚗', '#4ECDC4', true, 'test_admin_1'),
  ('Shopping', 'shopping', '🛍️', '#45B7D1', true, 'test_admin_1'),
  ('Bills & Utilities', 'bills_utilities', '📄', '#96CEB4', true, 'test_admin_1'),
  ('Entertainment', 'entertainment', '🎮', '#FFEEAD', true, 'test_admin_1'),
  ('Health & Medical', 'health_medical', '🏥', '#D4A5A5', true, 'test_admin_1'),
  ('Education', 'education', '📚', '#9B59B6', true, 'test_admin_1'),
  ('Travel', 'travel', '✈️', '#3498DB', true, 'test_admin_1'),
  ('Gifts & Donations', 'gifts_donations', '🎁', '#E74C3C', true, 'test_admin_1'),
  ('Other', 'other', '📌', '#95A5A6', true, 'test_admin_1');

-- Insert test expenses for test_user_1
INSERT INTO expenses (user_id, amount, currency, category_id, description, expense_date, payment_method, merchant_name)
SELECT 
  'test_user_1',
  CASE 
    WHEN random() < 0.5 THEN (random() * 100)::numeric(10,2)
    ELSE (random() * 1000)::numeric(10,2)
  END,
  CASE 
    WHEN random() < 0.7 THEN 'USD'
    ELSE 'EUR'
  END,
  c.category_id,
  CASE 
    WHEN random() < 0.3 THEN 'Grocery shopping'
    WHEN random() < 0.6 THEN 'Restaurant bill'
    ELSE 'Online purchase'
  END,
  NOW() - (random() * 30)::integer * INTERVAL '1 day',
  CASE 
    WHEN random() < 0.4 THEN 'Credit Card'
    WHEN random() < 0.7 THEN 'Cash'
    ELSE 'Debit Card'
  END,
  CASE 
    WHEN random() < 0.3 THEN 'Walmart'
    WHEN random() < 0.6 THEN 'Amazon'
    ELSE 'Local Store'
  END
FROM categories c
WHERE c.is_system = true
LIMIT 50;

-- Insert test expenses for test_user_2
INSERT INTO expenses (user_id, amount, currency, category_id, description, expense_date, payment_method, merchant_name)
SELECT 
  'test_user_2',
  CASE 
    WHEN random() < 0.5 THEN (random() * 1000)::numeric(10,2)
    ELSE (random() * 5000)::numeric(10,2)
  END,
  CASE 
    WHEN random() < 0.7 THEN 'RUB'
    ELSE 'USD'
  END,
  c.category_id,
  CASE 
    WHEN random() < 0.3 THEN 'Продукты'
    WHEN random() < 0.6 THEN 'Ресторан'
    ELSE 'Онлайн покупка'
  END,
  NOW() - (random() * 30)::integer * INTERVAL '1 day',
  CASE 
    WHEN random() < 0.4 THEN 'Кредитная карта'
    WHEN random() < 0.7 THEN 'Наличные'
    ELSE 'Дебетовая карта'
  END,
  CASE 
    WHEN random() < 0.3 THEN 'Пятёрочка'
    WHEN random() < 0.6 THEN 'Wildberries'
    ELSE 'Локальный магазин'
  END
FROM categories c
WHERE c.is_system = true
LIMIT 50;

-- Insert test retailers
INSERT INTO retailers (name, name_normalized, name_variations, website, global_chain)
VALUES 
  ('Walmart', 'walmart', '{"Walmart Supercenter", "Walmart Express"}', 'walmart.com', true),
  ('Amazon', 'amazon', '{"Amazon.com", "Amazon Prime"}', 'amazon.com', true),
  ('Пятёрочка', 'pyaterochka', '{"Пятерочка", "5"}', '5ka.ru', true),
  ('Wildberries', 'wildberries', '{"WB", "Вайлдберриз"}', 'wildberries.ru', true);

-- Insert test retail locations
INSERT INTO retail_locations (retailer_id, address_line1, city, country, latitude, longitude, store_type, price_tier)
SELECT 
  r.retailer_id,
  CASE 
    WHEN r.name = 'Walmart' THEN '123 Main St'
    WHEN r.name = 'Amazon' THEN '456 Commerce Ave'
    WHEN r.name = 'Пятёрочка' THEN 'ул. Ленина, 10'
    ELSE 'ул. Пушкина, 5'
  END,
  CASE 
    WHEN r.name IN ('Walmart', 'Amazon') THEN 'New York'
    ELSE 'Москва'
  END,
  CASE 
    WHEN r.name IN ('Walmart', 'Amazon') THEN 'USA'
    ELSE 'Russia'
  END,
  CASE 
    WHEN r.name = 'Walmart' THEN 40.7128
    WHEN r.name = 'Amazon' THEN 40.7129
    WHEN r.name = 'Пятёрочка' THEN 55.7558
    ELSE 55.7559
  END,
  CASE 
    WHEN r.name = 'Walmart' THEN -74.0060
    WHEN r.name = 'Amazon' THEN -74.0061
    WHEN r.name = 'Пятёрочка' THEN 37.6173
    ELSE 37.6174
  END,
  CASE 
    WHEN r.name = 'Walmart' THEN 'Superstore'
    WHEN r.name = 'Amazon' THEN 'Warehouse'
    ELSE 'Grocery Store'
  END,
  CASE 
    WHEN r.name = 'Walmart' THEN 'medium'
    WHEN r.name = 'Amazon' THEN 'high'
    ELSE 'low'
  END
FROM retailers r;

COMMIT; 