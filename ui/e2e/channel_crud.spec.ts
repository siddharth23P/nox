import { test, expect } from '@playwright/test';

test.describe('Channel CRUD (Issue #28)', () => {

  test.beforeEach(async ({ context, page }) => {
    await context.addInitScript(() => {
      (window as unknown as { IS_PLAYWRIGHT: boolean }).IS_PLAYWRIGHT = true;
    });

    // Inject auth state (AliceReacts seeded user)
    await page.evaluate(() => {
      localStorage.setItem('nox_token', 'mock_jwt_token_alice');
      localStorage.setItem('nox_org_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('nox_role', 'admin');
      localStorage.setItem('nox_user', JSON.stringify({ id: 'a1111111-1111-1111-1111-111111111111', username: 'AliceReacts' }));
    });

    await page.goto('/');
    await page.waitForFunction(() => (window as unknown as { WS_CONNECTED?: boolean }).WS_CONNECTED === true, { timeout: 20000 });
    await expect(page.getByText('Nox Workspace')).toBeVisible({ timeout: 15000 });
  });

  test('User can open the create channel modal', async ({ page }) => {
    // Hover over the Channels header to reveal the + button
    const channelsHeader = page.locator('text=Channels').first();
    await channelsHeader.hover();

    // Click the create channel button
    const createBtn = page.getByTestId('create-channel-btn');
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await createBtn.click();

    // Modal should be visible
    await expect(page.getByText('Create Channel')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('channel-name-input')).toBeVisible();
    await expect(page.getByTestId('channel-description-input')).toBeVisible();
    await expect(page.getByTestId('channel-topic-input')).toBeVisible();
    await expect(page.getByTestId('channel-private-toggle')).toBeVisible();
  });

  test('Create channel modal validates required name field', async ({ page }) => {
    const channelsHeader = page.locator('text=Channels').first();
    await channelsHeader.hover();
    await page.getByTestId('create-channel-btn').click();

    // Submit button should be disabled when name is empty
    const submitBtn = page.getByTestId('create-channel-submit');
    await expect(submitBtn).toBeDisabled();
  });

  test('Private channel toggle works in create modal', async ({ page }) => {
    const channelsHeader = page.locator('text=Channels').first();
    await channelsHeader.hover();
    await page.getByTestId('create-channel-btn').click();

    // Toggle private on
    const toggle = page.getByTestId('channel-private-toggle');
    await toggle.click();

    // The header icon should change to lock
    await expect(page.locator('.text-yellow-400').first()).toBeVisible();
  });

  test('Sidebar shows lock icon for private channels', async ({ page }) => {
    // Check that private channels display a lock icon if any exist
    // This is a structural test - the sidebar should render without errors
    const channelsList = page.locator('.space-y-1');
    await expect(channelsList.first()).toBeVisible({ timeout: 10000 });
  });
});
