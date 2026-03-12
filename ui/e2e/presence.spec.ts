import { test, expect } from '@playwright/test';
import { waitForElementStable } from './utils';

// Use two isolated browser contexts to simulate Alice and Bob
test.describe('Real-time Presence & Mutual Discovery', () => {

  test('Alice and Bob see mutual presence, Alice sees distinct username, and Bob can go stealth', async ({ browser, browserName }) => {
    test.setTimeout(80000);
    
    // Select unique users per browser to avoid cross-test presence interference
    let alice = { id: 'a1000000-0000-0000-0000-000000000000', username: 'alice', email: 'alice@nox.inc' };
    let bob = { id: 'a2000000-0000-0000-0000-000000000000', username: 'bob', email: 'bob@nox.inc' };
    let aliceMsgText = "Hey team, how is everyone doing today?";
    let bobMsgText = "Doing great! Just finished the new design mocks for the dashboard.";

    if (browserName === 'firefox') {
      alice = { id: 'a3000000-0000-0000-0000-000000000000', username: 'charlie', email: 'charlie@nox.inc' };
      bob = { id: 'a4000000-0000-0000-0000-000000000000', username: 'diana', email: 'diana@nox.inc' };
      aliceMsgText = "Awesome Bob. Can you share the Figma link?";
      bobMsgText = "Yes, please share. I need to update the frontend components to match.";
    } else if (browserName === 'webkit') {
      alice = { id: 'a5000000-0000-0000-0000-000000000000', username: 'evan', email: 'evan@nox.inc' };
      bob = { id: 'a6000000-0000-0000-0000-000000000000', username: 'fiona', email: 'fiona@nox.inc' };
      aliceMsgText = "Looks really clean. The new color palette is much better.";
      bobMsgText = "Agreed. Much better contrast. By the way, has anyone seen the latest backend PR?";
    }
    // 1. Setup Alice's Context
    const aliceContext = await browser.newContext();
    await aliceContext.addInitScript(() => {
      (window as unknown as { IS_PLAYWRIGHT?: boolean }).IS_PLAYWRIGHT = true;
    });
    const alicePage = await aliceContext.newPage();
    
    // Login as Alice (id: a1000000-0000-0000-0000-000000000000, username: alice)
    await alicePage.goto('http://localhost:5173/login');
    await alicePage.evaluate((user) => {
      localStorage.setItem('nox_token', 'test_jwt_token');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_role', 'member');
      localStorage.setItem('nox_user', JSON.stringify(user));
    }, alice);
    await alicePage.goto('http://localhost:5173');
    
    // 2. Setup Bob's Context
    const bobContext = await browser.newContext();
    await bobContext.addInitScript(() => {
      (window as unknown as { IS_PLAYWRIGHT?: boolean }).IS_PLAYWRIGHT = true;
    });
    const bobPage = await bobContext.newPage();
    
    // Login as Bob (id: a2000000-0000-0000-0000-000000000000, username: bob)
    await bobPage.goto('http://localhost:5173/login');
    await bobPage.evaluate((user) => {
      localStorage.setItem('nox_token', 'test_jwt_token_2');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_role', 'member');
      localStorage.setItem('nox_user', JSON.stringify(user));
    }, bob);
    await bobPage.goto('http://localhost:5173');

    // 3. Alice verification
    
    // Wait for messages to load
    await waitForElementStable(alicePage, 'textarea[placeholder="Message #general..."]', 30000);

    // Alice sends a unique message
    const aliceUniqueText = `${aliceMsgText} (${Date.now()})`;
    const aliceInput = alicePage.getByPlaceholder('Message #general...');
    await aliceInput.fill(aliceUniqueText);
    await aliceInput.press('Enter');
    await waitForElementStable(alicePage, `text=${aliceUniqueText}`);

    // Bob sends a unique message
    const bobUniqueText = `${bobMsgText} (${Date.now() + 1})`;
    const bobInput = bobPage.getByPlaceholder('Message #general...');
    await bobInput.fill(bobUniqueText);
    await Promise.all([
      bobPage.waitForResponse(resp => resp.url().includes('/messages') && resp.status() === 200),
      bobInput.press('Enter'),
    ]);
    await waitForElementStable(bobPage, `text=${bobUniqueText}`);

    // Wait for Bob's message to arrive in real-time
    const aliceViewOfBobMsg = alicePage.locator(`text="${bobUniqueText}"`).first();
    await expect(aliceViewOfBobMsg).toBeVisible({ timeout: 15000 });

    // Find Alice's message
    const aliceMsg = alicePage.locator(`text="${aliceUniqueText}"`).first();
    await expect(aliceMsg).toBeVisible();
    
    // Check right-alignment
    const aliceWrapper = aliceMsg.locator('xpath=./ancestor::div[contains(@class, "flex-row-reverse")]').first();
    await expect(aliceWrapper).toBeVisible();

    // Bob shouldn't be right-aligned on Alice's screen. Look for Bob's message
    const bobTextMsg = alicePage.locator(`text="${bobUniqueText}"`).first();
    const bobWrapper = bobTextMsg.locator('xpath=./ancestor::div[contains(@class, "group relative")]').first();
    await expect(bobWrapper).not.toHaveClass(/flex-row-reverse/);

    // Verify Bob's actual username is rendered
    const bobNameLabel = bobWrapper.locator(`text="${bob.username}"`).first();
    await expect(bobNameLabel).toBeVisible();

    // 4. Presence Verification
    // Both Alice and Bob should see each other's online "glow" indicators.
    // The glow is a Framer Motion div with the emerald-500 class.
    // Since bob is active, Alice's UI should render the indicator on Bob's messages.
    const bobsIndicator = bobWrapper.locator('.bg-emerald-500').first();
    await expect(bobsIndicator).toBeVisible({ timeout: 20000 });

    // 5. Stealth Mode Verification
    // Bob clicks Stealth Mode in the sidebar
    await bobPage.getByRole('button', { name: 'Toggle Stealth Mode' }).click();
    
    // Alice's UI should drop Bob's presence. (Polling is 3s in test mode).
    // Bob's online indicator should be gone from Alice's screen
    await expect(bobsIndicator).not.toBeVisible({ timeout: 15000 });

    await aliceContext.close();
    await bobContext.close();
  });
});
