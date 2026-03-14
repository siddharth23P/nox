import { test, expect } from '@playwright/test';

test.describe('Enhanced Messaging (E2E)', () => {
  test.beforeEach(async ({ context, page }) => {
    // Add console logging
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));

    await context.addInitScript(() => {
      (window as unknown as { IS_PLAYWRIGHT: boolean }).IS_PLAYWRIGHT = true;
    });

    await page.goto('/');
    
    await page.evaluate(() => {
      localStorage.setItem('nox_token', 'test_jwt_token_enhanced');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_role', 'admin');
      localStorage.setItem('nox_user', JSON.stringify({
        id: '22222222-2222-2222-2222-222222222222',
        username: 'TestUser',
        email: 'test@example.com'
      }));
      // Force active channel in localStorage
      localStorage.setItem('nox_active_channel', JSON.stringify({
        id: '00000000-0000-0000-0000-000000000001',
        org_id: '00000000-0000-0000-0000-000000000001',
        name: 'general',
        description: 'General discussion',
        is_private: false
      }));
    });

    await page.reload();
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Wait for WS
    await page.waitForFunction(() => (window as unknown as { WS_CONNECTED: boolean }).WS_CONNECTED === true, { timeout: 10000 });
  });

  test('Issue #23: Code Support rendering with syntax highlighting', async ({ page }) => {
    const messageInput = page.locator('textarea[placeholder^="Message #"]');
    await expect(messageInput).toBeVisible();

    const codeMessage = 'Check this out:\n```javascript\nconst x = 42;\n```';
    await messageInput.fill(codeMessage);
    await messageInput.press('Enter');

    // Verify code block is rendered
    const codeBlock = page.locator('[data-testid="message-content"] code.language-javascript').last();
    await expect(codeBlock).toBeVisible({ timeout: 15000 });
    await expect(codeBlock).toContainText('const x = 42;');

    // Verify hljs class exists (proof of highlight.js working)
    await expect(codeBlock).toHaveClass(/hljs/);
    
    // Verify copy button presence
    const copyBtn = page.locator('button[title="Copy code"]').last();
    await expect(copyBtn).toBeVisible({ timeout: 15000 });
  });

  test('Issue #24: Smart Outbox ephemeral message expiration', async ({ page }) => {
    const messageInput = page.locator('textarea[placeholder^="Message #"]');
    await expect(messageInput).toBeVisible();

    // Set TTL to 10s
    await page.locator('button[title="Self-destruct timer"]').click();
    await page.getByRole('button', { name: '10s' }).click();

    const ephemeralMessage = `This message will self-destruct in 10s: ${Date.now()}`;
    await messageInput.fill(ephemeralMessage);
    await messageInput.press('Enter');

    // Verify message is visible initially
    await page.screenshot({ path: 'test-results/smart-outbox-debug.png' });
    const msgElement = page.locator('[data-testid="message-content"]').getByText(ephemeralMessage).last();
    await expect(msgElement).toBeVisible({ timeout: 20000 });

    // Verify vanishing indicator
    await expect(page.getByText(/Vanishing in/).last()).toBeVisible({ timeout: 10000 });

    // Wait for 12 seconds
    await page.waitForTimeout(12000);

    // Verify message is gone
    await expect(msgElement).not.toBeVisible();
  });

  test('Message Navigation: Pinned message auto-scroll', async ({ page }) => {
    // 1. Send a message
    const messageInput = page.locator('textarea[placeholder^="Message #"]');
    const msgContent = `Pin this message ${Date.now()}`;
    await messageInput.fill(msgContent);
    await messageInput.press('Enter');

    // 2. Pin it
    const msgElement = page.locator('[data-testid="message-item"]').last();
    await msgElement.hover();
    await page.locator('button[title="Pin to channel"]').last().click();

    // 3. Send many more messages to push it up
    for (let i = 0; i < 20; i++) {
      await messageInput.fill(`Filler message ${i}`);
      await messageInput.press('Enter');
    }

    // 4. Open Pin Manager and click the pin
    await page.locator('button:has-text("Saved Items")').click();
    const pinManager = page.locator('[data-testid="pin-manager"]');
    await expect(pinManager).toBeVisible();

    const pinItem = pinManager.locator('div.group\\/pin').filter({ hasText: msgContent });
    await pinItem.click();

    // 5. Verify the pinned message is in view (visible)
    const pinnedMsg = page.locator(`[data-message-id]`).filter({ hasText: msgContent }).first();
    
    // Increased wait for smooth scroll and animations
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/navigation-debug.png' });
    
    // Check if it's visible, and at least some part is in viewport
    await expect(pinnedMsg).toBeVisible();
    await expect(pinnedMsg).toBeInViewport({ ratio: 0.1, timeout: 15000 });
  });
});
