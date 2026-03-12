import { test, expect } from '@playwright/test';

test.describe('Pinning and Bookmarking Engine (E2E)', () => {
  const aliceEmail = `alice.pb.${Date.now()}@example.com`;
  const bobEmail = `bob.pb.${Date.now()}@example.com`;
  const password = 'Password123!';

  test.beforeAll(async ({ request }) => {
    // 1. Setup Auth and Seed Users
    const orgId = '00000000-0000-0000-0000-000000000001'; // Default
    try {
      await request.post('http://localhost:8080/v1/auth/register', {
        data: { email: aliceEmail, username: 'AlicePB', password, full_name: 'Alice P' },
        headers: { 'X-Org-ID': orgId }
      });
      await request.post('http://localhost:8080/v1/auth/register', {
        data: { email: bobEmail, username: 'BobPB', password, full_name: 'Bob P' },
        headers: { 'X-Org-ID': orgId }
      });
    } catch (e) {
      // Ignore if exists
    }
  });

  test('Alice sets a pin, Bob sees it globally. Bob bookmarks it privately.', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    // 1. Alice logs in (Bypassing UI via localStorage)
    const aliceUser = { id: 'alice-pb-id', username: 'AlicePB', email: aliceEmail };
    await alicePage.goto('http://localhost:5173/login');
    await alicePage.evaluate(([token, user, org]) => {
      localStorage.setItem('nox_token', token);
      localStorage.setItem('nox_user', JSON.stringify(user));
      localStorage.setItem('nox_org_id', org);
    }, ['mock-alice-token-pb-123', aliceUser, '00000000-0000-0000-0000-000000000001']);
    await alicePage.goto('http://localhost:5173/dashboard');
    
    // Send a message
    const uniqueMessage = `This is a highly important pin target ${Date.now()}`;
    await alicePage.waitForSelector('textarea[placeholder="Type a message..."]');
    await alicePage.fill('textarea[placeholder="Type a message..."]', uniqueMessage);
    await alicePage.press('textarea[placeholder="Type a message..."]', 'Enter');
    
    // Find message and hover to click pin
    const messageLocator = alicePage.locator(`text=${uniqueMessage}`).locator('xpath=./ancestor::div[contains(@class, "group relative")]');
    await messageLocator.hover();
    await messageLocator.locator('button[title="Pin to channel"]').click();
    
    // Verify badge appears on Alice's screen
    await expect(messageLocator.locator('span[title="Pinned to channel"]')).toBeVisible({ timeout: 5000 });

    // Bob logs in
    const bobUser = { id: 'bob-pb-id', username: 'BobPB', email: bobEmail };
    await bobPage.goto('http://localhost:5173/login');
    await bobPage.evaluate(([token, user, org]) => {
      localStorage.setItem('nox_token', token);
      localStorage.setItem('nox_user', JSON.stringify(user));
      localStorage.setItem('nox_org_id', org);
    }, ['mock-bob-token-pb-123', bobUser, '00000000-0000-0000-0000-000000000001']);
    await bobPage.goto('http://localhost:5173/dashboard');
    
    // Bob should see the exact message and it should already have the pin badge
    const bobMessageLocator = bobPage.locator(`text=${uniqueMessage}`).locator('xpath=./ancestor::div[contains(@class, "group relative")]');
    await bobMessageLocator.waitFor({ state: 'visible' });
    await expect(bobMessageLocator.locator('span[title="Pinned to channel"]')).toBeVisible();

    // Bob hovers and bookmarks it
    await bobMessageLocator.hover();
    await bobMessageLocator.locator('button[title="Bookmark"]').click();
    
    // Verify bookmark badge appears for Bob
    await expect(bobMessageLocator.locator('span[title="Bookmarked"]')).toBeVisible();

    // Alice should NOT see the bookmark (Wait a moment and assert it's hidden)
    await alicePage.waitForTimeout(500);
    await expect(messageLocator.locator('span[title="Bookmarked"]')).toBeHidden();

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
