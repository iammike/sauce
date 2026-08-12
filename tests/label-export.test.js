// exportLabelPng() itself is not tested here — it walks a live element with
// getBoundingClientRect() and draws to a real <canvas>, neither of which
// jsdom implements (no layout engine, and getContext('2d') returns null
// without the separate native `canvas` package, which pulls in a system
// Cairo dependency this project doesn't otherwise need and — being a
// different rendering engine — wouldn't actually prove anything about real
// browser output even if installed). That half was verified by hand in a
// real browser: exact pixel dimensions at each of the four label sizes,
// visual comparison against the on-screen sheet, wide-format zoom-correction,
// and artwork drawing.
//
// wrapText() and isTextLeaf() are the exceptions, and deliberately exported
// for it. wrapText() only ever calls ctx.measureText(), so a fake ctx with
// no canvas behind it at all is enough to pin its line-breaking — including
// the character-split fallback, which is the one place this file had a
// real, shipped regression (a spaceless product name ran off the canvas
// edge instead of wrapping) caught only by hand-testing in a browser, not
// by any test. isTextLeaf() only calls getComputedStyle(), which jsdom does
// implement for default UA-stylesheet values — a plain block-level element
// really does compute to display: block with no layout engine involved,
// which is enough to cover both bugs this function has actually shipped:
// an inline <svg> reporting tagName 'svg' (not 'SVG', silently defeating
// REPLACED_TAGS without upper-casing first), and the display check itself
// being the one thing distinguishing a text leaf from a block-level child
// worth recursing into. What jsdom can't validate is used-value
// blockification of a flex/grid item specifically (a <span> that's
// display: block only because its parent is display: flex, with nothing
// saying so in its own CSS) — that narrower case is still hand-verified
// only, confirmed empirically rather than assumed.

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { labelFileName, wrapText, isTextLeaf } from '../src/label-export.js';

// Monofont stand-in: every character is CHAR_WIDTH wide, so expected wrap
// points are simple arithmetic rather than depending on a real font's
// actual metrics (which jsdom can't measure anyway).
const CHAR_WIDTH = 10;
function fakeCtx() {
  return { measureText: (s) => ({ width: s.length * CHAR_WIDTH }) };
}

describe('labelFileName', () => {
  it('appends " label.png" to the product name', () => {
    expect(labelFileName('Rocket Fuel')).toBe('Rocket Fuel label.png');
  });

  it('falls back to "The Sauce" for an empty name', () => {
    expect(labelFileName('')).toBe('The Sauce label.png');
  });

  it('falls back to "The Sauce" for a name that is only whitespace', () => {
    expect(labelFileName('   ')).toBe('The Sauce label.png');
  });

  it('falls back to "The Sauce" for null/undefined', () => {
    expect(labelFileName(null)).toBe('The Sauce label.png');
    expect(labelFileName(undefined)).toBe('The Sauce label.png');
  });

  it('trims surrounding whitespace from a real name', () => {
    expect(labelFileName('  Rocket Fuel  ')).toBe('Rocket Fuel label.png');
  });

  // The product-name field only caps length (maxlength="28" in index.html)
  // and never validated characters, so whatever the OS/filesystem rejects in
  // a filename has to be handled here, not upstream.
  it.each([
    ['Before/After', 'Before-After label.png'],
    ['Recipe: v2', 'Recipe- v2 label.png'],
    ['Mike\'s "Best" Mix', 'Mike\'s -Best- Mix label.png'],
    ['A<B>C', 'A-B-C label.png'],
    ['Q?', 'Q- label.png'],
    ['Take 2 | Final', 'Take 2 - Final label.png'],
    // A colon immediately followed by a backslash is two unsafe characters
    // in a row, collapsed to one dash — see the dedicated test below for why.
    ['C:\\temp', 'C-temp label.png'],
  ])('replaces filesystem-unsafe characters: %s', (input, expected) => {
    expect(labelFileName(input)).toBe(expected);
  });

  it('collapses a run of unsafe characters to a single dash rather than one per character', () => {
    expect(labelFileName('A///B')).toBe('A-B label.png');
  });
});

