import { test, expect } from '@playwright/test';
import { loginAndInjectContext, USERS } from './auth-helper';

test.describe('Contextual Reply (Quoting)', () => {
  test('Alice quotes Bob and Bob jumps to the original message', async ({ browser }) => {
    // 1. Setup Alice Context
    const aliceUser = USERS.AliceQuote;
    const aliceContext = await browser.newContext();
    await loginAndInjectContext(aliceContext, aliceUser);
    const alicePage = await aliceContext.newPage();
    await alicePage.goto('http://localhost:5173');
    await alicePage.waitForFunction(() => (window as unknown as { WS_CONNECTED?: boolean }).WS_CONNECTED === true, { timeout: 30000 });

    // 2. Setup Bob Context
    const bobUser = USERS.BobQuote;
    const bobContext = await browser.newContext();
    await loginAndInjectContext(bobContext, bobUser);
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
