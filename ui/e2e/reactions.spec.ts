import { test, expect } from '@playwright/test';

test.describe('Reaction Engine (E2E)', () => {
  const aliceEmail = 'alice.reactions@example.com';
  const bobEmail = 'bob.reactions@example.com';
  const channelName = 'engineering';

  test('Alice sets a reaction, Bob sees it and adds his own, Alice removes hers', async ({ browser }) => {
    // 1. Setup Alice Context
    const aliceUser = { id: 'a1000000-0000-0000-0000-000000000000', username: 'AliceReacts', email: aliceEmail };
    const aliceContext = await browser.newContext();
    await aliceContext.addInitScript((user) => {
      localStorage.setItem('nox_token', 'mock_jwt_token_alice');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_active_channel', JSON.stringify({
        id: '00000000-0000-0000-0000-000000000002',
        name: 'engineering',
        org_id: '00000000-0000-0000-0000-000000000001'
      }));
      localStorage.setItem('nox_role', 'member');
      localStorage.setItem('nox_user', JSON.stringify(user));
    }, aliceUser);
    const alicePage = await aliceContext.newPage();
    
    // 2. Setup Bob Context
    const bobUser = { id: 'b2000000-0000-0000-0000-000000000000', username: 'BobReacts', email: bobEmail };
    const bobContext = await browser.newContext();
    await bobContext.addInitScript((user) => {
      localStorage.setItem('nox_token', 'mock_jwt_token_bob');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_active_channel', JSON.stringify({
        id: '00000000-0000-0000-0000-000000000002',
        name: 'engineering',
        org_id: '00000000-0000-0000-0000-000000000001'
      }));
      localStorage.setItem('nox_role', 'member');
      localStorage.setItem('nox_user', JSON.stringify(user));
    }, bobUser);
    const bobPage = await bobContext.newPage();
    
    // 3. Alice sends message
    await alicePage.goto('http://localhost:5173');
    await expect(alicePage.getByText('Nexus Inc')).toBeVisible({ timeout: 15000 });
    // Channel name is engineering, but sidebar might be loading. Let it auto-select engineering from LS.
    await expect(alicePage.getByPlaceholder(`Message #engineering...`)).toBeVisible({ timeout: 15000 });
    await expect(alicePage.getByText('Loading messages...')).not.toBeVisible();

    const uniqueMessage = `Reaction test message ${Date.now()}`;
    await alicePage.fill(`textarea[placeholder="Message #${channelName}..."]`, uniqueMessage);
    await alicePage.keyboard.press('Enter');

    const aliceMessageLocator = alicePage.locator('.message-item').filter({ hasText: uniqueMessage }).last();
    await expect(aliceMessageLocator).toBeVisible({ timeout: 15000 });
    await expect(alicePage.getByText('Sending...')).not.toBeVisible();

    // Alice reacts
    await aliceMessageLocator.hover();
    const addReactionBtn = aliceMessageLocator.locator('button[title="Add reaction"]');
    await addReactionBtn.click({ force: true });
    await alicePage.getByTestId('emoji-picker').locator('[data-emoji="🚀"]').click();
    
    const reactionBubble = aliceMessageLocator.locator('[data-testid="reaction-bubble"][data-emoji="🚀"]');
    await expect(reactionBubble).toContainText('1');

    // 4. Bob sees message
    await bobPage.goto('http://localhost:5173');
    await expect(bobPage.getByText('Nexus Inc')).toBeVisible({ timeout: 15000 });
    // Bob should also land on engineering automatically from LS
    await expect(bobPage.getByPlaceholder(`Message #engineering...`)).toBeVisible({ timeout: 15000 });
    await expect(bobPage.getByText('Loading messages...')).not.toBeVisible();

    const bobMessageLocator = bobPage.locator('.message-item').filter({ hasText: uniqueMessage }).first();
    await expect(bobMessageLocator).toBeVisible({ timeout: 30000 });
    console.log('BOB sees the message!');
    await expect(bobMessageLocator).toBeVisible({ timeout: 30000 });

    // Bob should see the existing reaction with count 1, but inactive (bg-gray-50)
    const bobReactionBubble = bobMessageLocator.locator('[data-testid="reaction-bubble"][data-emoji="🚀"]');
    await expect(bobReactionBubble).toContainText('1');
    await expect(bobReactionBubble).toHaveClass(/bg-gray-50/);
    
    // Bob clicks the bubble to add his reaction
    await bobReactionBubble.click();

    // Count should turn to 2, and become active for Bob
    await expect(bobReactionBubble).toContainText('2');
    await expect(bobReactionBubble).toHaveClass(/bg-blue-50/);

    // --- Switch back to Alice ---
    // With WebSockets, the reaction count should update in real-time
    await expect(alicePage.locator('.message-item').filter({ hasText: uniqueMessage }).last()).toBeVisible({ timeout: 15000 });

    const aliceReactionBubbleAgain = alicePage.locator('.message-item').filter({ hasText: uniqueMessage }).last().locator('[data-testid="reaction-bubble"][data-emoji="🚀"]');
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
