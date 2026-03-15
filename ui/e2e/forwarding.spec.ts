import { test, expect } from '@playwright/test';
import { loginAndInjectContext, USERS } from './auth-helper';

test.describe('Message Forwarding (Chain Attribution)', () => {

  test('Alice can forward a message from #general to #engineering', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAndInjectContext(context, USERS.AliceReacts);

    const page = await context.newPage();
    await page.goto('http://localhost:5173');

    // Wait for App to initialize and WS to connect
    await page.waitForFunction(() => (window as unknown as { WS_CONNECTED: boolean }).WS_CONNECTED === true, { timeout: 20000 });

    // 1. Verify dashboard basic elements
    await expect(page.getByText('Nexus Inc')).toBeVisible({ timeout: 15000 });
    // Use first() to avoid ambiguity if multiple "general" texts exist
    await expect(page.getByText('general').first()).toBeVisible({ timeout: 15000 });

    // 2. Clear messages if any (optional, but good for clean test)
    await expect(page.getByText('Loading messages...')).not.toBeVisible();

    // 3. Send a message in #general
    const messageInput = page.locator('textarea[placeholder*="general"]');
    const uniqueMessage = `Forward this message ${Date.now()}`;
    await messageInput.fill(uniqueMessage);
    await messageInput.press('Enter');

    // 4. Hover over the message and click forward
    const messageItem = page.locator('.message-item').filter({ hasText: uniqueMessage }).last();
    await expect(messageItem).toBeVisible({ timeout: 15000 });
    await messageItem.hover();

    const forwardBtn = messageItem.locator('button[title="Forward message"]');
    await forwardBtn.click();

    // 5. Select #engineering in the modal
    const modal = page.locator('div.max-w-md').last();
    await expect(modal).toBeVisible();

    const engineeringBtn = modal.getByRole('button', { name: 'engineering' });
    await expect(engineeringBtn).toBeVisible({ timeout: 15000 });
    await engineeringBtn.click();

    const forwardSubmitBtn = modal.getByRole('button', { name: 'Forward', exact: true });
    await expect(forwardSubmitBtn).toBeEnabled();
    await forwardSubmitBtn.click();

    // 6. Verify the modal closes
    await expect(page.getByText('Forward Message')).not.toBeVisible();

    // 7. Switch to engineering channel
    await page.getByRole('button', { name: 'engineering' }).click();

    // 8. Verify the message is there with "Forwarded from AliceReacts" metadata
    const messageLocator = page.locator('.group.relative').filter({ hasText: uniqueMessage });
    await expect(messageLocator).toBeVisible({ timeout: 15000 });
    await expect(messageLocator).toContainText('Forwarded from AliceReacts');

    await context.close();
  });
});
