import { test, expect } from '@playwright/test';

test.describe('Threaded Conversations Regression', () => {
  
  test.beforeEach(async ({ page }) => {
    // 1. Bypass authentication by setting mock tokens in localStorage
    await page.goto('/');
    
    await page.evaluate(() => {
      localStorage.setItem('nox_token', 'test-jwt-token-bypass');
      localStorage.setItem('nox_user', JSON.stringify({
        id: '22222222-2222-2222-2222-222222222222',
        email: 'test@nox.inc',
        role: 'admin'
      }));
      // Using the exact org ID we inserted in our seed script
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
    });

    // 2. Navigate straight to the dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.locator('main')).toContainText('Team discussion');
  });

  test('E2E Thread Flow: Send Message -> Open Thread -> Reply -> Check Overviews', async ({ page }) => {
    // 1. Send a parent message to guarantee we have something to reply to
    const randomMsg = `Parent message for thread test - ${Date.now()}`;
    await page.getByPlaceholder('Message #general...').fill(randomMsg);
    // Explicitly click send button to avoid keyboard issues
    await page.getByRole('button').filter({ has: page.locator('svg.lucide-send') }).click();

    // Wait for the new message to appear in the list
    const msgElement = page.locator('.flex-1.overflow-y-auto').getByText(randomMsg).first();
    await expect(msgElement).toBeVisible();

    // 2. Hover over the newly created message to reveal the Reply button
    const messageContainer = msgElement.locator('xpath=./ancestor::div[contains(@class, "group")]').first();
    await messageContainer.hover();
    
    // 3. Click the Reply button
    await messageContainer.locator('button:has-text("Reply")').click({ force: true });

    // 4. Verify the ThreadPanel slides in
    const threadPanel = page.locator('h3:has-text("Thread")').locator('..').locator('..');
    await expect(threadPanel).toBeVisible();
    await expect(threadPanel).toContainText(randomMsg); // Verify parent message is in the thread header

    // 5. Send a reply inside the ThreadPanel
    const replyText = `This is a child reply - ${Date.now()}`;
    const threadInput = threadPanel.locator('textarea[placeholder="Reply..."]');
    await threadInput.fill(replyText);
    
    // Click the thread send button
    await threadPanel.locator('button').filter({ has: page.locator('svg.lucide-corner-down-right') }).click();

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
