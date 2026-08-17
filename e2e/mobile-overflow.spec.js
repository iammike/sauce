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

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    expect(scrollWidth).toBe(innerWidth);
  });
}
