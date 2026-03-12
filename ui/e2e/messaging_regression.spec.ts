import { test, expect } from '@playwright/test';

test.describe('Core Messaging Flow', () => {
  test('Send and receive a basic message', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      localStorage.setItem('nox_token', 'test_jwt_token_msg_reg');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_role', 'admin');
      localStorage.setItem('nox_user', JSON.stringify({
        id: '22222222-2222-2222-2222-222222222222',
        username: 'TestUser',
        email: 'test@example.com'
      }));
    });

    await page.reload();
    await expect(page).toHaveURL(/.*\/dashboard/);

    const messageInput = page.locator('textarea[placeholder="Message #general..."]');
    await expect(messageInput).toBeVisible({ timeout: 15000 });

    const testMessage = `E2E Test Message: ${Date.now()}`;
    await messageInput.fill(testMessage);
    await messageInput.press('Enter');

    const msgElement = page.locator('.flex-1.overflow-y-auto').getByText(testMessage).first();
    await expect(msgElement).toBeVisible({ timeout: 15000 });
  });
});
