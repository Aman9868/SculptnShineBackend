import { Client } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const createDatabase = async () => {
  const user = process.env.DB_USER || 'postgres';
  const pass = process.env.DB_PASS ? `:${process.env.DB_PASS}` : '';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const defaultDbUrl = `postgresql://${user}${pass}@${host}:${port}/postgres`;
  const targetDbName = process.env.DB_NAME || 'sculptnshine_db';

  console.log(`Connecting to default database to check if '${targetDbName}' exists...`);
  
  const client = new Client({
    connectionString: defaultDbUrl,
  });

  try {
    await client.connect();

    const res = await client.query(`SELECT datname FROM pg_catalog.pg_database WHERE datname = $1`, [targetDbName]);

    if (res.rowCount === 0) {
      console.log(`Database '${targetDbName}' does not exist. Creating...`);
      await client.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(`✅ Database '${targetDbName}' created successfully.`);
    } else {
      console.log(`ℹ️ Database '${targetDbName}' already exists. Skipping creation.`);
    }
  } catch (error) {
    console.error('❌ Error creating database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
};

createDatabase();
