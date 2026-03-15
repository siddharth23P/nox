import { test, expect } from '@playwright/test';
import { loginAndInject, USERS } from './auth-helper';

test.describe('Core Messaging CRUD (Issue #4)', () => {

  test.beforeEach(async ({ page }) => {
    await loginAndInject(page, USERS.AliceReads, { role: 'admin' });

    await page.goto('/');
    await page.waitForFunction(() => (window as unknown as { WS_CONNECTED?: boolean }).WS_CONNECTED === true, { timeout: 20000 });
    await expect(page.getByText('Nexus Inc')).toBeVisible({ timeout: 15000 });
  });

  test('User can send a message with markdown and it renders as HTML', async ({ page }) => {
    // Select general channel
    await page.getByRole('button', { name: 'general' }).click();
    await expect(page.getByPlaceholder('Message #general...')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Loading messages...')).not.toBeVisible();

    // Send a markdown message
    const mdMessage = `**bold test** _italic_ ${Date.now()}`;
    await page.fill('textarea[placeholder="Message #general..."]', mdMessage);
    await page.keyboard.press('Enter');

    // Wait for message to appear
    const msgLocator = page.locator('.message-item').filter({ hasText: 'bold test' }).last();
    await expect(msgLocator).toBeVisible({ timeout: 15000 });

    // Verify markdown was rendered (bold should be in <strong> tag)
    const htmlContent = await msgLocator.locator('[data-testid="message-content"]').innerHTML();
    expect(htmlContent).toContain('<strong>');
    expect(htmlContent).toContain('<em>');
  });

  test('User can delete their own message', async ({ page }) => {
    // Select general channel
    await page.getByRole('button', { name: 'general' }).click();
    await expect(page.getByPlaceholder('Message #general...')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Loading messages...')).not.toBeVisible();

    // Send a unique message
    const uniqueText = `delete-test-${Date.now()}`;
    await page.fill('textarea[placeholder="Message #general..."]', uniqueText);
    await page.keyboard.press('Enter');

    // Wait for it to appear
    const msgLocator = page.locator('.message-item').filter({ hasText: uniqueText }).last();
    await expect(msgLocator).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Sending...')).not.toBeVisible();

    // Hover to show delete button and click it
    await msgLocator.hover();
    const deleteBtn = msgLocator.locator('button[title="Delete message"]');
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click({ force: true });

    // Message should disappear
    await expect(msgLocator).not.toBeVisible({ timeout: 10000 });
  });

  test('DELETE /v1/channels/:id/messages/:messageId returns 401 without auth', async ({ page }) => {
    const res = await page.request.delete('http://localhost:8080/v1/channels/00000000-0000-0000-0000-000000000001/messages/00000000-0000-0000-0000-000000000001');
    expect(res.status()).toBe(401);
  });

  test('XSS payload is sanitized in message content', async ({ page }) => {
    // Select general channel
    await page.getByRole('button', { name: 'general' }).click();
    await expect(page.getByPlaceholder('Message #general...')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Loading messages...')).not.toBeVisible();

    // Send an XSS payload via markdown
    const xssPayload = `<img src=x onerror=alert(1)> safe-text-${Date.now()}`;
    await page.fill('textarea[placeholder="Message #general..."]', xssPayload);
    await page.keyboard.press('Enter');

    // Wait for message to appear (the safe text part)
    const safeTextMatch = xssPayload.match(/safe-text-\d+/);
    const msgLocator = page.locator('.message-item').filter({ hasText: safeTextMatch![0] }).last();
    await expect(msgLocator).toBeVisible({ timeout: 15000 });

    // Verify the onerror attribute was stripped
    const htmlContent = await msgLocator.innerHTML();
    expect(htmlContent).not.toContain('onerror');
  });
});
