import { test, expect } from '@playwright/test';
import { waitForElementStable } from './utils';

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
    await waitForElementStable(page, 'textarea[placeholder="Message #general..."]');

    const testMessage = `E2E Test Message: ${Date.now()}`;
    await messageInput.fill(testMessage);
    
    // Send the message and allow processing time
    await messageInput.press('Enter');
    await waitForElementStable(page, `text=${testMessage}`);

    // Verify it appears in the MessageList
    // Verify it appears in the MessageList with stable wait
    await waitForElementStable(page, `.flex-1.overflow-y-auto >> text=${testMessage}`, 60000);
    const msgElement = page.locator('.flex-1.overflow-y-auto').getByText(testMessage).first();
    await expect(msgElement).toBeVisible({ timeout: 10000 });
  });
});
