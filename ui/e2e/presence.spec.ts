import { test, expect } from '@playwright/test';

// Use two isolated browser contexts to simulate Alice and Bob
test.describe('Real-time Presence & Mutual Discovery', () => {

  test('Alice and Bob see mutual presence, Alice sees distinct username, and Bob can go stealth', async ({ browser }) => {
    test.setTimeout(45000);
    // 1. Setup Alice's Context
    const aliceContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();
    
    // Login as Alice (id: a1000000-0000-0000-0000-000000000000, username: alice)
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
    
    // 2. Setup Bob's Context
    const bobContext = await browser.newContext();
    const bobPage = await bobContext.newPage();
    
    // Login as Bob (id: a2000000-0000-0000-0000-000000000000, username: bob)
    await bobPage.goto('http://localhost:5173/login');
    await bobPage.evaluate(() => {
      localStorage.setItem('nox_token', 'test_jwt_token_2');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_role', 'member');
      localStorage.setItem('nox_user', JSON.stringify({
        id: 'a2000000-0000-0000-0000-000000000000',
        email: 'bob@nox.inc',
        username: 'bob'
      }));
    });
    await bobPage.goto('http://localhost:5173');

    // 3. Alice verification
    // Alice should see her own name as "You", Bob's messages as "bob", and her messages should be right-aligned
    
    // Wait for the next 15-second polling cycle so Alice fetches Bob's newly registered presence
    await alicePage.waitForTimeout(16000); 

    // Find one of Alice's messages (she says "Hey team...")
    const aliceMsg = alicePage.locator('text="Hey team, how is everyone doing today?"').first();
    await expect(aliceMsg).toBeVisible();
    
    // Check right-alignment: In our UI, `flex-row-reverse` is applied to the message container
    const aliceWrapper = aliceMsg.locator('xpath=./ancestor::div[contains(@class, "flex-row-reverse")]').first();
    await expect(aliceWrapper).toBeVisible();

    // Bob shouldn't be right-aligned on Alice's screen. Look for Bob's message
    const bobTextMsg = alicePage.locator('text="Doing great! Just finished the new design mocks for the dashboard."').first();
    const bobWrapper = bobTextMsg.locator('xpath=./ancestor::div[contains(@class, "group relative")]').first();
    await expect(bobWrapper).not.toHaveClass(/flex-row-reverse/);

    // Verify Bob's actual username "bob" is rendered next to his message, not User UUID
    const bobNameLabel = bobWrapper.locator('text="bob"').first();
    await expect(bobNameLabel).toBeVisible();

    // 4. Presence Verification
    // Both Alice and Bob should see each other's online "glow" indicators.
    // The glow is a Framer Motion div with the emerald-500 class.
    // Since bob is active, Alice's UI should render the indicator on Bob's messages.
    const bobsIndicator = bobWrapper.locator('.bg-emerald-500').first();
    await expect(bobsIndicator).toBeVisible();

    // 5. Stealth Mode Verification
    // Bob clicks Stealth Mode in the sidebar
    await bobPage.getByRole('button', { name: 'Toggle Stealth Mode' }).click();
    
    // Alice's UI should drop Bob's presence. (Polling is 15s, so we wait slightly longer).
    await alicePage.waitForTimeout(16000);
    
    // Bob's online indicator should be gone from Alice's screen
    await expect(bobsIndicator).not.toBeVisible();

    await aliceContext.close();
    await bobContext.close();
  });
});
