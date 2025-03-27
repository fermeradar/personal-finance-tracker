import pkg from 'pg';
const { Client } = pkg;

async function verifyTestSetup() {
  const testClient = new Client({
    host: 'localhost',
    port: 5432,
    database: 'personal_finance_test',
    user: 'test_user',
    password: 'test_password'
  });

  try {
    await testClient.connect();
    console.log('Successfully connected as test_user');
    const result = await testClient.query('SELECT current_user, current_database()');
    console.log('Connected as:', result.rows[0]);
  } catch (error) {
    console.error('Test connection failed:', error);
  } finally {
    await testClient.end();
  }
}

verifyTestSetup();