import { test, expect } from '@playwright/test';
import { loginAndInject, USERS } from './auth-helper';

test.describe('Core Messaging Flow', () => {
  test('Send and receive a basic message', async ({ page }) => {
    await loginAndInject(page, USERS.TestUser, { role: 'admin' });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Explicitly select #general
    await page.getByRole('button', { name: 'general' }).click();

    // Wait for WS
    await page.waitForFunction(() => (window as unknown as { WS_CONNECTED: boolean }).WS_CONNECTED === true, { timeout: 10000 });

    const messageInput = page.locator('textarea[placeholder="Message #general..."]');
    await expect(messageInput).toBeVisible({ timeout: 15000 });

    const testMessage = `E2E Test Message: ${Date.now()}`;
    await messageInput.fill(testMessage);
    await messageInput.press('Enter');

    const msgElement = page.locator('.flex-1.overflow-y-auto').getByText(testMessage).first();
    await expect(msgElement).toBeVisible({ timeout: 15000 });
  });
});
