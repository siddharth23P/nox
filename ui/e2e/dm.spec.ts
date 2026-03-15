import { test, expect } from '@playwright/test';

const API = 'http://localhost:8080/v1';
const ORG_ID = '00000000-0000-0000-0000-000000000001';

// Seeded users
const alice = { id: 'a1111111-1111-1111-1111-111111111111', username: 'AliceReads' };
const bob = { id: 'b2222222-2222-2222-2222-222222222222', username: 'BobReads' };

function headers(userId: string) {
  return {
    'Content-Type': 'application/json',
    'X-Org-ID': ORG_ID,
    'X-User-ID': userId,
  };
}

test.describe('Direct Messages (Issue #113)', () => {

  test('Create a DM channel between two users and list it', async ({ request }) => {
    // Alice creates (or gets) a DM with Bob
    const createRes = await request.post(`${API}/dm`, {
      headers: headers(alice.id),
      data: { user_id: bob.id },
    });
    expect(createRes.ok()).toBeTruthy();
    const dm = await createRes.json();
    expect(dm.channel_id).toBeTruthy();
    expect(dm.user_id).toBe(bob.id);
    expect(dm.username).toBe(bob.username);

    // Alice lists her DMs — should include Bob
    const listRes = await request.get(`${API}/dm`, { headers: headers(alice.id) });
    expect(listRes.ok()).toBeTruthy();
    const dms = await listRes.json();
    expect(Array.isArray(dms)).toBeTruthy();
    const found = dms.find((d: { user_id: string }) => d.user_id === bob.id);
    expect(found).toBeTruthy();
    expect(found.username).toBe(bob.username);

    // Bob lists his DMs — should include Alice
    const bobListRes = await request.get(`${API}/dm`, { headers: headers(bob.id) });
    expect(bobListRes.ok()).toBeTruthy();
    const bobDms = await bobListRes.json();
    const bobFound = bobDms.find((d: { user_id: string }) => d.user_id === alice.id);
    expect(bobFound).toBeTruthy();
    expect(bobFound.username).toBe(alice.username);
  });

  test('Creating a DM with yourself returns 400', async ({ request }) => {
    const res = await request.post(`${API}/dm`, {
      headers: headers(alice.id),
      data: { user_id: alice.id },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('yourself');
  });

  test('Creating a DM with non-existent user returns 404', async ({ request }) => {
    const res = await request.post(`${API}/dm`, {
      headers: headers(alice.id),
      data: { user_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' },
    });
    expect(res.status()).toBe(404);
  });

  test('Idempotent — creating same DM twice returns same channel', async ({ request }) => {
    const res1 = await request.post(`${API}/dm`, {
      headers: headers(alice.id),
      data: { user_id: bob.id },
    });
    const dm1 = await res1.json();

    const res2 = await request.post(`${API}/dm`, {
      headers: headers(alice.id),
      data: { user_id: bob.id },
    });
    const dm2 = await res2.json();

    expect(dm1.channel_id).toBe(dm2.channel_id);
  });

  test('DM requires authentication headers', async ({ request }) => {
    // No X-User-ID
    const res = await request.get(`${API}/dm`, {
      headers: { 'Content-Type': 'application/json', 'X-Org-ID': ORG_ID },
    });
    expect(res.status()).toBe(401);
  });

  test('Send and receive messages in a DM channel', async ({ request }) => {
    // Create DM
    const createRes = await request.post(`${API}/dm`, {
      headers: headers(alice.id),
      data: { user_id: bob.id },
    });
    const dm = await createRes.json();
    const channelId = dm.channel_id;

    // Alice sends a message in the DM
    const msgContent = `Hello Bob from DM ${Date.now()}`;
    const sendRes = await request.post(`${API}/channels/${channelId}/messages`, {
      headers: headers(alice.id),
      data: { content_md: msgContent },
    });
    expect(sendRes.ok()).toBeTruthy();
    const msg = await sendRes.json();
    expect(msg.content_md).toBe(msgContent);

    // Bob reads messages in the DM channel
    const getRes = await request.get(`${API}/channels/${channelId}/messages`, {
      headers: headers(bob.id),
    });
    expect(getRes.ok()).toBeTruthy();
    const messages = await getRes.json();
    const found = messages.find((m: { content_md: string }) => m.content_md === msgContent);
    expect(found).toBeTruthy();
    expect(found.user_id).toBe(alice.id);
  });
});