describe('wrapText', () => {
  it('greedily packs words onto a line until the next one would not fit', () => {
    // Each word fits maxWidth=100 (10 chars) on its own; "The quick brown"
    // (15 chars) doesn't, so it breaks after "quick".
    expect(wrapText(fakeCtx(), 'The quick brown fox', 100))
      .toEqual(['The quick', 'brown fox']);
  });

  it('splits a single word wider than maxWidth character-by-character, as the first word on a line', () => {
    // 34 chars at 10 chars/line (maxWidth=100) is exactly 4 lines: 10+10+10+4.
    const lines = wrapText(fakeCtx(), 'Supercalifragilisticexpialidocious', 100);
    expect(lines).toEqual(['Supercalif', 'ragilistic', 'expialidoc', 'ious']);
    expect(lines.join('')).toBe('Supercalifragilisticexpialidocious');
  });

  it('splits a too-long word that follows a word which already fit', () => {
    const lines = wrapText(fakeCtx(), 'Hi Supercalifragilisticexpialidocious', 100);
    expect(lines[0]).toBe('Hi');
    expect(lines.slice(1).join('')).toBe('Supercalifragilisticexpialidocious');
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(10);
  });

  it('still terminates and emits one character per line when maxWidth is smaller than a single character', () => {
    // fits('') is always true (width 0), which is what stops splitWord's
    // loop even when no non-empty string could ever fit — without that,
    // this would hang rather than degrade to one character per line.
    expect(wrapText(fakeCtx(), 'AB', 1)).toEqual(['A', 'B']);
  });

  it('returns no lines for empty text', () => {
    expect(wrapText(fakeCtx(), '', 100)).toEqual([]);
  });
});

describe('isTextLeaf', () => {
  // isTextLeaf() calls the ambient getComputedStyle(), not
  // element.ownerDocument.defaultView.getComputedStyle() — same as the rest
  // of this file, written for a real browser where that's just a global.
  // Stand one in for the duration of each case, scoped narrowly so it can't
  // leak into any other test file.
  function isTextLeafOf(html, selector) {
    const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
    const originalGetComputedStyle = globalThis.getComputedStyle;
    globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
    try {
      return isTextLeaf(dom.window.document.querySelector(selector));
    } finally {
      globalThis.getComputedStyle = originalGetComputedStyle;
    }
  }

  it('is true for a block whose element children are plain inline flow', () => {
    expect(isTextLeafOf('<p id="leaf">Hi <strong>bold</strong> <span>text</span></p>', '#leaf')).toBe(true);
  });

  it('is false when a child is an inline <svg> — tagName is lowercase in the SVG namespace, not "SVG"', () => {
    const html = '<p id="leaf">Hi <svg></svg></p>';
    // Sanity-checks the actual premise of the bug this guards against: if a
    // future jsdom/spec change ever made tagName upper-case for SVG too,
    // this assertion (not the one below) is what would tell us the
    // toUpperCase() call had become a no-op rather than a fix.
    const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
    expect(dom.window.document.querySelector('svg').tagName).toBe('svg');

    expect(isTextLeafOf(html, '#leaf')).toBe(false);
  });

  it('is false when a child is <img> or <br>, even though both default to display:inline like <strong>', () => {
    expect(isTextLeafOf('<p id="leaf">Hi <img> world</p>', '#leaf')).toBe(false);
    expect(isTextLeafOf('<p id="leaf">Hi<br>world</p>', '#leaf')).toBe(false);
  });

  // The REPLACED_TAGS cases above all short-circuit before display is ever
  // consulted, so they can't tell display === 'inline' apart from a looser
  // check like display !== 'none' — confirmed by mutating it that way and
  // finding the suite still green. Block-level children (<div>, <p>, ...)
  // are the case that actually needs the strict comparison: they're what
  // getComputedStyle().display reports 'block' for by default, with no
  // REPLACED_TAGS entry to catch them if the display check were loosened
  // or dropped. They're also the label's actual markup — .label-facts and
  // .label-sheet__data are built from <div>/<p>/<dl> siblings, not <svg>,
  // which isn't in the label at all — so this is the higher-consequence
  // case, not the exotic one.
  it('is false when a child is a block-level element, not merely non-"none"', () => {
    expect(isTextLeafOf('<div id="leaf">Hi <div>block</div></div>', '#leaf')).toBe(false);
    expect(isTextLeafOf('<div id="leaf"><p>a</p><p>b</p></div>', '#leaf')).toBe(false);
  });
});
