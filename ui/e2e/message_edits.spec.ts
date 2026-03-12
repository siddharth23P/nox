import { test, expect } from '@playwright/test';

test.describe('Message Lifecycle (Audit-Trailed Edits)', () => {

  test('Alice can edit a message, see (edited) badge, and view edit history. Bob can see history but not edit.', async ({ browser }) => {
    test.setTimeout(45000);
    
    // 1. Setup Alice's Context
    const aliceContext = await browser.newContext();
    await aliceContext.addInitScript(() => {
      (window as unknown as { IS_PLAYWRIGHT?: boolean }).IS_PLAYWRIGHT = true;
    });
    const alicePage = await aliceContext.newPage();
    
    // Login as Alice
    await alicePage.goto('http://localhost:5173/login');
    await alicePage.evaluate(() => {
      localStorage.setItem('nox_token', 'test_jwt_token');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_role', 'member');
      localStorage.setItem('nox_user', JSON.stringify({
        id: 'a1000000-0000-0000-0000-000000000000',
        email: 'alice@nox.inc',
        username: 'alice'
      }));
    });
    await alicePage.goto('http://localhost:5173');

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
    
    const aliceWrapper = aliceMsg.locator('xpath=./ancestor::div[contains(@class, "flex-row-reverse")]').first();
    await aliceWrapper.hover();

    // Click the Edit button
    const editBtn = aliceWrapper.getByTitle('Edit message');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

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
    const updatedAliceWrapper = newMsgLocator.locator('xpath=./ancestor::div[contains(@class, "flex-row-reverse")]').first();

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
    await bobContext.addInitScript(() => {
      (window as unknown as { IS_PLAYWRIGHT?: boolean }).IS_PLAYWRIGHT = true;
    });
    const bobPage = await bobContext.newPage();
    
    await bobPage.goto('http://localhost:5173/login');
    await bobPage.evaluate(() => {
      localStorage.setItem('nox_token', 'test_jwt_token_2');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_role', 'member');
      localStorage.setItem('nox_user', JSON.stringify({
        id: 'b2000000-0000-0000-0000-000000000000',
        email: 'bob@nox.inc',
        username: 'bob'
      }));
    });
    await bobPage.goto('http://localhost:5173');
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
