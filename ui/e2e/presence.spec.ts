import { test, expect } from '@playwright/test';
import { loginAndInjectContext, USERS } from './auth-helper';

// Use two isolated browser contexts to simulate Alice and Bob
test.describe('Real-time Presence & Mutual Discovery', () => {

  test('Alice and Bob see mutual presence, Alice sees distinct username, and Bob can go stealth', async ({ browser, browserName }) => {
    test.setTimeout(80000);

    // Select unique users per browser to avoid cross-test presence interference
    let alice = USERS.AlicePresence;
    let bob = USERS.BobPresence;
    let aliceMsgText = "Hey team, how is everyone doing today?";
    let bobMsgText = "Doing great! Just finished the new design mocks for the dashboard.";

    if (browserName === 'firefox') {
      alice = USERS.Charlie;
      bob = USERS.Diana;
      aliceMsgText = "Awesome Bob. Can you share the Figma link?";
      bobMsgText = "Yes, please share. I need to update the frontend components to match.";
    } else if (browserName === 'webkit') {
      alice = USERS.Evan;
      bob = USERS.Fiona;
      aliceMsgText = "Looks really clean. The new color palette is much better.";
      bobMsgText = "Agreed. Much better contrast. By the way, has anyone seen the latest backend PR?";
    }
    // 1. Setup Alice's Context
    const aliceContext = await browser.newContext();
    await loginAndInjectContext(aliceContext, alice);
    const alicePage = await aliceContext.newPage();
    await alicePage.goto('http://localhost:5173');
    await alicePage.waitForFunction(() => (window as unknown as { WS_CONNECTED?: boolean }).WS_CONNECTED === true, { timeout: 15000 });

    // 2. Setup Bob's Context
    const bobContext = await browser.newContext();
    await loginAndInjectContext(bobContext, bob);
    const bobPage = await bobContext.newPage();
    await bobPage.goto('http://localhost:5173');
    await bobPage.waitForFunction(() => (window as unknown as { WS_CONNECTED?: boolean }).WS_CONNECTED === true, { timeout: 15000 });

    // 3. Alice verification

    // Wait for messages to load and "Loading messages..." to disappear
    await expect(alicePage.locator('textarea[placeholder="Message #general..."]')).toBeVisible({ timeout: 15000 });
    await expect(alicePage.getByText('Loading messages...')).not.toBeVisible();
    await expect(bobPage.getByText('Loading messages...')).not.toBeVisible();

    // Alice sends a unique message
    const aliceUniqueText = `${aliceMsgText} (${Date.now()})`;
    const aliceInput = alicePage.getByPlaceholder('Message #general...');
    await aliceInput.fill(aliceUniqueText);
    await aliceInput.press('Enter');
    await expect(alicePage.locator('.message-item').filter({ hasText: aliceUniqueText }).first()).toBeVisible({ timeout: 15000 });

    // Bob sends a unique message
    const bobUniqueText = `${bobMsgText} (${Date.now() + 1})`;
    const bobInput = bobPage.getByPlaceholder('Message #general...');
    await bobInput.fill(bobUniqueText);
    await Promise.all([
      bobInput.press('Enter'),
      expect(bobPage.locator('.message-item').filter({ hasText: bobUniqueText }).first()).toBeVisible({ timeout: 15000 }),
    ]);

    // Wait for Bob's message to arrive in real-time
    const bobMessageLocator = alicePage.locator('.message-item').filter({ hasText: bobUniqueText }).first();
    await expect(bobMessageLocator).toBeVisible({ timeout: 20000 });

    // Find Alice's message
    const aliceMsg = alicePage.locator('.message-item').filter({ hasText: aliceUniqueText }).first();
    await expect(aliceMsg).toBeVisible();

    // Check right-alignment (Alice's message should be on the right)
    await expect(aliceMsg).toHaveClass(/flex-row-reverse/);

    // Bob shouldn't be right-aligned on Alice's screen. Look for Bob's message
    const bobTextMsg = bobMessageLocator;
    await expect(bobTextMsg).not.toHaveClass(/flex-row-reverse/);

    // Verify Bob's actual username is rendered
    // Use a more flexible locator for the username to handle potential capitalization or structure issues
    await expect(bobTextMsg.getByText(bob.username, { exact: false }).first()).toBeVisible({ timeout: 15000 });

    // 4. Presence Verification
    // Both Alice and Bob should see each other's online "glow" indicators.
    // The glow is a Framer Motion div with the emerald-500 class.
    // Since bob is active, Alice's UI should render the indicator on Bob's messages.
    const alicePresenceBubble = bobTextMsg.locator('.presence-indicator').first();
    await expect(alicePresenceBubble).toBeVisible({ timeout: 20000 });

    // 5. Stealth Mode Verification
    // Bob clicks Stealth Mode in the sidebar
    await bobPage.getByRole('button', { name: 'Toggle Stealth Mode' }).click();

    // Alice's UI should drop Bob's presence. (Polling is 3s in test mode).
    // Bob's online indicator should be gone from Alice's screen
    await expect(alicePresenceBubble).not.toBeVisible({ timeout: 15000 });

    await aliceContext.close();
    await bobContext.close();
  });
});
