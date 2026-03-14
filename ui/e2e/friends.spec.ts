import { test, expect } from '@playwright/test';
import { Client } from 'pg';

const API_BASE = 'http://localhost:8080/v1';

test.describe('Friend System (Issue #61)', () => {
  const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000000)}`;
  const userAEmail = `friend-a-${uniqueId}@example.com`;
  const userBEmail = `friend-b-${uniqueId}@example.com`;
  const testPassword = 'Password123!';
  const userAUsername = `fra_${Math.floor(Math.random() * 1000000000)}`;
  const userBUsername = `frb_${Math.floor(Math.random() * 1000000000)}`;
  const orgName = `FriendTestOrg_${uniqueId}`;

  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;

  // Helper: register, verify, and login a user via API
  async function registerAndLogin(email: string, username: string, password: string, org: string) {
    // Register
    const regRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        username,
        password,
        full_name: username,
        org_name: org,
      }),
    });
    expect(regRes.ok).toBeTruthy();

    // Verify email via DB
    const connectionString = process.env.DATABASE_URL || 'postgres://serpent@localhost:5432/nox?sslmode=disable';
    const client = new Client({ connectionString });
    await client.connect();
    let realToken: string | null = null;
    for (let i = 0; i < 15; i++) {
      const result = await client.query(
        'SELECT verification_token FROM users WHERE email = $1',
        [email]
      );
      if (result.rows.length > 0 && result.rows[0].verification_token) {
        realToken = result.rows[0].verification_token;
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(realToken).toBeTruthy();

    const verifyRes = await fetch(`${API_BASE}/auth/verify?token=${realToken}`);
    expect(verifyRes.ok).toBeTruthy();
    await client.end();

    // Login
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.ok).toBeTruthy();
    const data = await loginRes.json();
    return { token: data.token, userId: data.user_id };
  }

  test.beforeAll(async () => {
    const a = await registerAndLogin(userAEmail, userAUsername, testPassword, orgName);
    userAToken = a.token;
    userAId = a.userId;

    const b = await registerAndLogin(userBEmail, userBUsername, testPassword, `${orgName}_B`);
    userBToken = b.token;
    userBId = b.userId;
  });

  function authHeaders(token: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  test('should send a friend request', async () => {
    const res = await fetch(`${API_BASE}/friends/request`, {
      method: 'POST',
      headers: authHeaders(userAToken),
      body: JSON.stringify({ addressee_id: userBId }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.friendship).toBeDefined();
    expect(data.friendship.status).toBe('pending');
  });

  test('should list pending friend requests', async () => {
    const res = await fetch(`${API_BASE}/friends?status=pending`, {
      headers: authHeaders(userBToken),
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    expect(data.friends.length).toBeGreaterThanOrEqual(1);
    const request = data.friends.find((f: { user_id: string }) => f.user_id === userAId);
    expect(request).toBeDefined();
    expect(request.direction).toBe('received');
  });

  test('should accept a friend request', async () => {
    // Get pending requests for userB
    const listRes = await fetch(`${API_BASE}/friends?status=pending`, {
      headers: authHeaders(userBToken),
    });
    const listData = await listRes.json();
    const request = listData.friends.find((f: { user_id: string }) => f.user_id === userAId);
    expect(request).toBeDefined();

    const res = await fetch(`${API_BASE}/friends/${request.friendship_id}/accept`, {
      method: 'POST',
      headers: authHeaders(userBToken),
    });
    expect(res.ok).toBeTruthy();
  });

  test('should list accepted friends', async () => {
    const res = await fetch(`${API_BASE}/friends?status=accepted`, {
      headers: authHeaders(userAToken),
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    const friend = data.friends.find((f: { user_id: string }) => f.user_id === userBId);
    expect(friend).toBeDefined();
    expect(friend.status).toBe('accepted');
  });

  test('should prevent duplicate friend requests', async () => {
    const res = await fetch(`${API_BASE}/friends/request`, {
      method: 'POST',
      headers: authHeaders(userAToken),
      body: JSON.stringify({ addressee_id: userBId }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('already friends');
  });

  test('should remove a friend', async () => {
    // Get the friendship
    const listRes = await fetch(`${API_BASE}/friends?status=accepted`, {
      headers: authHeaders(userAToken),
    });
    const listData = await listRes.json();
    const friend = listData.friends.find((f: { user_id: string }) => f.user_id === userBId);
    expect(friend).toBeDefined();

    const res = await fetch(`${API_BASE}/friends/${friend.friendship_id}`, {
      method: 'DELETE',
      headers: authHeaders(userAToken),
    });
    expect(res.ok).toBeTruthy();

    // Verify removed
    const checkRes = await fetch(`${API_BASE}/friends?status=accepted`, {
      headers: authHeaders(userAToken),
    });
    const checkData = await checkRes.json();
    const removed = (checkData.friends || []).find((f: { user_id: string }) => f.user_id === userBId);
    expect(removed).toBeUndefined();
  });

  test('should block a user', async () => {
    const res = await fetch(`${API_BASE}/users/${userBId}/block`, {
      method: 'POST',
      headers: authHeaders(userAToken),
    });
    expect(res.ok).toBeTruthy();

    // Verify blocked list
    const listRes = await fetch(`${API_BASE}/friends?status=blocked`, {
      headers: authHeaders(userAToken),
    });
    const listData = await listRes.json();
    const blocked = listData.friends.find((f: { user_id: string }) => f.user_id === userBId);
    expect(blocked).toBeDefined();
  });

  test('should prevent friend request to blocked user', async () => {
    const res = await fetch(`${API_BASE}/friends/request`, {
      method: 'POST',
      headers: authHeaders(userAToken),
      body: JSON.stringify({ addressee_id: userBId }),
    });
    expect(res.status).toBe(400);
  });

  test('should unblock a user', async () => {
    const res = await fetch(`${API_BASE}/users/${userBId}/block`, {
      method: 'DELETE',
      headers: authHeaders(userAToken),
    });
    expect(res.ok).toBeTruthy();

    // Verify no longer blocked
    const listRes = await fetch(`${API_BASE}/friends?status=blocked`, {
      headers: authHeaders(userAToken),
    });
    const listData = await listRes.json();
    const blocked = (listData.friends || []).find((f: { user_id: string }) => f.user_id === userBId);
    expect(blocked).toBeUndefined();
  });

  test('should search users by username', async () => {
    const res = await fetch(`${API_BASE}/users/search?q=${userBUsername.substring(0, 5)}`, {
      headers: authHeaders(userAToken),
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    expect(data.users.length).toBeGreaterThanOrEqual(1);
  });

  test('should decline a friend request', async () => {
    // Send a new request from A to B
    const sendRes = await fetch(`${API_BASE}/friends/request`, {
      method: 'POST',
      headers: authHeaders(userAToken),
      body: JSON.stringify({ addressee_id: userBId }),
    });
    expect(sendRes.status).toBe(201);
    const sendData = await sendRes.json();

    // Decline as B
    const res = await fetch(`${API_BASE}/friends/${sendData.friendship.id}/decline`, {
      method: 'POST',
      headers: authHeaders(userBToken),
    });
    expect(res.ok).toBeTruthy();

    // Verify gone
    const listRes = await fetch(`${API_BASE}/friends?status=pending`, {
      headers: authHeaders(userBToken),
    });
    const listData = await listRes.json();
    const declined = (listData.friends || []).find((f: { user_id: string }) => f.user_id === userAId);
    expect(declined).toBeUndefined();
  });

  test('should not send friend request to self', async () => {
    const res = await fetch(`${API_BASE}/friends/request`, {
      method: 'POST',
      headers: authHeaders(userAToken),
      body: JSON.stringify({ addressee_id: userAId }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('yourself');
  });
});
