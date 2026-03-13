import { test, expect } from '@playwright/test';

test.describe('Contextual Reply (Quoting)', () => {
  test('Alice quotes Bob and Bob jumps to the original message', async ({ browser }) => {
    // 1. Setup Alice Context
    const aliceUser = { id: 'a1000000-0000-0000-0000-000000000000', username: 'AliceQuote', email: 'alice.quote@example.com' };
    const aliceContext = await browser.newContext();
    await aliceContext.addInitScript((user) => {
      (window as unknown as { IS_PLAYWRIGHT?: boolean }).IS_PLAYWRIGHT = true;
      localStorage.setItem('nox_token', 'mock_jwt_token_alice');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_active_channel', JSON.stringify({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'general',
        org_id: '00000000-0000-0000-0000-000000000001'
      }));
      localStorage.setItem('nox_role', 'member');
      localStorage.setItem('nox_user', JSON.stringify(user));
    }, aliceUser);
    const alicePage = await aliceContext.newPage();
    await alicePage.goto('http://localhost:5173');
    await alicePage.waitForFunction(() => (window as unknown as { WS_CONNECTED?: boolean }).WS_CONNECTED === true, { timeout: 30000 });
    
    // 2. Setup Bob Context
    const bobUser = { id: 'b2000000-0000-0000-0000-000000000000', username: 'BobQuote', email: 'bob.quote@example.com' };
    const bobContext = await browser.newContext();
    await bobContext.addInitScript((user) => {
      (window as unknown as { IS_PLAYWRIGHT?: boolean }).IS_PLAYWRIGHT = true;
      localStorage.setItem('nox_token', 'mock_jwt_token_bob');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_active_channel', JSON.stringify({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'general',
        org_id: '00000000-0000-0000-0000-000000000001'
      }));
      localStorage.setItem('nox_role', 'member');
      localStorage.setItem('nox_user', JSON.stringify(user));
    }, bobUser);
    const bobPage = await bobContext.newPage();
    await bobPage.goto('http://localhost:5173');
    await bobPage.waitForFunction(() => (window as unknown as { WS_CONNECTED?: boolean }).WS_CONNECTED === true, { timeout: 30000 });

    // 3. Bob sends a message
    const bobOriginalMessage = `Message from Bob ${Date.now()}`;
    await bobPage.fill('textarea[placeholder*="Message"]', bobOriginalMessage);
    await bobPage.press('textarea[placeholder*="Message"]', 'Enter');
    
    // 4. Alice sees Bob's message and quotes it
    const bobMsgLocator = alicePage.locator(`[data-user-id="${bobUser.id}"].message-item:has-text("${bobOriginalMessage}")`);
    await bobMsgLocator.scrollIntoViewIfNeeded();
    await bobMsgLocator.hover();
    
    // Click Quote button
    const quoteBtn = bobMsgLocator.locator('button[title="Quote"]');
    await quoteBtn.waitFor({ state: 'visible', timeout: 10000 });
    await quoteBtn.click();
    
    // 5. Alice sees ReplyPreview
    const replyPreview = alicePage.locator('.glass-effect:has-text("Replying to BobQuote")');
    await expect(replyPreview).toBeVisible({ timeout: 15000 });
    await expect(replyPreview).toContainText(bobOriginalMessage);
    
    // 6. Alice sends the reply
    const aliceReplyMessage = `Alice replying to Bob ${Date.now()}`;
    await alicePage.fill('textarea[placeholder*="Message"]', aliceReplyMessage);
    await alicePage.press('textarea[placeholder*="Message"]', 'Enter');
    
    // 7. Bob sees Alice's reply with the quote
    const aliceMsgLocator = bobPage.locator(`[data-user-id="${aliceUser.id}"].message-item:has-text("${aliceReplyMessage}")`);
    await expect(aliceMsgLocator).toBeVisible({ timeout: 15000 });
    await expect(aliceMsgLocator.locator('.border-l-2')).toContainText(bobOriginalMessage);
    
    // 8. Bob clicks the quote and it jumps to his original message
    await aliceMsgLocator.locator('.cursor-pointer').click();
    
    // Check if original message is in view (approximated by checking if it exists and has highlight class)
    // Actually, our code adds 'highlight-message' class
    const bobMsgInBobView = bobPage.locator(`[data-user-id="${bobUser.id}"].message-item:has-text("${bobOriginalMessage}")`);
    await expect(bobMsgInBobView).toHaveClass(/highlight-message/);

    // Cleanup contexts
    await aliceContext.close();
    await bobContext.close();
  });
});
