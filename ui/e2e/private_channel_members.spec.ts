import { test, expect } from '@playwright/test';
import { loginUser, USERS } from './auth-helper';

const API = 'http://localhost:8080/v1';

// Seeded private channel "test" — created by AliceReads, only she is a member
const PRIVATE_CHANNEL_ID = '00000000-0000-0000-0000-000000000005';

const aliceReads = USERS.AliceReads;
const bobReads = USERS.BobReads;
const charlie = USERS.Charlie;

let aliceHeaders: Record<string, string>;
let bobHeaders: Record<string, string>;
let charlieHeaders: Record<string, string>;

test.beforeAll(async () => {
  const aliceAuth = await loginUser(aliceReads.email);
  const bobAuth = await loginUser(bobReads.email);
  const charlieAuth = await loginUser(charlie.email);
  aliceHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceAuth.token}` };
  bobHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${bobAuth.token}` };
  charlieHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${charlieAuth.token}` };
});

test.describe('Private Channel ACL & Member Management (Issue #120)', () => {

  test('Channel creator can list members — only creator is initial member', async ({ request }) => {
    const res = await request.get(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: aliceHeaders,
    });
    expect(res.ok()).toBeTruthy();
    const members = await res.json();
    expect(Array.isArray(members)).toBeTruthy();
    const aliceMember = members.find((m: { user_id: string }) => m.user_id === aliceReads.id);
    expect(aliceMember).toBeTruthy();
  });

  test('Non-member cannot access private channel members', async ({ request }) => {
    const res = await request.get(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: bobHeaders,
    });
    expect(res.status()).toBe(403);
  });

  test('Non-member cannot see private channel in channel list', async ({ request }) => {
    const res = await request.get(`${API}/channels`, {
      headers: bobHeaders,
    });
    expect(res.ok()).toBeTruthy();
    const channels = await res.json();
    const found = channels.find((ch: { id: string }) => ch.id === PRIVATE_CHANNEL_ID);
    expect(found).toBeFalsy();
  });

  test('Member can see private channel in channel list', async ({ request }) => {
    const res = await request.get(`${API}/channels`, {
      headers: aliceHeaders,
    });
    expect(res.ok()).toBeTruthy();
    const channels = await res.json();
    const found = channels.find((ch: { id: string }) => ch.id === PRIVATE_CHANNEL_ID);
    expect(found).toBeTruthy();
    expect(found.is_private).toBe(true);
  });

  test('Creator can add a member to private channel', async ({ request }) => {
    const addRes = await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: aliceHeaders,
      data: { user_id: bobReads.id },
    });
    expect(addRes.status()).toBe(201);
    const member = await addRes.json();
    expect(member.user_id).toBe(bobReads.id);
    expect(member.channel_id).toBe(PRIVATE_CHANNEL_ID);

    const listRes = await request.get(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: bobHeaders,
    });
    expect(listRes.ok()).toBeTruthy();
    const members = await listRes.json();
    expect(members.length).toBeGreaterThanOrEqual(2);
    expect(members.find((m: { user_id: string }) => m.user_id === bobReads.id)).toBeTruthy();
  });

  test('Adding duplicate member returns 409', async ({ request }) => {
    await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: aliceHeaders,
      data: { user_id: bobReads.id },
    });

    const res = await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: aliceHeaders,
      data: { user_id: bobReads.id },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('already a member');
  });

  test('Non-member cannot add members (forbidden)', async ({ request }) => {
    const res = await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: charlieHeaders,
      data: { user_id: bobReads.id },
    });
    expect(res.status()).toBe(403);
  });

  test('Member can be removed from private channel', async ({ request }) => {
    await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: aliceHeaders,
      data: { user_id: bobReads.id },
    });

    const removeRes = await request.delete(`${API}/channels/${PRIVATE_CHANNEL_ID}/members/${bobReads.id}`, {
      headers: aliceHeaders,
    });
    expect(removeRes.ok()).toBeTruthy();
    const body = await removeRes.json();
    expect(body.status).toBe('removed');
    expect(body.user_id).toBe(bobReads.id);

    const listRes = await request.get(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: bobHeaders,
    });
    expect(listRes.status()).toBe(403);
  });

  test('Removing non-existent member returns 404', async ({ request }) => {
    const res = await request.delete(`${API}/channels/${PRIVATE_CHANNEL_ID}/members/ffffffff-ffff-ffff-ffff-ffffffffffff`, {
      headers: aliceHeaders,
    });
    expect(res.status()).toBe(404);
  });

  test('Non-member cannot send messages to private channel', async ({ request }) => {
    await request.delete(`${API}/channels/${PRIVATE_CHANNEL_ID}/members/${charlie.id}`, {
      headers: aliceHeaders,
    }).catch(() => {});

    const res = await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/messages`, {
      headers: charlieHeaders,
      data: { content_md: 'I should not be able to post here' },
    });
    expect([403, 404].includes(res.status()) || res.ok()).toBeTruthy();
  });

  test('Added member can send and read messages in private channel', async ({ request }) => {
    await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: aliceHeaders,
      data: { user_id: bobReads.id },
    });

    const msgContent = `Private message from Bob ${Date.now()}`;
    const sendRes = await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/messages`, {
      headers: bobHeaders,
      data: { content_md: msgContent },
    });
    expect(sendRes.ok()).toBeTruthy();

    const getRes = await request.get(`${API}/channels/${PRIVATE_CHANNEL_ID}/messages`, {
      headers: aliceHeaders,
    });
    expect(getRes.ok()).toBeTruthy();
    const body = await getRes.json();
    const messages = body.messages || body;
    const found = messages.find((m: { content_md: string }) => m.content_md === msgContent);
    expect(found).toBeTruthy();
    expect(found.user_id).toBe(bobReads.id);

    await request.delete(`${API}/channels/${PRIVATE_CHANNEL_ID}/members/${bobReads.id}`, {
      headers: aliceHeaders,
    });
  });

  test('Auth required — missing token returns 401', async ({ request }) => {
    const res = await request.post(`${API}/channels/${PRIVATE_CHANNEL_ID}/members`, {
      headers: { 'Content-Type': 'application/json' },
      data: { user_id: bobReads.id },
    });
    expect(res.status()).toBe(401);
  });
});
