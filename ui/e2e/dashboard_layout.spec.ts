import { test, expect } from '@playwright/test';

test.describe('Dashboard Layout & Sidebar', () => {
  test('Bypass Auth and Verify Dashboard Layout', async ({ page }) => {
    // Navigate to root
    await page.goto('/');
    
    // Inject auth state into localStorage to bypass login
    await page.evaluate(() => {
      localStorage.setItem('nox_token', 'fake-jwt-token');
      localStorage.setItem('nox_org_id', 'test-org');
      localStorage.setItem('nox_role', 'admin');
    });

    // Reload the page to trigger state re-evaluation
    await page.reload();

    // Verify it automatically redirects to /dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });

    // Verify Sidebar contents
    const sidebar = page.locator('.w-64');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('Nexus Inc');
    await expect(sidebar).toContainText('Channels');
    await expect(sidebar).toContainText('Direct Messages');
    await expect(sidebar).toContainText('general');
    await expect(sidebar).toContainText('Alice Chen');
    await expect(sidebar).toContainText('Log out');

    // Verify Main Dashboard View
    const mainContent = page.locator('main');
    await expect(mainContent).toContainText('Welcome to #general');
    await expect(page.getByText('Message #general...')).toBeVisible();

    // Verify Logout functionality
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).not.toHaveURL(/.*\/dashboard/);
    await expect(page.locator('input[placeholder="name@nexus.com"]')).toBeVisible();
  });
});
