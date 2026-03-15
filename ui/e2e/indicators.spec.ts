import { test, expect } from '@playwright/test';
import { loginAndInjectContext, USERS } from './auth-helper';

test.describe('Real-time Indicators', () => {
  test('Alice sees Bob typing', async ({ browser }) => {
    // 1. Setup Alice Context
    const aliceContext = await browser.newContext();
    await loginAndInjectContext(aliceContext, USERS.AliceReacts);
    const alicePage = await aliceContext.newPage();
    await alicePage.goto('http://localhost:5173');
    await alicePage.waitForFunction(() => (window as unknown as { WS_CONNECTED?: boolean }).WS_CONNECTED === true, { timeout: 30000 });

    // 2. Setup Bob Context
    const bobContext = await browser.newContext();
    await loginAndInjectContext(bobContext, USERS.BobReacts);
    const bobPage = await bobContext.newPage();
    await bobPage.goto('http://localhost:5173');
    await bobPage.waitForFunction(() => (window as unknown as { WS_CONNECTED?: boolean }).WS_CONNECTED === true, { timeout: 30000 });

    // 3. Verify Bob sees org name (to ensure logged in)
    await expect(bobPage.getByText('Nexus Inc')).toBeVisible({ timeout: 15000 });

    // Select channel explicitly to ensure we are in the right state
    await bobPage.getByRole('button', { name: 'general' }).click();
    await alicePage.getByRole('button', { name: 'general' }).click();

    await expect(bobPage.getByPlaceholder(/Message #general.../)).toBeVisible({ timeout: 15000 });
    await expect(alicePage.getByPlaceholder(/Message #general.../)).toBeVisible({ timeout: 15000 });

    // 4. Bob starts typing
    // Use pressSequentially to simulate real typing which triggers onChange better
    await bobPage.locator('textarea[placeholder*="Message"]').pressSequentially('Hello', { delay: 100 });

    // 5. Alice should see the typing indicator (avatar stack with bouncing dots)
    const indicator = alicePage.getByTestId('typing-indicator');
    await expect(indicator).toBeVisible({ timeout: 15000 });

    // 6. Wait for typing indicator to disappear (TTL is 5s + buffer)
    await expect(indicator).not.toBeVisible({ timeout: 20000 });

    // Cleanup contexts
    await aliceContext.close();
    await bobContext.close();
  });
});
