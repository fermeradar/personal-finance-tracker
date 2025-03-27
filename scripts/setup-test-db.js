import pkg from 'pg';
const { Client } = pkg;

async function setupTestDatabase() {
  // Connect as superuser using your system username
  const adminClient = new Client({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: process.env.USER, // This will use your system username
    // password: '' // On macOS, local connections often don't need a password
  });

  let testDbClient;

  try {
    await adminClient.connect();
    console.log('Connected as admin...');
    
    // Create test user if it doesn't exist
    await adminClient.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'test_user') THEN
          CREATE USER test_user WITH PASSWORD 'test_password';
        END IF;
      END
      $$;
    `);
    console.log('Test user checked/created...');

    // Check if database exists
    const dbExists = await adminClient.query(`
      SELECT 1 FROM pg_database WHERE datname = 'personal_finance_test'
    `);

    // Create database if it doesn't exist
    if (dbExists.rows.length === 0) {
      await adminClient.query(`CREATE DATABASE personal_finance_test`);
      console.log('Test database created...');
    } else {
      console.log('Test database already exists...');
    }

    // Grant privileges
    await adminClient.query(`
      GRANT ALL PRIVILEGES ON DATABASE personal_finance_test TO test_user;
    `);
    console.log('Privileges granted on database...');

    // Connect to test database to set up schema privileges
    testDbClient = new Client({
      host: 'localhost',
      port: 5432,
      database: 'personal_finance_test',
      user: process.env.USER,
      // password: ''
    });

    await testDbClient.connect();
    
    // Create schema if it doesn't exist and grant privileges
    await testDbClient.query(`
      CREATE SCHEMA IF NOT EXISTS public;
      GRANT ALL ON SCHEMA public TO test_user;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO test_user;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO test_user;
    `);
    console.log('Schema privileges granted...');

    console.log('Test database setup completed successfully');
  } catch (error) {
    console.error('Error setting up test database:', error);
    process.exit(1);
  } finally {
    if (adminClient) {
      await adminClient.end();
    }
    if (testDbClient) {
      await testDbClient.end();
    }
  }
}

setupTestDatabase();