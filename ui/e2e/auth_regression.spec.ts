import { test, expect } from '@playwright/test';
import { Client } from 'pg';

test.describe('Authentication Regression Suite', () => {
  const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000000)}`;
  const testEmail = `test-${uniqueId}@example.com`;
  const testPassword = 'Password123!';
  const testUsername = `usr_${Math.floor(Math.random() * 1000000000)}`;

  test('E2E Auth Flow: Register -> Verify -> Login -> Logout', async ({ context, page }) => {
    // 1. Navigation & Toggle to Register
    await context.addInitScript(() => {
      (window as unknown as { IS_PLAYWRIGHT: boolean }).IS_PLAYWRIGHT = true;
    });
    await page.goto('/');
    await expect(page.locator('input[placeholder="name@nexus.com"]')).toBeVisible({ timeout: 10000 });
    
    // Switch to Register if currently on Login
    if (await page.getByText('Welcome Back').isVisible()) {
      await page.click('button:has-text("Sign up")'); 
    }

    await page.fill('input[placeholder="Elon"]', 'Test User');
    await page.fill('input[placeholder="name@nexus.com"]', testEmail);
    await page.fill('input[placeholder="nexus_01"]', testUsername);
    await page.fill('input[placeholder="••••••••"]', testPassword);
    await page.fill('input[placeholder="SpaceX"]', 'Test Org');
    
    await page.selectOption('select', { index: 1 });
    await page.fill('input[placeholder="Type your secret answer..."]', 'Test Answer');

    await page.getByRole('button', { name: 'Create Nexus Identity' }).click({ force: true });
    await page.waitForSelector('text=Verification Link Sent', { timeout: 30000 });
    await expect(page.locator('text=Verification Link Sent')).toBeVisible();

    // 2. Real Email Verification via DB
    const connectionString = process.env.DATABASE_URL || 'postgres://serpent@localhost:5432/nox?sslmode=disable';
    const client = new Client({ connectionString });
    await client.connect();
    
    // Polling the database for a few seconds until the token is written
    let realToken = null;
    for (let i = 0; i < 15; i++) {
      const res = await client.query('SELECT verification_token FROM users WHERE email = $1', [testEmail]);
      if (res.rows.length > 0 && res.rows[0].verification_token) {
        realToken = res.rows[0].verification_token;
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    await client.end();
    
    expect(realToken).toBeTruthy();

    await page.goto(`/verify-email?token=${realToken}`); 
    await expect(page.locator('text=Verification Successful')).toBeVisible({ timeout: 10000 });

    // 3. Login
    await page.getByRole('button', { name: 'Continue to Login' }).click();
    
    // We navigate to '/' which shows Register by default, so we wait for form to render then switch to Login
    await expect(page.locator('input[placeholder="name@nexus.com"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Create Nexus Identity|Welcome Back/ })).toBeVisible({ timeout: 10000 });
    
    if (await page.getByRole('heading', { name: 'Create Nexus Identity' }).isVisible()) {
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    }
    
    await page.fill('input[placeholder="name@nexus.com"]', testEmail);
    await page.fill('input[placeholder="••••••••"]', testPassword);
    await page.getByRole('button', { name: 'Enter Nexus' }).click({ force: true });

    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
    
    // Wait for WS
    await page.waitForFunction(() => (window as unknown as { WS_CONNECTED: boolean }).WS_CONNECTED === true, { timeout: 15000 });
    
    // Select channel explicitly to avoid race conditions
    await page.getByRole('button', { name: 'general' }).click();
    
    await expect(page.getByText('general').first()).toBeVisible();

    // 4. Logout
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('Error Handling: Invalid Login Credentials', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[placeholder="name@nexus.com"]')).toBeVisible({ timeout: 10000 });
    
    // Switch to Login if on Register
    if (await page.getByRole('heading', { name: 'Create Nexus Identity' }).isVisible()) {
      await page.click('button:has-text("Sign in")');
    }
    
    await page.fill('input[placeholder="name@nexus.com"]', 'wrong@example.com');
    await page.fill('input[placeholder="••••••••"]', 'wrongpass');
    await page.getByRole('button', { name: 'Enter Nexus' }).click({ force: true });

    await expect(page.locator('text=Invalid email or password').or(page.locator('.text-red-400'))).toBeVisible();
  });

  test('Security: OAuth State Protection Verification', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[placeholder="name@nexus.com"]')).toBeVisible({ timeout: 10000 });
    
    if (await page.getByRole('heading', { name: 'Create Nexus Identity' }).isVisible()) {
      await page.click('button:has-text("Sign in")');
    }
    
    await page.click('button:has-text("Log in with GitHub")');
    
    // The link modifies window.location.href directly, so it's a navigation, not a popup.
    // Handles state= or %26state%3D
    await expect(page).toHaveURL(/.*state(?:%3D|=).*/i, { timeout: 10000 });
  });

  test('Edge Case: Extremely Long Input Strings', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[placeholder="name@nexus.com"]')).toBeVisible({ timeout: 10000 });
    
    if (await page.getByText('Welcome Back').isVisible()) {
      await page.click('button:has-text("Sign up")');
    }
    const longString = 'a'.repeat(300);
    await page.fill('input[placeholder="Elon"]', longString);
    await page.fill('input[placeholder="name@nexus.com"]', `long-${longString}@example.com`);
    await page.fill('input[placeholder="nexus_01"]', testUsername);
    await page.fill('input[placeholder="••••••••"]', testPassword);
    await page.fill('input[placeholder="SpaceX"]', 'Test Org');
    await page.selectOption('select', { index: 1 });
    await page.fill('input[placeholder="Type your secret answer..."]', 'Test Answer');
    
    await page.getByRole('button', { name: 'Create Nexus Identity' }).click({ force: true });
    
    // We expect the app to handle this gracefully (either by showing an error, or truncating and succeeding).
    // The most important thing is that the app doesn't crash and the UI remains responsive.
    // If it threw an unhandled exception, the form would unmount/crash.
    await expect(page.getByRole('heading', { name: 'Create Nexus Identity' }).or(page.locator('text=Verification Link Sent'))).toBeVisible({ timeout: 15000 });
  });
});

