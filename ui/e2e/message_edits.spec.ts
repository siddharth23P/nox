import { test, expect } from '@playwright/test';
import { loginAndInjectContext, USERS } from './auth-helper';

test.describe('Message Lifecycle (Audit-Trailed Edits)', () => {

  test('Alice can edit a message, see (edited) badge, and view edit history. Bob can see history but not edit.', async ({ browser }) => {
    test.setTimeout(45000);

    // 1. Setup Alice's Context
    const aliceContext = await browser.newContext();
    await loginAndInjectContext(aliceContext, USERS.AliceReacts);
    const alicePage = await aliceContext.newPage();
    await alicePage.goto('http://localhost:5173');

    // Explicitly select #general and wait for WS
    await alicePage.getByRole('button', { name: 'general' }).click();
    await alicePage.waitForFunction(() => (window as unknown as { WS_CONNECTED: boolean }).WS_CONNECTED === true, { timeout: 10000 });

    // Wait for messages to load
    await expect(alicePage.getByPlaceholder('Message #general...')).toBeVisible({ timeout: 15000 });

    // Send a new message so we can edit it reliably
    const uniqueId = Date.now().toString().slice(-4);
    const aliceMsgText = `Hey team, this is a test message ${uniqueId}`;
    const messageInput = alicePage.getByPlaceholder('Message #general...');
    await messageInput.fill(aliceMsgText);
    await messageInput.press('Enter');

    // Wait for it to appear
    const aliceMsg = alicePage.locator(`text="${aliceMsgText}"`).first();
    await expect(aliceMsg).toBeVisible();

    const aliceWrapper = aliceMsg.locator('xpath=./ancestor::div[contains(@class, "group relative")]').first();
    await aliceWrapper.hover();

    // Click the Edit button
    const editBtn = aliceWrapper.getByTitle('Edit message');
    await editBtn.click({ force: true });

    // The textarea should appear
    const textarea = alicePage.locator('textarea[aria-label="Edit message"]');
    await expect(textarea).toBeVisible();

    // Type new content and save
    const newContent = `Hey team, updated message ${uniqueId}`;
    await textarea.fill(newContent);
    await alicePage.getByRole('button', { name: 'Save', exact: true }).click();

    // The message should update and have an (edited) badge

    // The message should update and have an (edited) badge
    const newMsgLocator = alicePage.locator(`text="${newContent}"`).first();
    await expect(newMsgLocator).toBeVisible();

    // Original message should be gone from the main DOM
    await expect(alicePage.locator(`text="${aliceMsgText}"`).first()).not.toBeVisible();

    // Focus on the newly updated wrapper
    const updatedAliceWrapper = newMsgLocator.locator('xpath=./ancestor::div[contains(@class, "group relative")]').first();

    // Click on (edited) to open history
    const editedBadge = updatedAliceWrapper.getByRole('button', { name: '(edited)' });
    await expect(editedBadge).toBeVisible();
    await editedBadge.click();

    // Modal should appear
    const modal = alicePage.locator('text="Edit History"').first();
    await expect(modal).toBeVisible();

    // Modal should contain original content
    const oldContentNode = alicePage.locator(`text="${aliceMsgText}"`).first();
    await expect(oldContentNode).toBeVisible();

    // Close modal
    await alicePage.getByRole('button', { name: 'Close' }).click();
    await expect(modal).not.toBeVisible();

    // Verify Bob's perspective
    const bobContext = await browser.newContext();
    await loginAndInjectContext(bobContext, USERS.BobReacts);
    const bobPage = await bobContext.newPage();
    await bobPage.goto('http://localhost:5173');

    // Explicitly select #general and wait for WS
    await bobPage.getByRole('button', { name: 'general' }).click();
    await bobPage.waitForFunction(() => (window as unknown as { WS_CONNECTED: boolean }).WS_CONNECTED === true, { timeout: 10000 });

    await expect(bobPage.getByPlaceholder('Message #general...')).toBeVisible({ timeout: 15000 });

    // Bob should see the edited message and badge
    const bobsViewOfMsg = bobPage.locator(`text="${newContent}"`).first();
    await expect(bobsViewOfMsg).toBeVisible();
    const bobWrapperView = bobsViewOfMsg.locator('xpath=./ancestor::div[contains(@class, "group relative")]').first();

    // Bob should NOT be able to hover and edit it
    await bobWrapperView.hover();
    await expect(bobWrapperView.getByTitle('Edit message')).not.toBeVisible();

    // Bob CAN click (edited) and see history
    const bobBadge = bobWrapperView.getByRole('button', { name: '(edited)' });
    await expect(bobBadge).toBeVisible();
    await bobBadge.click();
    await expect(bobPage.locator(`text="${aliceMsgText}"`).first()).toBeVisible();

    await aliceContext.close();
    await bobContext.close();
  });
});
