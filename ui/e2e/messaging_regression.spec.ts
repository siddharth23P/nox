import { test, expect } from '@playwright/test';

test.describe('Core Messaging Flow', () => {
  test('Send and receive a basic message', async ({ page }) => {
    // Navigate to root
    await page.goto('/');
    
    // Inject auth state into localStorage to bypass login
    await page.evaluate(() => {
      localStorage.setItem('nox_token', 'fake-jwt-token');
      localStorage.setItem('nox_org_id', 'test-org-123');
      localStorage.setItem('nox_role', 'admin');
    });

    // Reload the page to trigger state re-evaluation
    await page.reload();

    // Verify it automatically redirects to /dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });

    const messageInput = page.locator('textarea[placeholder="Message #general..."]');
    await expect(messageInput).toBeVisible();

    const testMessage = `E2E Test Message: ${Date.now()}`;
    await messageInput.fill(testMessage);

    // Send the message
    await messageInput.press('Enter');

    // Verify it appears in the MessageList
    const messageContainer = page.locator('.custom-scrollbar');
    await expect(messageContainer.getByText(testMessage)).toBeVisible({ timeout: 10000 });
  });
});
