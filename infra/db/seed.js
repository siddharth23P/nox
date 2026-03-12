const { Client } = require('pg');

async function seed() {
  const connectionString = process.env.DATABASE_URL || 'postgres://serpent@localhost:5432/nox?sslmode=disable';
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // 1. Define IDs
    const orgId = '11111111-1111-1111-1111-111111111111';
    const userId = '22222222-2222-2222-2222-222222222222';
    
    // 3. Seed channel
    const channelId = '00000000-0000-0000-0000-000000000001';
    
    // Check if org exists before inserting
    const orgCheck = await client.query('SELECT id FROM organizations WHERE id = $1', [orgId]);
    if (orgCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO organizations (id, name, slug) 
        VALUES ($1, 'Test Org', 'test-org-seed')
      `, [orgId]);
    }

    const testUserUuid = '123e4567-e89b-12d3-a456-426614174000';
    const usrCheck = await client.query('SELECT id FROM users WHERE id = $1', [testUserUuid]);
    if (usrCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO users (id, email, username, password_hash) 
        VALUES ($1, 'test@nox.inc', 'testuser', 'nope')
      `, [testUserUuid]);
    }

    const chanCheck = await client.query('SELECT id FROM channels WHERE id = $1', [channelId]);
    if (chanCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO channels (id, org_id, name, description) 
        VALUES ($1, $2, 'general', 'General discussion')
      `, [channelId, orgId]);
    }

    console.log('Seeded successfully. Org:', orgId, 'User:', userId, 'Channel:', channelId);
  } catch (err) {
    console.error('Error seeding data', err);
  } finally {
    await client.end();
  }
}

seed();
