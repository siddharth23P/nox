import { test, expect } from '@playwright/test';
import { loginAndInject, USERS } from './auth-helper';

test.describe('Threaded Conversations Regression', () => {

  test.beforeEach(async ({ page }) => {
    await loginAndInject(page, USERS.TestUser, { role: 'admin' });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Explicitly select #general to ensure we are in the right state
    await page.getByRole('button', { name: 'general' }).click();
    await expect(page.locator('main')).toContainText('Team discussion');

    // Wait for WS to be ready
    await page.waitForFunction(() => (window as unknown as { WS_CONNECTED: boolean }).WS_CONNECTED === true, { timeout: 10000 });
    await expect(page.getByPlaceholder('Message #general...')).toBeVisible();
  });

  test('E2E Thread Flow: Send Message -> Open Thread -> Reply -> Check Overviews', async ({ page }) => {
    // 1. Send a parent message to guarantee we have something to reply to
    const randomMsg = `Parent message for thread test - ${Date.now()}`;
    const messageInput = page.getByPlaceholder('Message #general...');
    await messageInput.fill(randomMsg);
    // Send the message by pressing Enter
    await messageInput.press('Enter');

    // Wait for the new message to appear in the list
    const msgElement = page.locator('.flex-1.overflow-y-auto').getByText(randomMsg).first();
    await expect(msgElement).toBeVisible();

    // 2. Hover over the newly created message to reveal the Reply button
    const messageContainer = msgElement.locator('xpath=./ancestor::div[contains(@class, "group")]').first();
    await messageContainer.hover();

    // 3. Click the Reply button
    await messageContainer.locator('button:has-text("Reply")').click({ force: true });

    // 4. Verify the ThreadPanel slides in
    const threadPanel = page.getByTestId('thread-panel');
    await expect(threadPanel).toBeVisible();
    await expect(threadPanel).toContainText(randomMsg); // Verify parent message is in the thread header

    // 5. Send a reply inside the ThreadPanel
    const replyText = `This is a child reply - ${Date.now()}`;
    const threadInput = page.getByTestId('thread-reply-input');
    await threadInput.fill(replyText);

    // Submit the reply via Enter key
    await threadInput.press('Enter');

    // 6. Verify the reply appears in the ThreadPanel
    await expect(threadPanel).toContainText(replyText);

    // 7. Verify the main message list updates with the new Reply Count
    await expect(messageContainer).toContainText('1 reply');

    // 8. Close the ThreadPanel
    // The close button is the X icon inside the ThreadPanel header
    await threadPanel.locator('button').filter({ has: page.locator('svg.lucide-x') }).click();
    await expect(threadPanel).not.toBeVisible();
  });
});
