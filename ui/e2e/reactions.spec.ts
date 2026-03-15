import { test, expect } from '@playwright/test';
import { loginAndInjectContext, USERS } from './auth-helper';

test.describe('Reaction Engine (E2E)', () => {
  const channelName = 'engineering';

  test('Alice sets a reaction, Bob sees it and adds his own, Alice removes hers', async ({ browser }) => {
    // 1. Setup Alice Context
    const aliceContext = await browser.newContext();
    await loginAndInjectContext(aliceContext, USERS.AliceReacts, {
      role: 'member',
      activeChannel: { id: '00000000-0000-0000-0000-000000000002', name: 'engineering' },
    });
    const alicePage = await aliceContext.newPage();
    await alicePage.goto('http://localhost:5173');
    await alicePage.waitForFunction(() => (window as unknown as { WS_CONNECTED?: boolean }).WS_CONNECTED === true, { timeout: 15000 });

    // 2. Setup Bob Context
    const bobContext = await browser.newContext();
    await loginAndInjectContext(bobContext, USERS.BobReacts, {
      role: 'member',
      activeChannel: { id: '00000000-0000-0000-0000-000000000002', name: 'engineering' },
    });
    const bobPage = await bobContext.newPage();
    await bobPage.goto('http://localhost:5173');
    await bobPage.waitForFunction(() => (window as unknown as { WS_CONNECTED?: boolean }).WS_CONNECTED === true, { timeout: 15000 });

    // 3. Alice sends message
    await expect(alicePage.getByText('Nexus Inc')).toBeVisible({ timeout: 15000 });
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
    await expect(bobPage.getByText('Nexus Inc')).toBeVisible({ timeout: 15000 });
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
    await expect(alicePage.locator('.message-item').filter({ hasText: uniqueMessage }).last()).toBeVisible({ timeout: 15000 });

    const aliceReactionBubbleAgain = alicePage.locator('.message-item').filter({ hasText: uniqueMessage }).last().locator('[data-testid="reaction-bubble"][data-emoji="🚀"]');
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
