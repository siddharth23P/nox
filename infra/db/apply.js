const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const connectionString = process.env.DATABASE_URL || 'postgres://serpent@localhost:5432/nox?sslmode=disable';
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to DB');
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await client.query(sql);
    console.log('Schema applied successfully');
  } catch (err) {
    console.error('Error applying schema', err);
  } finally {
    await client.end();
  }
}

applyMigration();
