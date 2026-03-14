import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import crypto from 'crypto';

test.describe('Password Reset & Account Recovery (Issue #40)', () => {
  const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000000)}`;
  const testEmail = `reset-${uniqueId}@example.com`;
  const testPassword = 'Password123!';
  const newPassword = 'NewPassword456!';
  const testUsername = `rst_${Math.floor(Math.random() * 1000000000)}`;

  // Helper: register and verify a user directly via API + DB
  async function setupVerifiedUser() {
    // Register
    const regRes = await fetch('http://localhost:8080/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        username: testUsername,
        password: testPassword,
        full_name: 'Reset Tester',
        org_name: 'ResetOrg',
        recovery_questions: [{ question: 'first_pet', answer: 'Fluffy' }],
      }),
    });
    expect(regRes.ok).toBeTruthy();

    // Verify email directly in DB
    const connectionString = process.env.DATABASE_URL || 'postgres://serpent@localhost:5432/nox?sslmode=disable';
    const client = new Client({ connectionString });
    await client.connect();
    await client.query(
      "UPDATE users SET is_email_verified = TRUE WHERE email = $1",
      [testEmail]
    );
    await client.end();
  }

  test.beforeAll(async () => {
    await setupVerifiedUser();
  });

  test('Forgot password page renders and submits', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('text=Forgot Password')).toBeVisible({ timeout: 10000 });

    await page.fill('input[placeholder="name@nexus.com"]', testEmail);
    await page.click('button:has-text("Send Reset Link")');

    await expect(page.locator('text=Reset Link Sent')).toBeVisible({ timeout: 10000 });
  });

  test('Forgot password API rate limits after 3 requests', async () => {
    // We already sent 1 request above, send 2 more to hit limit
    for (let i = 0; i < 2; i++) {
      const res = await fetch('http://localhost:8080/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
      expect(res.ok).toBeTruthy();
    }

    // 4th request should be rate limited
    const res = await fetch('http://localhost:8080/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    expect(res.status).toBe(429);
  });

  test('Reset password page shows error for missing token', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.locator('text=Invalid Reset Link')).toBeVisible({ timeout: 10000 });
  });

  test('Reset password via API with valid token', async () => {
    // Generate a token via DB directly for testing
    const connectionString = process.env.DATABASE_URL || 'postgres://serpent@localhost:5432/nox?sslmode=disable';
    const client = new Client({ connectionString });
    await client.connect();

    // Reset rate limit first
    await client.query(
      "UPDATE users SET reset_request_count = 0, reset_request_window = NULL WHERE email = $1",
      [testEmail]
    );

    // Generate and store a known token hash (sha256 of 'test-reset-token')
    const rawToken = 'test-reset-token-' + uniqueId;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await client.query(
      "UPDATE users SET password_reset_token = $1, reset_token_expires_at = NOW() + INTERVAL '1 hour' WHERE email = $2",
      [tokenHash, testEmail]
    );
    await client.end();

    // Now reset password via API
    const res = await fetch('http://localhost:8080/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken, new_password: newPassword }),
    });
    expect(res.ok).toBeTruthy();

    // Verify login with new password works
    const loginRes = await fetch('http://localhost:8080/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: newPassword }),
    });
    expect(loginRes.ok).toBeTruthy();
  });

  test('Account recovery page renders', async ({ page }) => {
    await page.goto('/account-recovery');
    await expect(page.locator('text=Account Recovery')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Security Question')).toBeVisible();
  });

  test('Account recovery via security questions API', async () => {
    const res = await fetch('http://localhost:8080/v1/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        answers: [{ question: 'first_pet', answer: 'Fluffy' }],
      }),
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    expect(data.reset_token).toBeTruthy();
    expect(data.success).toBe(true);
  });

  test('Login page has Forgot Password link', async ({ page }) => {
    await page.goto('/');
    // Switch to login view if on register
    if (await page.getByText('Create Nexus Identity').isVisible().catch(() => false)) {
      await page.click('button:has-text("Sign in")');
    }
    await expect(page.locator('text=Forgot password?')).toBeVisible({ timeout: 10000 });
  });
});
