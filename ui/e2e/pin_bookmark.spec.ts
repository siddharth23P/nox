import { test, expect } from '@playwright/test';
import { waitForElementStable } from './utils';
import { loginAndInjectContext, USERS } from './auth-helper';

test.describe('Pinning and Bookmarking Engine (E2E)', () => {

  test('Alice sets a pin, Bob sees it globally. Bob bookmarks it privately.', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    await loginAndInjectContext(aliceContext, USERS.TestUser);
    const alicePage = await aliceContext.newPage();
    await alicePage.goto('http://localhost:5173/dashboard');
    await alicePage.waitForFunction(() => (window as unknown as { WS_CONNECTED?: boolean }).WS_CONNECTED === true, { timeout: 20000 });

    // Send a message
    const uniqueMessage = `This is a highly important pin target ${Date.now()}`;
    await alicePage.waitForSelector('textarea[placeholder="Message #general..."]');
    await alicePage.fill('textarea[placeholder="Message #general..."]', uniqueMessage);
    await alicePage.press('textarea[placeholder="Message #general..."]', 'Enter');
    await waitForElementStable(alicePage, `text=${uniqueMessage}`);

    // Find message and hover to click pin
    const messageLocator = alicePage.locator(`text=${uniqueMessage}`).locator('xpath=./ancestor::div[contains(@class, "group relative")]');
    await waitForElementStable(alicePage, `text=${uniqueMessage}`);
    await messageLocator.hover();

    const pinButton = messageLocator.locator('button[title="Pin to channel"]');
    await pinButton.waitFor({ state: 'visible' });
    await pinButton.click();

    // Ensure UI stability by waiting for the pin badge
    await expect(messageLocator.locator('span[title="Pinned to channel"]').first()).toBeVisible({ timeout: 15000 });

    // Bob logs in
    const bobContext = await browser.newContext();
    await loginAndInjectContext(bobContext, USERS.ThreadMaster);
    const bobPage = await bobContext.newPage();
    await bobPage.goto('http://localhost:5173/dashboard');

    // Bob should see the exact message and it should already have the pin badge
    const bobMessageLocator = bobPage.locator(`text=${uniqueMessage}`).locator('xpath=./ancestor::div[contains(@class, "group relative")]');
    await bobMessageLocator.waitFor({ state: 'visible' });
    await expect(bobMessageLocator.locator('span[title="Pinned to channel"]')).toBeVisible();

    // Bob hovers and bookmarks it
    await waitForElementStable(bobPage, `text=${uniqueMessage}`);
    await bobMessageLocator.hover();
    await waitForElementStable(bobPage, 'button[title="Bookmark"]');
    await bobMessageLocator.locator('button[title="Bookmark"]').click();

    // Verify bookmark badge appears for Bob
    await expect(bobMessageLocator.locator('span[title="Bookmarked"]')).toBeVisible({ timeout: 15000 });

    // Alice should NOT see the bookmark (Assert it's hidden)
    await expect(messageLocator.locator('span[title="Bookmarked"]')).toBeHidden({ timeout: 15000 });

    // Bob opens the Saved Items sidebar and verifies it's there
    await bobPage.locator('button:has-text("Saved Items")').click();
    const sidebar = bobPage.locator('h3:has-text("Saved Items")').locator('xpath=./ancestor::div[contains(@class, "w-80")]');
    await expect(sidebar).toBeVisible();
    await sidebar.locator('button:has-text("My Bookmarks")').click();
    await expect(sidebar.locator(`text=${uniqueMessage}`).first()).toBeVisible();

    await aliceContext.close();
    await bobContext.close();
  });
});
