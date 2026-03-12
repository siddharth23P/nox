// Utility functions for Playwright E2E tests
export async function waitForElementStable(page: any, selector: string, timeout = 300000) {
  const start = Date.now();
  let delay = 100;
  while (Date.now() - start < timeout) {
    try {
      const element = await page.locator(selector);
      if (await element.isVisible()) {
        // Check stability by ensuring it stays visible for a short period
        await page.waitForTimeout(200);
        if (await element.isVisible()) return;
      }
    } catch (_) {}
    await page.waitForTimeout(delay);
    delay = Math.min(delay * 2, 1000);
  }
  throw new Error(`Element ${selector} not stable after ${timeout}ms`);
}
