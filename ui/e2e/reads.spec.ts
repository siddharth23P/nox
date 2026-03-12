import { test, expect } from '@playwright/test';
import { waitForElementStable } from './utils';

test.describe('Read Receipts (E2E) - Issue #19', () => {
  const aliceEmail = 'alice.reads@example.com';
  const bobEmail = 'bob.reads@example.com';
  const password = 'Password123!';
  const channelName = 'general';



  test('Alice sends a message, Bob views it, Alice sees the read receipt', async ({ browser }) => {
    // Create two contexts
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();

    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    // 1. Alice logs in
    const aliceUser = { id: 'a1111111-1111-1111-1111-111111111111', username: 'AliceReads', email: aliceEmail };
    await alicePage.goto('http://localhost:5173/login');
    await alicePage.evaluate((user) => {
      localStorage.setItem('nox_token', 'test-jwt-token-reads-alice');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_role', 'member');
      localStorage.setItem('nox_user', JSON.stringify(user));
    }, aliceUser);
    
    // Navigate to the dashboard
    await alicePage.goto('http://localhost:5173');
    await expect(alicePage.getByText('Nexus Inc')).toBeVisible({ timeout: 10000 });

    // Navigate to General
    await alicePage.click(`text=${channelName}`);
    await expect(alicePage.getByPlaceholder('Message #general...')).toBeVisible();

    // Alice sends a unique message
    const uniqueMessage = `Read receipt test message ${Date.now()}`;
    await alicePage.fill('textarea[placeholder="Message #general..."]', uniqueMessage);
    await alicePage.keyboard.press('Enter');
    
    // Wait for message to appear
    const messageLocator = alicePage.locator('div', { hasText: uniqueMessage }).last();
    await expect(messageLocator).toBeVisible();

    // --- Switch to Bob ---
    // 2. Bob logs in
    const bobUser = { id: 'b2222222-2222-2222-2222-222222222222', username: 'BobReads', email: bobEmail };
    await bobPage.goto('http://localhost:5173/login');
    await bobPage.evaluate((user) => {
      localStorage.setItem('nox_token', 'test-jwt-token-reads-bob');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_role', 'member');
      localStorage.setItem('nox_user', JSON.stringify(user));
    }, bobUser);
    
    // Navigate to the dashboard & General channel
    await bobPage.goto('http://localhost:5173');
    await expect(bobPage.getByText('Nexus Inc')).toBeVisible({ timeout: 10000 });
    await bobPage.click(`text=${channelName}`);

    // Bob finds Alice's message, IntersectionObserver should mark it as read
    const bobMessageLocator = bobPage.locator('div', { hasText: uniqueMessage }).last();
    await expect(bobMessageLocator).toBeVisible();

    // Wait for Bob's read receipt to be visible via WebSocket
    // --- Switch back to Alice ---
    // With WebSockets, the read receipt should appear in real-time without reloading
    await expect(alicePage.locator('div', { hasText: uniqueMessage }).last()).toBeVisible();

    // Verify Bob's presence avatar appears in the read receipts summary
    // Our PresenceAvatar uses `title="Read by User"` as a fallback since we dropped looking up the name from presence store.
    const readReceiptIndicator = alicePage.locator('div', { hasText: uniqueMessage }).last().locator('div[title="Read by User"]');
    // Wait for read receipt indicator to become visible with extended timeout
    await waitForElementStable(alicePage, `div:has-text("${uniqueMessage}") >> div[title="Read by User"]`, 60000);

    // Cleanup contexts
    await aliceContext.close();
    await bobContext.close();
  });
});
