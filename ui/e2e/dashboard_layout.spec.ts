import { test, expect } from '@playwright/test';

test.describe('Dashboard Layout & Sidebar', () => {
  test('Bypass Auth and Verify Dashboard Layout', async ({ context, page }) => {
    // Navigate to root
    await page.goto('/');
    
    // Inject auth state into localStorage to bypass login
    await context.addInitScript(() => {
      (window as unknown as { IS_PLAYWRIGHT: boolean }).IS_PLAYWRIGHT = true;
    });

    await page.evaluate(() => {
      localStorage.setItem('nox_token', 'fake-jwt-token');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_role', 'admin');
      localStorage.setItem('nox_user', JSON.stringify({ id: 'a1111111-1111-1111-1111-111111111111', username: 'AliceReads' }));
    });

    // Reload the page to trigger state re-evaluation
    await page.reload();

    // Verify it automatically redirects to /dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });

    // Wait for WebSocket
    await page.waitForFunction(() => (window as unknown as { WS_CONNECTED: boolean }).WS_CONNECTED === true, { timeout: 15000 });

    // Verify Sidebar contents
    const sidebar = page.locator('.w-64');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('Nox Workspace');
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
