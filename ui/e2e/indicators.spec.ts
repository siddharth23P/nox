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

    // 3. Verify Bob sees Nexus Inc (to ensure logged in)
    await expect(bobPage.getByText('Nexus Inc')).toBeVisible({ timeout: 15000 });
    await expect(bobPage.getByPlaceholder(/Message #general.../)).toBeVisible({ timeout: 15000 });

    // 4. Bob starts typing
    await bobPage.fill('textarea[placeholder*="Message"]', 'H');
    
    // 5. Alice should see Bob is typing
    await expect(alicePage.locator('text=BobReacts is typing...')).toBeVisible({ timeout: 10000 });

    // 6. Wait for Bob's typing indicator to disappear (TTL is 5s)
    await expect(alicePage.locator('text=BobReacts is typing...')).not.toBeVisible({ timeout: 10000 });

    // Cleanup contexts
    await aliceContext.close();
    await bobContext.close();
  });
});
