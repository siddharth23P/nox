import { test, expect } from '@playwright/test';

test.describe('Reaction Engine (E2E)', () => {
  const aliceEmail = 'alice.reactions@example.com';
  const bobEmail = 'bob.reactions@example.com';
  const password = 'Password123!';
  const channelName = 'General';

  test.beforeAll(async ({ request }) => {
    // 1. Setup Auth and Seed Users
    const orgId = '00000000-0000-0000-0000-000000000001'; // Default
    try {
      await request.post('http://localhost:8080/v1/auth/register', {
        data: { email: aliceEmail, username: 'AliceReacts', password, full_name: 'Alice R' },
        headers: { 'X-Org-ID': orgId }
      });
      await request.post('http://localhost:8080/v1/auth/register', {
        data: { email: bobEmail, username: 'BobReacts', password, full_name: 'Bob R' },
        headers: { 'X-Org-ID': orgId }
      });
    } catch {
      // Ignore if they already exist
    }
  });

  test('Alice sets a reaction, Bob sees it and adds his own, Alice removes hers', async ({ browser }) => {
    // Create two contexts
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();

    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    // 1. Alice logs in (Bypassing UI via localStorage)
    const aliceUser = { id: 'a1000000-0000-0000-0000-000000000000', username: 'AliceReacts', email: aliceEmail };
    await alicePage.goto('http://localhost:5173/login');
    await alicePage.evaluate((user) => {
      localStorage.setItem('nox_token', 'mock_jwt_token_alice');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_role', 'member');
      localStorage.setItem('nox_user', JSON.stringify(user));
    }, aliceUser);
    
    // Navigate to the dashboard
    await alicePage.goto('http://localhost:5173');
    await expect(alicePage.getByText('Bifrost')).toBeVisible({ timeout: 10000 });

    // Navigate to General
    await alicePage.click(`text=${channelName}`);
    await expect(alicePage.getByPlaceholder('Type a message...')).toBeVisible();

    // Alice sends a unique message
    const uniqueMessage = `Reaction test message ${Date.now()}`;
    await alicePage.fill('textarea[placeholder="Type a message..."]', uniqueMessage);
    await alicePage.keyboard.press('Enter');
    
    // Wait for message to appear
    const messageLocator = alicePage.locator('div', { hasText: uniqueMessage }).last();
    await expect(messageLocator).toBeVisible();

    // Alice hovers over her message and clicks the reaction picker
    await messageLocator.hover();
    await messageLocator.locator('button[title="Add reaction"]').click();

    // Picker appears, select '🚀'
    await alicePage.locator('button', { hasText: '🚀' }).click();

    // Verify bubble appears with count 1
    const reactionBubble = messageLocator.locator('button', { hasText: '🚀' });
    await expect(reactionBubble).toContainText('1');
    // Verify it's active for Alice (bg-blue-50)
    await expect(reactionBubble).toHaveClass(/bg-blue-50/);

    // --- Switch to Bob ---
    // 2. Bob logs in (Bypassing UI via localStorage)
    const bobUser = { id: 'a2000000-0000-0000-0000-000000000000', username: 'BobReacts', email: bobEmail };
    await bobPage.goto('http://localhost:5173/login');
    await bobPage.evaluate((user) => {
      localStorage.setItem('nox_token', 'mock_jwt_token_bob');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_role', 'member');
      localStorage.setItem('nox_user', JSON.stringify(user));
    }, bobUser);
    
    // Navigate to the dashboard
    await bobPage.goto('http://localhost:5173');
    await expect(bobPage.getByText('Bifrost')).toBeVisible({ timeout: 10000 });

    await bobPage.click(`text=${channelName}`);

    // Bob finds Alice's message (no websocket yet, so might need a forced reload or wait if it was there)
    const bobMessageLocator = bobPage.locator('div', { hasText: uniqueMessage }).last();
    await expect(bobMessageLocator).toBeVisible();

    // Bob should see the existing reaction with count 1, but inactive (bg-gray-50)
    const bobReactionBubble = bobMessageLocator.locator('button', { hasText: '🚀' });
    await expect(bobReactionBubble).toContainText('1');
    await expect(bobReactionBubble).toHaveClass(/bg-gray-50/);

    // Bob clicks the bubble to add his reaction
    await bobReactionBubble.click();

    // Count should turn to 2, and become active for Bob
    await expect(bobReactionBubble).toContainText('2');
    await expect(bobReactionBubble).toHaveClass(/bg-blue-50/);

    // --- Switch back to Alice ---
    // Reload Alice's page to fetch the new counts from Bob (until WebSocket is there)
    await alicePage.reload();
    await expect(alicePage.locator('div', { hasText: uniqueMessage }).last()).toBeVisible();

    const aliceReactionBubbleAgain = alicePage.locator('div', { hasText: uniqueMessage }).last().locator('button', { hasText: '🚀' });
    // Alice sees count 2, active for her
    await expect(aliceReactionBubbleAgain).toContainText('2');
    await expect(aliceReactionBubbleAgain).toHaveClass(/bg-blue-50/);

    // Alice clicks to remove her reaction
    await aliceReactionBubbleAgain.click();

    // Count becomes 1, inactive for Alice
    await expect(aliceReactionBubbleAgain).toContainText('1');
    await expect(aliceReactionBubbleAgain).toHaveClass(/bg-gray-50/);

    // Cleanup contexts
    await aliceContext.close();
    await bobContext.close();
  });
});
