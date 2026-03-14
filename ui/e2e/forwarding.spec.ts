import { test, expect } from '@playwright/test';

test.describe('Message Forwarding (Chain Attribution)', () => {
  const aliceUser = {
    id: 'a1000000-0000-0000-0000-000000000000',
    username: 'AliceReacts',
    email: 'alice.reactions@example.com'
  };
  const orgId = '00000000-0000-0000-0000-000000000001';
  const generalChannelId = '00000000-0000-0000-0000-000000000001';

  test('Alice can forward a message from #general to #engineering', async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript((data) => {
      (window as unknown as { IS_PLAYWRIGHT: boolean }).IS_PLAYWRIGHT = true;
      localStorage.setItem('nox_token', 'mock_jwt_token_alice');
      localStorage.setItem('nox_org_id', data.orgId);
      localStorage.setItem('nox_user', JSON.stringify(data.user));
      localStorage.setItem('nox_role', 'member');
      localStorage.setItem('nox_active_channel', JSON.stringify({
        id: data.generalId,
        name: 'general',
        org_id: data.orgId
      }));
    }, { user: aliceUser, orgId, generalId: generalChannelId });

    const page = await context.newPage();
    await page.goto('http://localhost:5173');

    // Wait for App to initialize and WS to connect
    await page.waitForFunction(() => (window as unknown as { WS_CONNECTED: boolean }).WS_CONNECTED === true, { timeout: 20000 });

    // 1. Verify dashboard basic elements
    await expect(page.getByText('Nox Workspace')).toBeVisible({ timeout: 15000 });
    // Use first() to avoid ambiguity if multiple "general" texts exist
    await expect(page.getByText('general').first()).toBeVisible({ timeout: 15000 });

    // 2. Clear messages if any (optional, but good for clean test)
    await expect(page.getByText('Loading messages...')).not.toBeVisible();

    // 3. Send a message in #general
    const messageInput = page.locator('textarea[placeholder*="general"]');
    const uniqueMessage = `Forward this message ${Date.now()}`;
    await messageInput.fill(uniqueMessage);
    await messageInput.press('Enter');

    // 4. Hover over the message and click forward
    const messageItem = page.locator('.message-item').filter({ hasText: uniqueMessage }).last();
    await expect(messageItem).toBeVisible({ timeout: 15000 });
    await messageItem.hover();

    const forwardBtn = messageItem.locator('button[title="Forward message"]');
    await forwardBtn.click();

    // 5. Select #engineering in the modal
    const modal = page.locator('div.max-w-md').last();
    await expect(modal).toBeVisible();

    const engineeringBtn = modal.getByRole('button', { name: 'engineering' });
    await expect(engineeringBtn).toBeVisible({ timeout: 15000 });
    await engineeringBtn.click();

    const forwardSubmitBtn = modal.getByRole('button', { name: 'Forward', exact: true });
    await expect(forwardSubmitBtn).toBeEnabled();
    await forwardSubmitBtn.click();

    // 6. Verify the modal closes
    await expect(page.getByText('Forward Message')).not.toBeVisible();

    // 7. Switch to engineering channel
    await page.getByRole('button', { name: 'engineering' }).click();

    // 8. Verify the message is there with "Forwarded from AliceReacts" metadata
    const messageLocator = page.locator('.group.relative').filter({ hasText: uniqueMessage });
    await expect(messageLocator).toBeVisible({ timeout: 15000 });
    await expect(messageLocator).toContainText('Forwarded from AliceReacts');

    await context.close();
  });
  // test('Alice cannot forward a message from a private channel to a public one', async ({ browser }) => {
  //   const context = await browser.newContext();
  //   await context.addInitScript((data) => {
  //     (window as any).IS_PLAYWRIGHT = true;
  //     localStorage.setItem('nox_token', 'mock_jwt_token_alice');
  //     localStorage.setItem('nox_org_id', data.orgId);
  //     localStorage.setItem('nox_user', JSON.stringify(data.user));
  //     localStorage.setItem('nox_role', 'member');
  //     localStorage.setItem('nox_active_channel', JSON.stringify({
  //       id: data.generalId,
  //       name: 'general',
  //       org_id: data.orgId
  //     }));
  //   }, { user: aliceUser, orgId, generalId: generalChannelId });

  //   const page = await context.newPage();
  //   await page.goto('http://localhost:5173');

  //   // Wait for App to initialize
  //   await page.waitForFunction(() => (window as unknown as {WS_CONNECTED: boolean}).WS_CONNECTED === true, { timeout: 20000 });

  //   // 1. Create a private channel
  //   await page.locator('button:has-text("Create Channel")').first().click();
  //   const channelName = `private-${Date.now()}`;
  //   await page.fill('input[placeholder="Channel name"]', channelName);
  //   await page.click('button:has-text("Private")');
  //   await page.click('button:has-text("Create Channel")');

  //   // 2. Wait for channel to be created and selected
  //   await expect(page.getByText(channelName)).toBeVisible({ timeout: 15000 });

  //   // 3. Send a message in the private channel
  //   const messageInput = page.locator('textarea[placeholder*="' + channelName + '"]');
  //   const privateMsg = "This is a private secret";
  //   await messageInput.fill(privateMsg);
  //   await messageInput.press('Enter');

  //   // 4. Try to forward it to #general (public)
  //   const messageItem = page.locator('.message-item').filter({ hasText: privateMsg }).last();
  //   await expect(messageItem).toBeVisible({ timeout: 15000 });
  //   await messageItem.hover();
  //   await messageItem.locator('button[title="Forward message"]').click();

  //   // 5. Select #general in the modal
  //   const modal = page.locator('div.max-w-md').last();
  //   await expect(modal).toBeVisible();
  //   await modal.getByRole('button', { name: 'general' }).click();
  //   await modal.getByRole('button', { name: 'Forward', exact: true }).click();

  //   // 6. Verify error message (Toast or alert)
  //   // The backend returns: "security violation: cannot forward from a private channel to a public one"
  //   await expect(page.getByText('security violation')).toBeVisible({ timeout: 15000 });

  //   await context.close();
  // });
});
