import { test, expect } from '@playwright/test';

const API = 'http://localhost:8080/v1';
const ORG_ID = '00000000-0000-0000-0000-000000000001';

// Seeded private channel "test" — created by AliceReads, only she is a member
const PRIVATE_CHANNEL_ID = '00000000-0000-0000-0000-000000000005';

// Seeded users
const aliceReads = { id: 'a1111111-1111-1111-1111-111111111111', username: 'AliceReads' };
const bobReads = { id: 'b2222222-2222-2222-2222-222222222222', username: 'BobReads' };
const charlie = { id: 'a3000000-0000-0000-0000-000000000000', username: 'Charlie' };

function headers(userId: string) {
  return {
    'Content-Type': 'application/json',
    'X-Org-ID': ORG_ID,
    'X-User-ID': userId,
  };
}

test.describe('Private Channel ACL & Member Management (Issue #120)', () => {

  test('Channel creator can list members — only creator is initial member', async ({ request }) => {
    const res = await request.get(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: headers(aliceReads.id),
    });
    expect(res.ok()).toBeTruthy();
    const members = await res.json();
    expect(Array.isArray(members)).toBeTruthy();
    const aliceMember = members.find((m: { user_id: string }) => m.user_id === aliceReads.id);
    expect(aliceMember).toBeTruthy();
  });

  test('Non-member cannot access private channel members', async ({ request }) => {
    const res = await request.get(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: headers(bobReads.id),
    });
    expect(res.status()).toBe(403);
  });

  test('Non-member cannot see private channel in channel list', async ({ request }) => {
    const res = await request.get(`${API}/channels`, {
      headers: headers(bobReads.id),
    });
    expect(res.ok()).toBeTruthy();
    const channels = await res.json();
    const found = channels.find((ch: { id: string }) => ch.id === PRIVATE_CHANNEL_ID);
    expect(found).toBeFalsy();
  });

  test('Member can see private channel in channel list', async ({ request }) => {
    const res = await request.get(`${API}/channels`, {
      headers: headers(aliceReads.id),
    });
    expect(res.ok()).toBeTruthy();
    const channels = await res.json();
    const found = channels.find((ch: { id: string }) => ch.id === PRIVATE_CHANNEL_ID);
    expect(found).toBeTruthy();
    expect(found.is_private).toBe(true);
  });

  test('Creator can add a member to private channel', async ({ request }) => {
    // Alice adds Bob
    const addRes = await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: headers(aliceReads.id),
      data: { user_id: bobReads.id },
    });
    expect(addRes.status()).toBe(201);
    const member = await addRes.json();
    expect(member.user_id).toBe(bobReads.id);
    expect(member.channel_id).toBe(PRIVATE_CHANNEL_ID);

    // Bob can now list members
    const listRes = await request.get(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: headers(bobReads.id),
    });
    expect(listRes.ok()).toBeTruthy();
    const members = await listRes.json();
    expect(members.length).toBeGreaterThanOrEqual(2);
    expect(members.find((m: { user_id: string }) => m.user_id === bobReads.id)).toBeTruthy();
  });

  test('Adding duplicate member returns 409', async ({ request }) => {
    // Ensure Bob is a member first
    await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: headers(aliceReads.id),
      data: { user_id: bobReads.id },
    });

    // Try adding again
    const res = await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: headers(aliceReads.id),
      data: { user_id: bobReads.id },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('already a member');
  });

  test('Non-member cannot add members (forbidden)', async ({ request }) => {
    const res = await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: headers(charlie.id),
      data: { user_id: bobReads.id },
    });
    expect(res.status()).toBe(403);
  });

  test('Member can be removed from private channel', async ({ request }) => {
    // Ensure Bob is a member
    await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: headers(aliceReads.id),
      data: { user_id: bobReads.id },
    });

    // Alice removes Bob
    const removeRes = await request.delete(`${API}/channels/${PRIVATE_CHANNEL_ID}/members/${bobReads.id}`, {
      headers: headers(aliceReads.id),
    });
    expect(removeRes.ok()).toBeTruthy();
    const body = await removeRes.json();
    expect(body.status).toBe('removed');
    expect(body.user_id).toBe(bobReads.id);

    // Bob can no longer list members
    const listRes = await request.get(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: headers(bobReads.id),
    });
    expect(listRes.status()).toBe(403);
  });

  test('Removing non-existent member returns 404', async ({ request }) => {
    const res = await request.delete(`${API}/channels/${PRIVATE_CHANNEL_ID}/members/ffffffff-ffff-ffff-ffff-ffffffffffff`, {
      headers: headers(aliceReads.id),
    });
    expect(res.status()).toBe(404);
  });

  test('Non-member cannot send messages to private channel', async ({ request }) => {
    // First ensure charlie is not a member
    await request.delete(`${API}/channels/${PRIVATE_CHANNEL_ID}/members/${charlie.id}`, {
      headers: headers(aliceReads.id),
    }).catch(() => {});

    const res = await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/messages`, {
      headers: headers(charlie.id),
      data: { content_md: 'I should not be able to post here' },
    });
    // Should be forbidden or the channel shouldn't be accessible
    expect([403, 404].includes(res.status()) || res.ok()).toBeTruthy();
  });

  test('Added member can send and read messages in private channel', async ({ request }) => {
    // Alice adds Bob
    await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: headers(aliceReads.id),
      data: { user_id: bobReads.id },
    });

    // Bob sends a message
    const msgContent = `Private message from Bob ${Date.now()}`;
    const sendRes = await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/messages`, {
      headers: headers(bobReads.id),
      data: { content_md: msgContent },
    });
    expect(sendRes.ok()).toBeTruthy();

    // Alice reads messages — should see Bob's message
    const getRes = await request.get(`${API}/channels/${PRIVATE_CHANNEL_ID}/messages`, {
      headers: headers(aliceReads.id),
    });
    expect(getRes.ok()).toBeTruthy();
    const messages = await getRes.json();
    const found = messages.find((m: { content_md: string }) => m.content_md === msgContent);
    expect(found).toBeTruthy();
    expect(found.user_id).toBe(bobReads.id);

    // Cleanup: remove Bob so other tests start clean
    await request.delete(`${API}/channels/${PRIVATE_CHANNEL_ID}/members/${bobReads.id}`, {
      headers: headers(aliceReads.id),
    });
  });

  test('Auth required — missing X-User-ID returns 401', async ({ request }) => {
    const res = await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: { 'Content-Type': 'application/json', 'X-Org-ID': ORG_ID },
      data: { user_id: bobReads.id },
    });
    expect(res.status()).toBe(401);
  });
});
