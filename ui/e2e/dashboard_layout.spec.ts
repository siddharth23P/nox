import { test, expect } from '@playwright/test';
import { loginAndInject, USERS } from './auth-helper';

test.describe('Dashboard Layout & Sidebar', () => {
  test('Bypass Auth and Verify Dashboard Layout', async ({ page }) => {
    await loginAndInject(page, USERS.AliceReads, { role: 'admin' });

    await page.goto('/');

    // Verify it automatically redirects to /dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });

    // Wait for WebSocket
    await page.waitForFunction(() => (window as unknown as { WS_CONNECTED: boolean }).WS_CONNECTED === true, { timeout: 15000 });

    // Verify Sidebar contents
    const sidebar = page.locator('.w-64');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('Nexus Inc');
    await expect(sidebar).toContainText('Channels');
    await expect(sidebar).toContainText('Direct Messages');
    await expect(sidebar).toContainText('general');
    await expect(sidebar).toContainText('AliceReacts');
    await expect(sidebar).toContainText('Log out');

    // Verify Main Dashboard View
    const mainContent = page.locator('main');
    await expect(mainContent).toContainText('Team discussion');
    // Select #general channel explicitly
    await sidebar.getByRole('button', { name: 'general' }).click();
    await expect(page.getByPlaceholder('Message #general...')).toBeVisible();

    // Verify Logout functionality
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).not.toHaveURL(/.*\/dashboard/);
    await expect(page.locator('input[placeholder="name@nexus.com"]')).toBeVisible();
  });
});
