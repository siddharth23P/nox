const { Client } = require('pg');

async function seed() {
  const connectionString = process.env.DATABASE_URL || 'postgres://serpent@localhost:5432/nox?sslmode=disable';
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // Org and Channel
    const orgId = '00000000-0000-0000-0000-000000000001';
    const channelId = '00000000-0000-0000-0000-000000000001';

    await client.query(`
      INSERT INTO organizations (id, name, slug) 
      VALUES ($1, 'Test Org', 'test-org-chat')
      ON CONFLICT DO NOTHING
    `, [orgId]);

    await client.query(`
      INSERT INTO channels (id, org_id, name, description) 
      VALUES ($1, $2, 'general', 'General discussion')
      ON CONFLICT DO NOTHING
    `, [channelId, orgId]);

    const users = [
      { id: 'a1000000-0000-0000-0000-000000000000', username: 'alice' },
      { id: 'a2000000-0000-0000-0000-000000000000', username: 'bob' },
      { id: 'a3000000-0000-0000-0000-000000000000', username: 'charlie' },
      { id: 'a4000000-0000-0000-0000-000000000000', username: 'diana' },
      { id: 'a5000000-0000-0000-0000-000000000000', username: 'evan' },
      { id: 'a6000000-0000-0000-0000-000000000000', username: 'fiona' },
      { id: 'a7000000-0000-0000-0000-000000000000', username: 'george' },
      { id: 'a8000000-0000-0000-0000-000000000000', username: 'hannah' },
      { id: 'a9000000-0000-0000-0000-000000000000', username: 'ian' },
      { id: 'b1000000-0000-0000-0000-000000000000', username: 'julia' }
    ];

    for (const u of users) {
      await client.query(`
        INSERT INTO users (id, email, username, password_hash) 
        VALUES ($1, $2, $3, 'nope')
        ON CONFLICT (email) DO NOTHING
      `, [u.id, u.username + '@nox.inc', u.username]);
    }

    // Insert messages
    const messages = [
      { userIndex: 0, text: "Hey team, how is everyone doing today?" },
      { userIndex: 1, text: "Doing great! Just finished the new design mocks for the dashboard." },
      { userIndex: 2, text: "Awesome Bob. Can you share the Figma link?" },
      { userIndex: 3, text: "Yes, please share. I need to update the frontend components to match." },
      { userIndex: 1, text: "Here it is: figma.com/file/xyz... Let me know what you think!" },
      { userIndex: 4, text: "Looks really clean. The new color palette is much better." },
      { userIndex: 5, text: "Agreed. Much better contrast. By the way, has anyone seen the latest backend PR?" },
      { userIndex: 6, text: "I'm reviewing it now. Looks mostly good, just left a few comments on the API changes." },
      { userIndex: 7, text: "Thanks George. I'll address those comments after lunch." },
      { userIndex: 8, text: "Don't forget we have the all-hands meeting at 2 PM." },
      { userIndex: 9, text: "I've added the agenda to the calendar invite. Please review if you want to add anything." },
      { userIndex: 0, text: "Perfect. I'll add a quick update on the user testing results." }
    ];

    let baseTime = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago
    
    // Clear old messages from this channel to avoid clutter
    await client.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const user = users[msg.userIndex];
      const msgTime = new Date(baseTime.getTime() + i * 1000 * 60 * 15); // 15 mins apart
      
      const res = await client.query(`
        INSERT INTO messages (channel_id, user_id, content_md, content_html, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $5)
        RETURNING id
      `, [channelId, user.id, msg.text, '<p>' + msg.text + '</p>', msgTime]);
      
      // Let's add a thread to Bob's figma link message
      if (i === 4) {
        const parentId = res.rows[0].id;
        const threadReplies = [
          { userIndex: 2, text: "Got it! Thanks." },
          { userIndex: 3, text: "Looks amazing!" },
        ];
        for (let j = 0; j < threadReplies.length; j++) {
           const tr = threadReplies[j];
           const replyTime = new Date(msgTime.getTime() + (j + 1) * 1000 * 60);
           await client.query(`
            INSERT INTO messages (channel_id, user_id, parent_id, content_md, content_html, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $6)
          `, [channelId, users[tr.userIndex].id, parentId, tr.text, '<p>' + tr.text + '</p>', replyTime]);
        }
      }
    }

    console.log('Seeded chat successfully');
  } catch (err) {
    console.error('Error seeding data', err);
  } finally {
    await client.end();
  }
}

seed();
