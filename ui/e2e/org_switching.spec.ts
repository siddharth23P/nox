import { test, expect } from '@playwright/test';
import { Client } from 'pg';

test.describe('Organization Switching & Listing', () => {
  const connectionString = process.env.DATABASE_URL || 'postgres://serpent@localhost:5432/nox?sslmode=disable';

  test('User can list orgs and see org name in sidebar', async ({ page, context }) => {
    // Use a seeded test user that has an org
    await context.addInitScript(() => {
      (window as unknown as { IS_PLAYWRIGHT: boolean }).IS_PLAYWRIGHT = true;
    });

    // Register a fresh user
    const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000000)}`;
    const testEmail = `orgtest-${uniqueId}@example.com`;
    const testPassword = 'Password123!';
    const testUsername = `orgusr_${Math.floor(Math.random() * 1000000000)}`;

    // 1. Register
    await page.goto('/');
    await expect(page.locator('input[placeholder="name@nexus.com"]')).toBeVisible({ timeout: 10000 });

    if (await page.getByText('Welcome Back').isVisible()) {
      await page.click('button:has-text("Sign up")');
    }

    await page.fill('input[placeholder="Elon"]', 'Org Test User');
    await page.fill('input[placeholder="name@nexus.com"]', testEmail);
    await page.fill('input[placeholder="nexus_01"]', testUsername);
    await page.fill('input[placeholder="••••••••"]', testPassword);
    await page.fill('input[placeholder="SpaceX"]', 'My Test Org');

    await page.selectOption('select', { index: 1 });
    await page.fill('input[placeholder="Type your secret answer..."]', 'Test Answer');

    await page.getByRole('button', { name: 'Create Nexus Identity' }).click({ force: true });
    await page.waitForSelector('text=Verification Link Sent', { timeout: 30000 });

    // 2. Verify email via DB
    const client = new Client({ connectionString });
    await client.connect();

    let realToken = null;
    for (let i = 0; i < 15; i++) {
      const res = await client.query('SELECT verification_token FROM users WHERE email = $1', [testEmail]);
      if (res.rows.length > 0 && res.rows[0].verification_token) {
        realToken = res.rows[0].verification_token;
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    expect(realToken).not.toBeNull();

    // Verify via API
    const verifyRes = await page.request.get(`http://localhost:8080/v1/auth/verify?token=${realToken}`);
    expect(verifyRes.ok()).toBeTruthy();

    // 3. Login
    await page.goto('/');
    await expect(page.locator('input[placeholder="name@nexus.com"]')).toBeVisible({ timeout: 10000 });

    if (await page.getByText('Create Nexus Identity').isVisible()) {
      await page.click('button:has-text("Sign in")');
    }

    await page.fill('input[placeholder="name@nexus.com"]', testEmail);
    await page.fill('input[placeholder="••••••••"]', testPassword);
    await page.getByRole('button', { name: 'Enter Nexus' }).click({ force: true });

    // 4. Wait for dashboard and verify org name shows in sidebar
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page.getByTestId('org-switcher-button')).toBeVisible({ timeout: 10000 });

    // The org name should appear in the sidebar (not hardcoded "Nexus Inc")
    await expect(page.getByText('My Test Org')).toBeVisible({ timeout: 10000 });

    // 5. Click org switcher to see dropdown
    await page.getByTestId('org-switcher-button').click();
    await expect(page.getByTestId('org-switcher-dropdown')).toBeVisible({ timeout: 5000 });

    // Should show at least one org
    await expect(page.getByText('Your Organizations')).toBeVisible();
    await expect(page.getByText('My Test Org')).toBeVisible();

    // 6. Verify API directly: GET /v1/orgs returns user's orgs
    const token = await page.evaluate(() => localStorage.getItem('nox_token'));
    const orgsRes = await page.request.get('http://localhost:8080/v1/orgs', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(orgsRes.ok()).toBeTruthy();
    const orgsData = await orgsRes.json();
    expect(orgsData.organizations).toBeDefined();
    expect(orgsData.organizations.length).toBeGreaterThanOrEqual(1);
    expect(orgsData.organizations[0].name).toBe('My Test Org');
    expect(orgsData.organizations[0].role).toBe('owner');

    // Cleanup
    await client.query('DELETE FROM users WHERE email = $1', [testEmail]);
    await client.end();
  });

  test('GET /v1/orgs returns 401 without auth', async ({ page }) => {
    const res = await page.request.get('http://localhost:8080/v1/orgs');
    expect(res.status()).toBe(401);
  });

  test('POST /v1/zk/verify endpoint exists', async ({ page }) => {
    const res = await page.request.post('http://localhost:8080/v1/zk/verify', {
      data: { user_id: 'test', org_id: 'test', proof: 'invalid' },
    });
    // Should get 500 (orchestrator may not be fully set up) or 200, but NOT 404
    expect(res.status()).not.toBe(404);
  });
});
