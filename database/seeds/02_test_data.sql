-- Additional test data for development environment
BEGIN;

-- Insert test document extractions
INSERT INTO document_extractions (extraction_id, user_id, document_type, extraction_date, data_extracted, confidence_score, detected_language, original_text, translated_text, storage_path, processed_status)
VALUES 
  ('test_ext_1', 'test_user_1', 'receipt', NOW(), '{"total": 150.50, "items": [{"name": "Groceries", "amount": 150.50}]}', 95, 'en', 'Walmart\nTotal: $150.50', 'Walmart\nИтого: $150.50', '/receipts/test_ext_1.jpg', 'completed'),
  ('test_ext_2', 'test_user_2', 'receipt', NOW(), '{"total": 2500.00, "items": [{"name": "Продукты", "amount": 2500.00}]}', 95, 'ru', 'Пятёрочка\nИтого: 2500.00 ₽', 'Pyaterochka\nTotal: 2500.00 RUB', '/receipts/test_ext_2.jpg', 'completed');

-- Insert test user locations
INSERT INTO user_locations (user_id, address_line1, city, country, latitude, longitude, is_primary)
VALUES 
  ('test_user_1', '789 Home St', 'New York', 'USA', 40.7128, -74.0060, true),
  ('test_user_2', 'ул. Гагарина, 15', 'Москва', 'Russia', 55.7558, 37.6173, true);

-- Insert test brand dictionary entries
INSERT INTO brand_dictionary (brand_name, standard_name, variations, category)
VALUES 
  ('Walmart', 'Walmart', '{"Walmart Supercenter", "Walmart Express"}', 'Retail'),
  ('Amazon', 'Amazon', '{"Amazon.com", "Amazon Prime"}', 'E-commerce'),
  ('Пятёрочка', 'Pyaterochka', '{"Пятерочка", "5"}', 'Retail'),
  ('Wildberries', 'Wildberries', '{"WB", "Вайлдберриз"}', 'E-commerce');

-- Insert test regional benchmarks
INSERT INTO regional_benchmarks (region, city, country, time_period, start_date, end_date, currency, user_count, avg_spent, median_spent, p25_spent, p75_spent, avg_transaction_count, category_data)
VALUES 
  ('Northeast', 'New York', 'USA', 'month', NOW() - INTERVAL '1 month', NOW(), 'USD', 100, 2500.00, 2200.00, 1800.00, 3000.00, 25.5, '{"Food": 30, "Transport": 20, "Shopping": 50}'),
  ('Central', 'Moscow', 'Russia', 'month', NOW() - INTERVAL '1 month', NOW(), 'RUB', 100, 25000.00, 22000.00, 18000.00, 30000.00, 25.5, '{"Food": 30, "Transport": 20, "Shopping": 50}');

-- Insert test system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES 
  ('backup_retention_days', '30', 'number', 'Number of days to keep backups'),
  ('ocr_daily_limit', '100', 'number', 'Daily limit for cloud OCR API calls'),
  ('admin_user_ids', 'test_admin_1', 'string', 'Comma-separated list of admin user IDs'),
  ('enable_analytics', 'true', 'boolean', 'Enable anonymous analytics'),
  ('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode');

COMMIT; 