# Database Seeds

This directory contains SQL seed files for populating the database with test data.

## Files

1. `01_initial_seed.sql`
   - Basic test data including users, categories, and expenses
   - System categories and default settings
   - Test retailers and locations

2. `02_test_data.sql`
   - Additional test data including document extractions
   - User locations and brand dictionary
   - Regional benchmarks and system settings

## Usage

To apply the seeds:

1. First, ensure the database is created and migrations are applied:
   ```bash
   npm run migrate
   ```

2. Then apply the seeds:
   ```bash
   psql -d personal_finance_dev -f database/seeds/01_initial_seed.sql
   psql -d personal_finance_dev -f database/seeds/02_test_data.sql
   ```

## Test Data

The seed files include:

- Test users (admin and regular users)
- System categories with icons and colors
- Sample expenses in different currencies
- Test retailers and locations
- Document extractions
- User locations
- Brand dictionary entries
- Regional benchmarks
- System settings

## Development

When adding new seed data:

1. Create a new numbered file (e.g., `03_new_data.sql`)
2. Use transactions (BEGIN/COMMIT)
3. Include appropriate test data
4. Update this README
5. Test the seeds on a clean database 