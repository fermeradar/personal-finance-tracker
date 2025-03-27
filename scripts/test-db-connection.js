import pkg from 'pg';
const { Client } = pkg;

async function testConnection() {
  // Test superuser connection
  const superuserClient = new Client({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: process.env.USER
  });

  try {
    console.log('Testing superuser connection...');
    await superuserClient.connect();
    const result = await superuserClient.query('SELECT current_user');
    console.log('Connected as:', result.rows[0].current_user);
  } catch (error) {
    console.error('Superuser connection failed:', error);
  } finally {
    await superuserClient.end();
  }
}

testConnection();