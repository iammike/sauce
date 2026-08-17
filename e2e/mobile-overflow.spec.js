// Deterministic, no-baseline check split out of #13 (full Playwright visual
// regression, closed as not-now — see that issue for why). This one check
// stands on its own: it would have caught #5, the mobile header forcing
// horizontal scroll, outright.
const { test, expect } = require('@playwright/test');

const MOBILE_WIDTHS = [320, 375, 390, 430];

for (const width of MOBILE_WIDTHS) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');

    // A blank/broken page (failed build, JS throw mid-render — see
    // dom-contract.test.js) has no overflow either, and would pass the
    // check below silently. Confirm the calculator actually rendered first.
    await expect(page.locator('#calculator')).toBeVisible();

    await page.evaluate(() => document.fonts.ready);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      // clientWidth, not window.innerWidth: innerWidth includes the
      // scrollbar gutter on a classic (non-overlay) scrollbar, which reads
      // as false overflow in headed mode even though headless hides it.
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(scrollWidth).toBe(clientWidth);
  });
}
