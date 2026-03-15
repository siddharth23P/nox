import { test, expect } from '@playwright/test';
import { loginUser, USERS } from './auth-helper';

const API = 'http://localhost:8080/v1';

const alice = USERS.AliceReads;
const bob = USERS.BobReads;

let aliceHeaders: Record<string, string>;
let bobHeaders: Record<string, string>;

test.beforeAll(async () => {
  const aliceAuth = await loginUser(alice.email);
  const bobAuth = await loginUser(bob.email);
  aliceHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceAuth.token}` };
  bobHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${bobAuth.token}` };
});

test.describe('Direct Messages (Issue #113)', () => {

  test('Create a DM channel between two users and list it', async ({ request }) => {
    const createRes = await request.post(`${API}/dm`, {
      headers: aliceHeaders,
      data: { user_id: bob.id },
    });
    expect(createRes.ok()).toBeTruthy();
    const dm = await createRes.json();
    expect(dm.channel_id).toBeTruthy();
    expect(dm.user_id).toBe(bob.id);
    expect(dm.username).toBe(bob.username);

    const listRes = await request.get(`${API}/dm`, { headers: aliceHeaders });
    expect(listRes.ok()).toBeTruthy();
    const dms = await listRes.json();
    expect(Array.isArray(dms)).toBeTruthy();
    const found = dms.find((d: { user_id: string }) => d.user_id === bob.id);
    expect(found).toBeTruthy();
    expect(found.username).toBe(bob.username);

    const bobListRes = await request.get(`${API}/dm`, { headers: bobHeaders });
    expect(bobListRes.ok()).toBeTruthy();
    const bobDms = await bobListRes.json();
    const bobFound = bobDms.find((d: { user_id: string }) => d.user_id === alice.id);
    expect(bobFound).toBeTruthy();
    expect(bobFound.username).toBe(alice.username);
  });

  test('Creating a DM with yourself returns 400', async ({ request }) => {
    const res = await request.post(`${API}/dm`, {
      headers: aliceHeaders,
      data: { user_id: alice.id },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('yourself');
  });

  test('Creating a DM with non-existent user returns 404', async ({ request }) => {
    const res = await request.post(`${API}/dm`, {
      headers: aliceHeaders,
      data: { user_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' },
    });
    expect(res.status()).toBe(404);
  });

  test('Idempotent — creating same DM twice returns same channel', async ({ request }) => {
    const res1 = await request.post(`${API}/dm`, {
      headers: aliceHeaders,
      data: { user_id: bob.id },
    });
    const dm1 = await res1.json();

    const res2 = await request.post(`${API}/dm`, {
      headers: aliceHeaders,
      data: { user_id: bob.id },
    });
    const dm2 = await res2.json();

    expect(dm1.channel_id).toBe(dm2.channel_id);
  });

  test('DM requires authentication', async ({ request }) => {
    const res = await request.get(`${API}/dm`, {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });

  test('Send and receive messages in a DM channel', async ({ request }) => {
    const createRes = await request.post(`${API}/dm`, {
      headers: aliceHeaders,
      data: { user_id: bob.id },
    });
    const dm = await createRes.json();
    const channelId = dm.channel_id;

    const msgContent = `Hello Bob from DM ${Date.now()}`;
    const sendRes = await request.post(`${API}/channels/${channelId}/messages`, {
      headers: aliceHeaders,
      data: { content_md: msgContent },
    });
    expect(sendRes.ok()).toBeTruthy();
    const msg = await sendRes.json();
    expect(msg.content_md).toBe(msgContent);

    const getRes = await request.get(`${API}/channels/${channelId}/messages`, {
      headers: bobHeaders,
    });
    expect(getRes.ok()).toBeTruthy();
    const body = await getRes.json();
    const messages = body.messages || body;
    const found = messages.find((m: { content_md: string }) => m.content_md === msgContent);
    expect(found).toBeTruthy();
    expect(found.user_id).toBe(alice.id);
  });
});
