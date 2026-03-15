import { test, expect } from '@playwright/test';
import { Client } from 'pg';

test.describe('User Profiles & Preferences (Issue #26)', () => {
  const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000000)}`;
  const testEmail = `profile-${uniqueId}@example.com`;
  const testPassword = 'Password123!';
  const testUsername = `prof_${Math.floor(Math.random() * 1000000000)}`;

  let authToken: string;

  test.beforeAll(async () => {
    // Register, verify, and get a token via API
    const API = 'http://localhost:8080/v1';

    // 1. Register
    const regRes = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        username: testUsername,
        password: testPassword,
        full_name: 'Profile Test User',
        org_name: 'Profile Test Org',
      }),
    });
    expect(regRes.ok).toBeTruthy();

    // 2. Verify email via DB
    const connectionString = process.env.DATABASE_URL || 'postgres://serpent@localhost:5432/nox?sslmode=disable';
    const client = new Client({ connectionString });
    await client.connect();

    let token: string | null = null;
    for (let i = 0; i < 15; i++) {
      const res = await client.query('SELECT verification_token FROM users WHERE email = $1', [testEmail]);
      if (res.rows.length > 0 && res.rows[0].verification_token) {
        token = res.rows[0].verification_token;
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    expect(token).toBeTruthy();

    await fetch(`${API}/auth/verify?token=${token}`);
    await client.end();

    // 3. Login
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    expect(loginRes.ok).toBeTruthy();
    const loginData = await loginRes.json();
    authToken = loginData.token;
  });

  test('API: Get and update user profile', async () => {
    const API = 'http://localhost:8080/v1';
    const headers = { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' };

    // GET /users/me
    const getRes = await fetch(`${API}/users/me`, { headers });
    expect(getRes.ok).toBeTruthy();
    const profile = await getRes.json();
    expect(profile.email).toBe(testEmail);
    expect(profile.username).toBe(testUsername);

    // PATCH /users/me
    const patchRes = await fetch(`${API}/users/me`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ display_name: 'New Display Name', bio: 'Hello from E2E test!' }),
    });
    expect(patchRes.ok).toBeTruthy();
    const updated = await patchRes.json();
    expect(updated.display_name).toBe('New Display Name');
    expect(updated.bio).toBe('Hello from E2E test!');
  });

  test('API: Get and update preferences', async () => {
    const API = 'http://localhost:8080/v1';
    const headers = { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' };

    // GET /users/me/preferences (should create defaults)
    const getRes = await fetch(`${API}/users/me/preferences`, { headers });
    expect(getRes.ok).toBeTruthy();
    const prefs = await getRes.json();
    expect(prefs.theme).toBe('dark');
    expect(prefs.notification_sound).toBe(true);

    // PATCH /users/me/preferences
    const patchRes = await fetch(`${API}/users/me/preferences`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ theme: 'light', notification_sound: false }),
    });
    expect(patchRes.ok).toBeTruthy();
    const updated = await patchRes.json();
    expect(updated.theme).toBe('light');
    expect(updated.notification_sound).toBe(false);
  });

  test('API: Profile validation - display name too long', async () => {
    const API = 'http://localhost:8080/v1';
    const headers = { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' };

    const patchRes = await fetch(`${API}/users/me`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ display_name: 'x'.repeat(101), bio: 'ok' }),
    });
    expect(patchRes.ok).toBeFalsy();
    const err = await patchRes.json();
    expect(err.error).toContain('100 characters');
  });

  test('UI: Navigate to profile settings and update', async ({ page }) => {
    // Inject auth state and navigate
    await page.addInitScript((data) => {
      (window as unknown as { IS_PLAYWRIGHT: boolean }).IS_PLAYWRIGHT = true;
      localStorage.setItem('nox_token', data.token);
      localStorage.setItem('nox_user', JSON.stringify({ id: 'test', email: 'test@test.com', username: 'testuser' }));
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
    }, { token: authToken });

    await page.goto('/dashboard/settings/profile');
    await page.waitForTimeout(1000);

    // The profile settings page should be visible
    await expect(page.getByText('Profile Settings')).toBeVisible({ timeout: 10000 });

    // Check that username is displayed
    await expect(page.locator('[data-testid="display-name-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="bio-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-profile-button"]')).toBeVisible();
  });
});
