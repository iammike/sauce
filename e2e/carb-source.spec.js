// Layout-dependent checks for the carb source swap (#30). These live in e2e/
// rather than tests/ because jsdom never renders: the DOM test for hiding a
// field reads back the `hidden` property it just set and passes with the CSS
// deleted. Only a real engine resolves `display`.
//
// The specific bug: `[hidden] { display: none }` comes from the UA stylesheet
// and loses on specificity to `.field { display: flex }`, so setting
// el.hidden did nothing visible until `.field[hidden]` was added.

import { test, expect } from '@playwright/test';

const CARB_FIELDS = ['maltodextrin', 'fructose', 'sucrose'];

const displays = (page) => page.evaluate((keys) => Object.fromEntries(
  keys.map((k) => [k, getComputedStyle(
    document.querySelector(`[data-carb-part="${k}"]`),
  ).display]),
), CARB_FIELDS);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // The calculator being visible first, so a failed build or a throw mid-render
  // fails loudly instead of passing against an empty page.
  await expect(page.locator('#calculator')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

test('hides the carb fields the chosen base does not use', async ({ page }) => {
  expect(await displays(page)).toMatchObject({ sucrose: 'none' });
  expect((await displays(page)).maltodextrin).not.toBe('none');

  await page.selectOption('#in-carb-base', 'sucrose');
  expect(await displays(page)).toMatchObject({ maltodextrin: 'none', fructose: 'none' });
  expect((await displays(page)).sucrose).not.toBe('none');
});

// A native <select> does not ellipsize — a long option renders underneath the
// dropdown arrow. Measured rather than eyeballed, per the repo convention.
test('keeps every carb source option inside the select', async ({ page }) => {
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);

    const overflow = await page.evaluate(() => {
      const select = document.getElementById('in-carb-base');
      const style = getComputedStyle(select);
      const box = select.clientWidth
        - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const canvas = document.createElement('canvas').getContext('2d');
      canvas.font = `${style.fontSize} ${style.fontFamily}`;
      const widest = Math.max(...[...select.options]
        .map((o) => canvas.measureText(o.textContent).width));
      return { widest, box };
    });

    expect(overflow.widest, `widest option at ${width}px`).toBeLessThanOrEqual(overflow.box);
  }
});
