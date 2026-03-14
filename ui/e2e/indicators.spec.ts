import { test, expect } from '@playwright/test';

test.describe('Real-time Indicators', () => {
  test('Alice sees Bob typing', async ({ browser }) => {
    // 1. Setup Alice Context
    const aliceUser = { id: 'a1000000-0000-0000-0000-000000000000', username: 'AliceReacts', email: 'alice.reactions@example.com' };
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
    const bobUser = { id: 'b2000000-0000-0000-0000-000000000000', username: 'BobReacts', email: 'bob.reactions@example.com' };
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

    // 3. Verify Bob sees org name (to ensure logged in)
    await expect(bobPage.getByText('Nox Workspace')).toBeVisible({ timeout: 15000 });
    
    // Select channel explicitly to ensure we are in the right state
    await bobPage.getByRole('button', { name: 'general' }).click();
    await alicePage.getByRole('button', { name: 'general' }).click();

    await expect(bobPage.getByPlaceholder(/Message #general.../)).toBeVisible({ timeout: 15000 });
    await expect(alicePage.getByPlaceholder(/Message #general.../)).toBeVisible({ timeout: 15000 });

    // 4. Bob starts typing
    // Use pressSequentially to simulate real typing which triggers onChange better
    await bobPage.locator('textarea[placeholder*="Message"]').pressSequentially('Hello', { delay: 100 });
    
    // 5. Alice should see Bob is typing
    const indicator = alicePage.locator('text=BobReacts is typing...');
    await expect(indicator).toBeVisible({ timeout: 15000 });

    // 6. Wait for Bob's typing indicator to disappear (TTL is 5s + buffer)
    await expect(indicator).not.toBeVisible({ timeout: 20000 });

    // Cleanup contexts
    await aliceContext.close();
    await bobContext.close();
  });
});
