// These drive the real index.html through the real src/app.js. app.js exports
// nothing and self-initialises on import, so importing it *is* the test: it
// runs init() against the actual markup. That's deliberate. Every bug that has
// reached the live site came from the wiring between the two (an id that moved,
// an element that was deleted while app.js still wrote to it), not from the
// maths — which is pure, and already covered.
//
// jsdom is used as a library here rather than as the vitest environment, so
// every load gets a brand-new window. That matters: vi.resetModules() clears
// the module cache but leaves the previous instance's listeners bound to a
// shared window, and a stale hashchange listener will happily open a panel and
// make an anchor test pass with the code under test deleted. Verified by
// mutation, not assumed.

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import { FLAVORINGS } from '../data/flavorings.js';
import { TUNING } from '../data/tuning.js';
import { PRODUCTS, ASSOCIATES_TAG } from '../data/products.js';
import { LABEL_SIZES } from '../data/label-sizes.js';
import { SALT_PROFILES } from '../src/calculator.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

const $ = (id) => document.getElementById(id);

function defineGlobal(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

/** The window from the most recent load, kept only so it can be closed. */
let current = null;

/**
 * Build a fresh page from index.html and run app.js against it.
 *
 * The hash goes in the URL rather than being assigned afterwards, because
 * that's what an inbound link is: arriving at /#cost fires no hashchange, so
 * init()'s own openTargetedPanel() call is the only thing that can open the
 * panel. Assigning window.location.hash instead would test the listener.
 *
 * runScripts is left off, so the page's own bundle stays inert and the module
 * under test is the only thing touching the DOM.
 *
 * localStorage, likewise, has to be seeded before app.js imports — that's
 * what "already has saved state" means for a page load. Setting it
 * afterwards would test whatever save/restore triggers app.js has already
 * wired up, not whether it reads a prior visit correctly.
 */
async function loadApp({ hash = '', seedLocalStorage } = {}) {
  const dom = new JSDOM(html, {
    url: `https://sauce.iammike.org/${hash}`,
    pretendToBeVisual: true,
  });
  const { window } = dom;

  if (seedLocalStorage) {
    for (const [key, value] of Object.entries(seedLocalStorage)) {
      window.localStorage.setItem(key, value);
    }
  }

  // jsdom implements neither, and init() calls both.
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.Element.prototype.scrollIntoView = function scrollIntoView() {};

  // app.js and its imports reach for these unqualified, the way page scripts
  // do. In a browser they're on the global object; here they have to be put
  // there. Anything missing shows up as a ReferenceError at import, which is
  // the same failure a stray Node-only assumption would produce.
  //
  // defineProperty, not assignment: from Node 21 on, some of these exist on
  // globalThis as getter-only accessors, and a plain assignment to one throws
  // in strict mode (which ESM always is). `navigator` is the one that bites
  // today. Assume the list will grow.
  defineGlobal('window', window);
  for (const name of ['document', 'location', 'getComputedStyle',
    'requestAnimationFrame', 'cancelAnimationFrame', 'Event', 'Element',
    'HTMLElement', 'FileReader', 'File', 'Blob', 'Image', 'DOMParser',
    'navigator', 'localStorage']) {
    const value = window[name];
    defineGlobal(name, typeof value === 'function' && !/^[A-Z]/.test(name)
      ? value.bind(window)
      : value);
  }

  if (window.document.readyState === 'loading') {
    await new Promise((r) => window.addEventListener('DOMContentLoaded', r, { once: true }));
  }

  vi.resetModules();
  await import('../src/app.js');

  // pretendToBeVisual starts a rAF loop; without this every load leaves one
  // running for the rest of the file, which undercuts the point of building a
  // fresh window each time.
  if (current) current.close();
  current = window;
  return window;
}

/** Fire the event app.js actually listens for on that control. */
function setValue(id, value, event = 'input') {
  const el = $(id);
  el.value = String(value);
  el.dispatchEvent(new Event(event, { bubbles: true }));
}

beforeEach(async () => {
  await loadApp();
});

// The last load has no successor to close it.
afterAll(() => { if (current) current.close(); });

describe('init renders the whole page', () => {
  // The regression this exists for: #hourly-warning was deleted while app.js
  // still set .hidden on it. That threw partway through the render chain, so
  // every panel after the throw stayed blank — with nothing in the console and
  // nothing visibly broken until you scrolled. Unit tests could not see it.
  it('fills every live output region', () => {
    const populated = [
      'fp-batch', 'fp-serving-size', 'fp-servings', 'fp-calories', 'fp-carbs',
      'fp-sugars', 'fp-sodium', 'fp-flavor-name', 'fp-target',
      'calc-limiting', 'ratio-readout', 'salt-profile-note',
      'cost-basis', 'cost-note',
      // The label and the bottle planner are rendered by the same chain and
      // were the two subsystems that could be deleted wholesale without this
      // suite noticing.
      'lb-name', 'lb-serving', 'lb-servings', 'lb-calories', 'lb-carbs',
      'lb-sugars', 'lb-sodium', 'lb-directions', 'lb-ingredients',
      'ride-answer', 'ride-caveat', 'intensity-note', 'weather-note',
    ];
    const empty = populated.filter((id) => $(id).textContent.trim() === '');
    expect(empty).toEqual([]);
  });

  it('fills every region built from a data table', () => {
    const grids = ['recipe-grid', 'cost-grid', 'cost-breakdown', 'tuning-list',
      'products-grid', 'equipment-grid', 'research-grid'];
    const empty = grids.filter((id) => $(id).children.length === 0);
    expect(empty).toEqual([]);
  });

  it('renders one recipe card per ingredient', () => {
    expect($('recipe-grid').querySelectorAll('.card')).toHaveLength(4);
  });

  it('names the limiting ingredient', () => {
    expect($('calc-limiting').textContent).toMatch(/limiting ingredient|container/);
  });
});

describe('inputs drive outputs', () => {
  it('recalculates when an ingredient amount changes', () => {
    const before = $('fp-batch').textContent;
    setValue('in-malto', 500);
    expect($('fp-batch').textContent).not.toBe(before);
  });

  it('scales the batch up when more maltodextrin is on hand', () => {
    setValue('in-malto', 500);
    const small = parseFloat($('fp-batch').textContent);
    setValue('in-malto', 5000);
    expect(parseFloat($('fp-batch').textContent)).toBeGreaterThan(small);
  });

  // app.js carries a comment saying the form's 'input' listener happened to
  // cover selects in current browsers, and that relying on it made salt level
  // silently stop recalculating when driven programmatically. Pin the fix.
  it('recalculates when the salt profile select changes', () => {
    const before = { sodium: $('fp-sodium').textContent, note: $('salt-profile-note').textContent };
    setValue('in-salt-profile', 'hot', 'change');
    expect($('fp-sodium').textContent).not.toBe(before.sodium);
    expect($('salt-profile-note').textContent).not.toBe(before.note);
  });

  it('recalculates when the flavoring select changes', () => {
    const other = FLAVORINGS.find((f) => f.id !== $('in-flavor-preset').value && !f.perBottle);
    setValue('in-flavor-preset', other.id, 'change');
    expect($('fp-flavor-name').textContent).toBe(other.name);
  });

  it('restates the serving basis on the facts panel', () => {
    setValue('in-target-carbs', 90);
    expect($('fp-target').textContent).toBe('90 g carbs/hr');
  });

  // Grams are the unit; a serving is an hour of fuelling. Changing the target
  // must move the serving size, or the label lies about how long a jar lasts.
  // Pinned absolutely as well as relatively: monotonicity alone still passes
  // if the rendered figure is scaled by a constant.
  it('resizes a serving when the hourly target changes', () => {
    setValue('in-target-carbs', 60);
    const at60 = parseFloat($('fp-serving-size').textContent);
    setValue('in-target-carbs', 120);
    const at120 = parseFloat($('fp-serving-size').textContent);
    expect(at120).toBeGreaterThan(at60);
    // Doubling the hourly carb target doubles the mix an hour takes.
    expect(at120 / at60).toBeCloseTo(2, 1);
  });

  it('states the serving size the batch is actually divided into', () => {
    setValue('in-target-carbs', 75);
    const perHour = parseFloat($('fp-serving-size').textContent);
    const batch = parseFloat($('fp-batch').textContent);
    const hours = parseFloat($('fp-servings').textContent);
    expect(batch / perHour / hours).toBeCloseTo(1, 1);
  });
});

// persist.js's own unit tests (tests/persist.test.js) cover validation and
// fallback in isolation. What only a full page load can prove is the wiring:
// that restoreCalcFormState() actually runs during init(), in time to affect
// the first render, and that the listeners app.js attaches actually call
// saveCalcFormState() rather than just recalculate().
describe('persisted calculator inputs', () => {
  const STORAGE_KEY = 'sauce.calcForm.v1';

  // persist.js's NUMBER_FIELDS/SELECT_FIELDS is a hand-maintained match to
  // #calc-form's actual controls, not derived from them — a control added to
  // the form with no matching entry there just silently never persists, with
  // nothing else in the suite positioned to notice. This is the coupling
  // test that stands in for deriving the list structurally.
  it('persists every control #calc-form actually has, and nothing extra', () => {
    setValue('in-malto', '2000'); // force a save — nothing is written on load alone
    const formIds = [...document.getElementById('calc-form').elements]
      .map((el) => el.id).filter(Boolean);
    const saved = Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    expect(saved.sort()).toEqual(formIds.sort());
  });

  it('restores a saved batch before the first render', async () => {
    // in-cap is cleared too, so maltodextrin decides the batch rather than
    // the container limit. At the default 1814 g on hand, maltodextrin
    // itself is the limiting ingredient and the card reads exactly 1814 g.
    // At 5000 g it exceeds what the on-hand fructose can match at the tested
    // ratio, so fructose takes over as the limit and the card settles lower
    // — but still above 1814 g. That's only reachable if the restored value
    // was in the input *before* init()'s first recalculate(), not just
    // sitting in the field waiting for a change event that never fires on
    // page load.
    const w = await loadApp({
      seedLocalStorage: { [STORAGE_KEY]: JSON.stringify({ 'in-malto': '5000', 'in-cap': '' }) },
    });
    const maltoCard = w.document.querySelector('#recipe-grid .card');
    expect(maltoCard.querySelector('.card__eyebrow').textContent).toMatch(/Maltodextrin/);
    expect(parseFloat(maltoCard.querySelector('.card__value').textContent)).toBeGreaterThan(1814);
  });

  it('restores a saved value across every field, not just one', async () => {
    await loadApp({
      seedLocalStorage: {
        [STORAGE_KEY]: JSON.stringify({ 'in-malto': '2222', 'in-salt-profile': 'hot', 'in-target-carbs': '90' }),
      },
    });
    expect($('in-malto').value).toBe('2222');
    expect($('in-salt-profile').value).toBe('hot');
    expect($('in-target-carbs').value).toBe('90');
  });

  it('does not let a saved flavoring get stamped over by the select default', async () => {
    // initFlavorPresets() hardcodes the select to 'strawberry' while building
    // its options. Restoring has to run after that, or a saved non-default
    // flavoring would be silently overwritten the moment the page loads.
    await loadApp({
      seedLocalStorage: { [STORAGE_KEY]: JSON.stringify({ 'in-flavor-preset': 'unflavored' }) },
    });
    expect($('in-flavor-preset').value).toBe('unflavored');
    expect($('fp-flavor-name').textContent).not.toMatch(/strawberry/i);
  });

  it('falls back to the markup defaults when nothing is saved', async () => {
    await loadApp();
    expect($('in-malto').value).toBe('1814');
  });

  it('falls back to the markup defaults when the saved record is corrupt', async () => {
    await loadApp({ seedLocalStorage: { [STORAGE_KEY]: '{not json' } });
    expect($('in-malto').value).toBe('1814');
  });

  it('saves a change made through the wired-up form', () => {
    setValue('in-malto', '3300');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved['in-malto']).toBe('3300');
  });

  it('saves a change made through the salt profile select', () => {
    setValue('in-salt-profile', 'hot', 'change');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved['in-salt-profile']).toBe('hot');
  });

  it('a later save does not resurrect an earlier value for a field that changed', () => {
    setValue('in-malto', '1000');
    setValue('in-malto', '2000');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved['in-malto']).toBe('2000');
  });

  // The round trip that actually matters: what a real second visit does.
  it('round-trips a change across a reload', async () => {
    setValue('in-malto', '4200');
    setValue('in-salt-profile', 'hot', 'change');
    const saved = localStorage.getItem(STORAGE_KEY);

    const w = await loadApp({ seedLocalStorage: { [STORAGE_KEY]: saved } });
    expect(w.document.getElementById('in-malto').value).toBe('4200');
    expect(w.document.getElementById('in-salt-profile').value).toBe('hot');
  });
});

// The select's options are now built from SALT_PROFILES by initSaltProfiles()
// (mirroring initFlavorPresets()), so the two can no longer drift apart
// through markup edits — but readInputs() still guards the value it actually
// consumes, the same way findFlavoring(...) ?? FLAVORINGS[0] does for
// flavoring. That guard is what these tests hold in place: it has to keep
// working for a value that reaches the select some other way (an in-flight
// tab that hasn't reloaded since a profile was renamed, or persist.js
// restoring a stale record), and it has to reject a prototype-chain name the
// same way share.js's identical guard does. Both tests bypass persist.js and
// set the select directly, so they're exercising readInputs() itself, not
// persist.js's already-covered validation.
describe('an unrecognised salt profile does not blank the page', () => {
  // dispatchEvent() does not rethrow a listener's exception synchronously —
  // jsdom (like a real browser) reports it as an uncaught exception on window
  // instead, so try/catch around dispatchEvent can never see it. window's own
  // 'error' event is the reliable way to detect it directly, rather than
  // inferring a throw indirectly from stale render output.
  function selectUnrecognisedProfile(value) {
    let uncaught = null;
    window.addEventListener('error', (e) => { uncaught = e.error ?? e.message; });
    const select = $('in-salt-profile');
    select.innerHTML += `<option value="${value}">${value}</option>`;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return uncaught;
  }

  it('falls back rather than throwing when the select holds a value SALT_PROFILES does not define', () => {
    expect(selectUnrecognisedProfile('experimental')).toBeNull();
    // Not just "didn't throw" — the note and the sodium figure it explains
    // have to agree on which profile was actually used. An earlier version
    // of this fallback resolved the select's value in readInputs() but left
    // renderSaltNote() resolving it separately: readInputs() fell back to
    // 'endurance' and computed endurance sodium, while renderSaltNote() saw
    // the same unrecognised value, found no match, and blanked the note — a
    // page that rendered fine but silently mismatched what it displayed
    // against what it computed, for the one figure this tool is most
    // careful about being right. Checking the note names the profile
    // specifically, not just that it's non-empty, is what would catch a
    // regression to that state.
    expect($('salt-profile-note').textContent).toContain(SALT_PROFILES.endurance.note);
    expect(parseFloat($('fp-batch').textContent)).toBeGreaterThan(0);
    expect($('calc-limiting').textContent.trim()).not.toBe('');
  });

  // `hasOwnProperty`, not `in` — `in` walks the prototype chain, so
  // SALT_PROFILES['constructor'] is truthy (Object.prototype.constructor)
  // with an undefined .ratio, which renders "undefined" into the note and
  // 0 mg sodium rather than falling back. share.js has the identical guard
  // for the identical reason; this pins it at the second live call site.
  it('rejects a prototype-chain property name rather than treating it as a match', () => {
    expect(selectUnrecognisedProfile('constructor')).toBeNull();
    expect($('salt-profile-note').textContent).toContain(SALT_PROFILES.endurance.note);
    expect($('fp-sodium').textContent).not.toMatch(/undefined|NaN/);
  });
});

describe('fructose ratio readout', () => {
  it.each([
    [0, /glucose only/i],
    [0.3, /below the optimal/i],
    [0.8, /optimal band/i],
    [1.5, /above the optimal/i],
  ])('describes a ratio of %s', (ratio, expected) => {
    setValue('in-carb-ratio', ratio);
    expect($('ratio-readout').textContent).toMatch(expected);
  });

  it('states the glucose:fructose shape once there is fructose', () => {
    setValue('in-carb-ratio', 0.5);
    expect($('ratio-readout').textContent).toMatch(/2\.00:1 glucose:fructose/);
  });
});

describe('per-bottle flavourings', () => {
  const perBottle = FLAVORINGS.find((f) => f.perBottle);

  it('explains that they go in the bottle, not the jar', () => {
    setValue('in-flavor-preset', perBottle.id, 'change');
    expect($('flavor-per-bottle').hidden).toBe(false);
    expect($('flavor-per-bottle').textContent).toMatch(/bottle, not the jar/i);
  });

  // Must switch *to* a per-bottle flavouring first. The note starts hidden in
  // the markup and the default flavouring goes in the jar, so asserting
  // straight from a fresh load passes with the hiding branch deleted — which
  // is the branch that matters: pick citrus, change your mind, and the note
  // would otherwise stay on screen contradicting the recipe beside it.
  it('hides the note again when switching back to a batch flavouring', () => {
    setValue('in-flavor-preset', perBottle.id, 'change');
    expect($('flavor-per-bottle').hidden).toBe(false);

    const inJar = FLAVORINGS.find((f) => !f.perBottle);
    setValue('in-flavor-preset', inJar.id, 'change');
    expect($('flavor-per-bottle').hidden).toBe(true);
  });

  // recalculate() resolves the flavor select exactly once and threads it
  // into readInputs(), renderRecipeGrid() and renderCost(). Before #16,
  // renderRecipeGrid() re-resolved it independently with no `?? FLAVORINGS[0]`
  // fallback, unlike the other two call sites — invisible under the real
  // FLAVORINGS order, because strawberry (index 0, the fallback for an
  // unrecognised value everywhere) isn't perBottle either, so the buggy and
  // fixed code produce identical output there. The bug only shows up if
  // FLAVORINGS[0] *is* perBottle, which is why this mocks the module rather
  // than asserting against the real array: a test that can only fail when
  // production data happens to be reordered a specific way isn't testing the
  // wiring, it's testing data/flavorings.js's current ordering. Confirmed
  // the real-array version doesn't discriminate at all — it passed against
  // the pre-#16 code too, for exactly this reason — which is why it's mocked.
  it('resolves an unrecognised flavoring the same way everywhere, not just in the facts panel', async () => {
    vi.doMock('../data/flavorings.js', async () => {
      const actual = await vi.importActual('../data/flavorings.js');
      const reordered = [...actual.FLAVORINGS].sort((a, b) => (b.perBottle ? 1 : 0) - (a.perBottle ? 1 : 0));
      return { ...actual, FLAVORINGS: reordered, findFlavoring: (id) => reordered.find((f) => f.id === id) };
    });
    try {
      const w = await loadApp();
      // From the mocked module, not the real top-level FLAVORINGS import —
      // the two happen to agree (Array#sort is stable, so the first
      // perBottle entry in declaration order is always reordered[0]), but
      // asserting against the mock's own order is what this test is
      // actually about, not a coincidence borrowed from the real one.
      const fallback = (await import('../data/flavorings.js')).FLAVORINGS[0];
      expect(fallback?.perBottle).toBe(true);

      // dispatchEvent() does not rethrow synchronously (see the salt-profile
      // tests above), so a throw anywhere in the render chain has to be
      // caught this way or not at all. Not redundant with the priceBasis
      // assertion below, which only catches a throw early enough to leave
      // #cost-note holding stale text (a throw in renderCost() itself does,
      // since it's read before that text is rewritten — but updateRidePlanner
      // is the last call in recalculate(), after every other assertion here
      // has already passed, and nothing checks its output).
      let uncaught = null;
      w.addEventListener('error', (e) => { uncaught = e.error ?? e.message; });

      // The default flavoring is the markup literal 'strawberry'
      // (initFlavorPresets()), not FLAVORINGS[0] — so even under the mocked,
      // perBottle-led order, the initial render is still strawberry and the
      // note starts hidden. Pinning that is what makes "hidden === false"
      // below a real assertion: if that default ever became positional, the
      // note would already be visible before the select changes, and this
      // test would stop being able to tell the fix from the bug it replaced.
      expect($('flavor-per-bottle').hidden).toBe(true);

      const select = $('in-flavor-preset');
      select.innerHTML += '<option value="unrecognised">Unrecognised</option>';
      select.value = 'unrecognised';
      select.dispatchEvent(new Event('change', { bubbles: true }));

      expect(uncaught).toBeNull();
      expect($('fp-flavor-name').textContent).toBe(fallback.name);
      const flavoringCard = [...document.querySelectorAll('#recipe-grid .card')]
        .find((c) => c.querySelector('.card__eyebrow').textContent.includes(fallback.name));
      expect(flavoringCard).toBeDefined();
      expect($('flavor-per-bottle').hidden).toBe(false);
      expect($('flavor-per-bottle').textContent).toContain(fallback.name);
      // Not just non-empty — #cost-note holds text from the initial render
      // regardless of whether this update ran, so a throw inside renderCost()
      // wouldn't blank it. Naming the fallback's own priceBasis is the one
      // assertion that can only pass if renderCost() actually priced the
      // batch using the same flavoring the other two panels are showing.
      expect($('cost-note').textContent).toContain(fallback.priceBasis);
    } finally {
      vi.doUnmock('../data/flavorings.js');
    }
  });
});

describe('populated controls and lists', () => {
  it('offers every flavouring in the dropdown', () => {
    const ids = [...$('in-flavor-preset').options].map((o) => o.value);
    expect(ids).toEqual(FLAVORINGS.map((f) => f.id));
  });

  // Built by initSaltProfiles() from SALT_PROFILES rather than hand-written
  // in index.html, precisely so this can never drift — a value that's a live
  // option but isn't a SALT_PROFILES key used to be reachable through a
  // hand-maintained markup list and threw inside ratiosFor(), then (after
  // that got a fallback) rendered silently at the wrong salt level. This
  // pins that the two are identical, not just that neither currently throws.
  it('offers exactly the salt profiles SALT_PROFILES defines', () => {
    const ids = [...$('in-salt-profile').options].map((o) => o.value);
    expect(ids).toEqual(Object.keys(SALT_PROFILES));
  });

  it('renders every troubleshooting entry', () => {
    expect($('tuning-list').querySelectorAll('details.tuning-item')).toHaveLength(TUNING.length);
  });

  // Asked for explicitly: the section must land fully collapsed.
  it('leaves every troubleshooting entry closed', () => {
    const open = [...$('tuning-list').querySelectorAll('details')].filter((d) => d.open);
    expect(open).toEqual([]);
  });

  it('fills the bottle planner selects', () => {
    const empty = ['in-intensity', 'in-weather', 'in-bottle']
      .filter((id) => $(id).options.length === 0);
    expect(empty).toEqual([]);
  });

  it('offers every label size', () => {
    const ids = [...$('in-label-size').options].map((o) => o.value);
    expect(ids).toEqual(LABEL_SIZES.map((s) => s.id));
  });

  // Pins the value the page lands on, so a reorder in data/*.js can't silently
  // change it. 'moderate' is not first in INTENSITIES, so that one also proves
  // the explicit assignment survives; the other two coincide with the first
  // option today and would not.
  it.each([
    ['in-flavor-preset', 'strawberry'],
    ['in-label-size', '3x4'],
    ['in-intensity', 'moderate'],
  ])('defaults %s to %s', (id, expected) => {
    expect($(id).value).toBe(expected);
  });

  // Split across two grids: consumables and the kit to measure them with.
  // Asserting the total catches a product silently landing in neither.
  it('renders every product across the two grids', () => {
    const cards = $('products-grid').querySelectorAll('.card').length
      + $('equipment-grid').querySelectorAll('.card').length;
    expect(cards).toBe(PRODUCTS.length);
  });

  it('sorts equipment away from ingredients', () => {
    expect($('equipment-grid').querySelectorAll('.card')).toHaveLength(
      PRODUCTS.filter((p) => p.kind === 'equipment').length,
    );
  });
});

describe('affiliate obligations', () => {
  const amazonLinks = () => [...document.querySelectorAll('#products-grid a[href], #equipment-grid a[href]')]
    .filter((a) => a.href.includes('amazon.'));

  it('tags every Amazon link with the site associates id', () => {
    const links = amazonLinks();
    expect(links.length).toBeGreaterThan(0);
    const untagged = links.filter((a) => !a.href.includes(`tag=${ASSOCIATES_TAG}`));
    expect(untagged.map((a) => a.href)).toEqual([]);
  });

  // rel="sponsored" is the disclosure a crawler reads, the same way the
  // sentence below is the one a person reads.
  it('marks them sponsored and keeps them out of the current tab', () => {
    const wrong = amazonLinks().filter((a) => !a.rel.includes('sponsored') || !a.rel.includes('noopener'));
    expect(wrong.map((a) => a.href)).toEqual([]);
  });

  // The Operating Agreement requires the disclosure, and it has to sit beside
  // the links rather than in the footer, where it once read "these are
  // affiliate links" with no links anywhere near it.
  it('keeps the disclosure inside the panel holding the links', () => {
    const panel = $('buy');
    expect(panel.contains($('products-grid'))).toBe(true);
    expect(panel.textContent).toMatch(/as an Amazon Associate/i);
  });
});

describe('cost panel', () => {
  it('states the intake its hourly figures assume', () => {
    setValue('in-target-carbs', 85);
    expect($('cost-basis').textContent).toMatch(/85 g carbs\/hr/);
  });

  // A comparison that only lists the competition's drawbacks is advertising.
  it('gives every product a catch, including the homemade one', () => {
    const cards = [...$('cost-grid').querySelectorAll('.card')];
    expect(cards.length).toBeGreaterThan(1);
    const missing = cards.filter((c) => !c.querySelector('.cost-card__limitation')?.textContent.trim());
    expect(missing).toEqual([]);
  });

  it('marks the homemade mix as the active card', () => {
    expect($('cost-grid').querySelectorAll('.card--active')).toHaveLength(1);
  });
});

// The populated-regions check proves the label renders. It does not prove each
// cell renders its own number — swapping carbs for sugars leaves every cell
// non-empty. Wiring is exactly what this file exists to cover.
describe('label cells carry their own values', () => {
  // Deliberately off 75, the markup default. Asserting at the default proves
  // nothing: a cell hardcoded to whatever the page happens to render on load
  // satisfies every comparison here.
  const OFF_DEFAULT_TARGET = 100;

  it('matches the facts panel, which is fed from the same serving', () => {
    setValue('in-target-carbs', OFF_DEFAULT_TARGET);
    expect(parseFloat($('lb-serving').textContent)).toBeCloseTo(parseFloat($('fp-serving-size').textContent), 0);
    expect(parseFloat($('lb-carbs').textContent)).toBeCloseTo(parseFloat($('fp-carbs').textContent), 0);
    expect(parseFloat($('lb-sugars').textContent)).toBeCloseTo(parseFloat($('fp-sugars').textContent), 0);
    expect(parseFloat($('lb-sodium').textContent)).toBeCloseTo(parseFloat($('fp-sodium').textContent), 0);
    expect(parseFloat($('lb-calories').textContent)).toBeCloseTo(parseFloat($('fp-calories').textContent), 0);
  });

  // Servings per container is hours of fuelling, so it has to be the batch
  // divided by an hour's worth. Left out of the cross-check above, it was
  // pinned only by being non-empty — a constant passed just as well.
  it('states servings per container as hours the batch lasts', () => {
    setValue('in-target-carbs', OFF_DEFAULT_TARGET);
    const batch = parseFloat($('fp-batch').textContent);
    const perHour = parseFloat($('lb-serving').textContent);
    // Both sides are rendered already rounded, so allow a full unit rather
    // than pretending to more precision than the label shows.
    expect(Math.abs(parseFloat($('lb-servings').textContent) - batch / perHour)).toBeLessThanOrEqual(1);
  });

  it('tracks the hourly carb target', () => {
    setValue('in-target-carbs', 60);
    const at60 = parseFloat($('lb-carbs').textContent);
    setValue('in-target-carbs', 120);
    expect(parseFloat($('lb-carbs').textContent) / at60).toBeCloseTo(2, 1);
  });

  it('moves sodium with the salt profile, leaving carbs alone', () => {
    setValue('in-salt-profile', 'moderate', 'change');
    const mild = { sodium: parseFloat($('lb-sodium').textContent), carbs: parseFloat($('lb-carbs').textContent) };
    setValue('in-salt-profile', 'hot', 'change');
    expect(parseFloat($('lb-sodium').textContent)).toBeGreaterThan(mild.sodium);
    expect(parseFloat($('lb-carbs').textContent)).toBeCloseTo(mild.carbs, 0);
  });

  // Food labels list ingredients by descending weight, and the order is
  // derived rather than hardcoded because the ratio can genuinely reorder it.
  // Asserting only the default is worthless: there, insertion order already
  // matches descending weight, so the assertion holds with the sort deleted.
  // A fructose-heavy ratio is the case that actually exercises it.
  it('lists ingredients by descending weight, not declaration order', () => {
    const listed = () => $('lb-ingredients').textContent.split(',').map((s) => s.trim());

    setValue('in-carb-ratio', 0.5);
    expect(listed()[0]).toBe('Maltodextrin');

    setValue('in-carb-ratio', 1.5);
    expect(listed()[0]).toBe('Fructose');
    expect(listed()[1]).toBe('Maltodextrin');
  });

  it('drops ingredients the batch does not contain', () => {
    setValue('in-carb-ratio', 0);
    expect($('lb-ingredients').textContent).not.toMatch(/Fructose/);
    expect($('lb-ingredients').textContent).toMatch(/Maltodextrin/);
  });
});

describe('label format', () => {
  const wide = LABEL_SIZES.find((s) => s.wide);
  const tall = LABEL_SIZES.find((s) => !s.wide);

  // The wrap-a-tub format is a two-column rearrangement, not just a wider
  // sheet, and the class is what switches it. Nothing else exercised
  // applyLabelSize past init, so the whole branch was unpinned.
  it('switches to the two-column layout for a wide format', () => {
    setValue('in-label-size', wide.id, 'change');
    expect($('label-sheet').classList.contains('label-sheet--wide')).toBe(true);
    expect($('label-size-note').textContent).toMatch(/landscape/i);
  });

  // Removing the class is the half that breaks on its own.
  it('switches back for a tall format', () => {
    setValue('in-label-size', wide.id, 'change');
    setValue('in-label-size', tall.id, 'change');
    expect($('label-sheet').classList.contains('label-sheet--wide')).toBe(false);
    expect($('label-size-note').textContent).toMatch(/prints at/i);
  });

  // Sized from the wide format, not the default — asserting the default holds
  // at init and so would pass without the change handler doing anything.
  it('sizes the sheet from the chosen format', () => {
    setValue('in-label-size', wide.id, 'change');
    expect($('label-sheet').style.width).toBe(`${wide.widthIn}in`);
    expect($('label-sheet').style.height).toBe(`${wide.heightIn}in`);
  });
});

describe('optional label fields', () => {
  // Same failure mode as the per-bottle note: an element that has to disappear
  // again when its input is cleared. Assert it visible first, or the hiding
  // branch can be deleted unnoticed.
  it('shows and re-hides the note', () => {
    setValue('in-label-note', 'Made for the Saturday ride');
    expect($('lb-note').hidden).toBe(false);
    expect($('lb-note').textContent).toMatch(/Saturday ride/);

    setValue('in-label-note', '');
    expect($('lb-note').hidden).toBe(true);
  });

  it('carries the free-text fields onto the sheet', () => {
    setValue('in-label-name', 'Rocket Fuel');
    setValue('in-label-flavor', 'Lime');
    setValue('in-label-maker', 'Mike');
    expect($('lb-name').textContent).toBe('Rocket Fuel');
    expect($('lb-flavor').textContent).toBe('Lime');
    expect($('lb-maker').textContent).toBe('Mike');
  });

  it('falls back to a product name when the field is empty', () => {
    setValue('in-label-name', '');
    expect($('lb-name').textContent).toBe('The Sauce');
  });

  it('stamps the batch date', () => {
    setValue('in-label-date', '2026-03-09');
    expect($('lb-batch').textContent).toMatch(/20260309/);
  });

  // Scoop size changes no calculation — the directions line is its only
  // consumer, and grams stay the unit everywhere else. Giving a scoop size
  // adds the conversion; leaving it blank must drop it rather than print
  // "about 0 scoops".
  const scoopCount = () => parseFloat($('lb-directions').textContent.match(/about ([\d.]+) scoops/)[1]);

  it('converts to scoops only when a scoop size is given', () => {
    setValue('in-scoop', 46);
    expect($('lb-directions').textContent).toMatch(/scoops/);

    setValue('in-scoop', '');
    expect($('lb-directions').textContent).not.toMatch(/scoops/);
    expect($('lb-directions').textContent).toMatch(/Add powder to water/);
  });

  // The count, not just the branch. This is the exact number the missing
  // in-scoop listener was leaving stale, and asserting only that the word
  // "scoops" appears passes with the count replaced by a constant.
  // Tolerances are loose on purpose: both the count and the serving grams are
  // read back already rounded for display, so doubling one rounded figure and
  // comparing it to the rounding of the doubled figure can legitimately differ
  // by a tenth. Tight tolerances here would fail on an unrelated default
  // changing, and blame the scoop count for it.
  it('prints a scoop count that follows the scoop size', () => {
    setValue('in-scoop', 46);
    const big = scoopCount();
    setValue('in-scoop', 23);
    expect(scoopCount()).toBeCloseTo(big * 2, 0);
  });

  it('divides an hour of mix by the scoop size', () => {
    setValue('in-scoop', 25);
    expect(scoopCount()).toBeCloseTo(parseFloat($('lb-serving').textContent) / 25, 0);
  });

  // Grams are the unit: the scoop conversion is for the directions line only.
  // Asserting the facts panel alone can't tell "unaffected" from "nothing
  // re-rendered", so check the directions did move in the same breath.
  it('leaves the facts panel in grams regardless of scoop size', () => {
    setValue('in-scoop', 46);
    const before = { serving: $('fp-serving-size').textContent, directions: $('lb-directions').textContent };
    setValue('in-scoop', 12);
    expect($('fp-serving-size').textContent).toBe(before.serving);
    expect($('lb-directions').textContent).not.toBe(before.directions);
  });
});

// The only security-relevant branch in app.js, and the accept attribute on the
// input is a hint rather than a control — these checks are the control. SVG is
// deliberately outside the allowlist because it can carry script, and artwork
// is read to a data URL rather than uploaded because there is no server.
describe('label artwork validation', () => {
  const drop = (file) => {
    const input = $('in-label-art');
    Object.defineProperty(input, 'files', { value: file ? [file] : [], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  // A real File, not a stub: the accepted paths hand it to FileReader, and a
  // plain object silently takes the onerror branch instead.
  const fakeFile = (name, type, size) => new window.File([new Uint8Array(size)], name, { type });

  /** Load a good image and wait for FileReader, so the artwork is on screen. */
  const dropValid = async () => {
    drop(fakeFile('logo.png', 'image/png', 1024));
    await vi.waitFor(() => expect($('lb-art-wrap').hidden).toBe(false));
  };

  it('accepts a png and keeps it in the browser', async () => {
    await dropValid();
    expect($('art-status').textContent).toMatch(/stays in your browser/i);
    expect($('lb-art').getAttribute('src')).toMatch(/^data:/);
  });

  // Each rejection must run from a state where artwork is *showing*.
  // #lb-art-wrap starts hidden in the markup, so asserting straight from a
  // fresh load passes with the branch's `wrap.hidden = true` deleted — which
  // is the line that takes stale artwork back off the sheet.
  it('rejects svg, which can carry script, and clears the sheet', async () => {
    await dropValid();
    drop(fakeFile('evil.svg', 'image/svg+xml', 512));
    expect($('lb-art-wrap').hidden).toBe(true);
    expect($('art-status').textContent).toMatch(/not supported/i);
  });

  it('rejects an image over the size cap and clears the sheet', async () => {
    await dropValid();
    drop(fakeFile('huge.png', 'image/png', 3 * 1024 * 1024));
    expect($('lb-art-wrap').hidden).toBe(true);
    expect($('art-status').textContent).toMatch(/under 2 MB/i);
  });

  it('accepts a file right at the cap', async () => {
    drop(fakeFile('exact.png', 'image/png', 2 * 1024 * 1024));
    await vi.waitFor(() => expect($('lb-art-wrap').hidden).toBe(false));
  });

  // Clearing the file input is the third copy of the same reset, and the only
  // one that also drops the src attribute.
  it('clears the artwork when the input is emptied', async () => {
    await dropValid();
    drop(null);
    expect($('lb-art-wrap').hidden).toBe(true);
    expect($('lb-art').getAttribute('src')).toBeNull();
    expect($('art-status').textContent).toMatch(/never uploaded/i);
  });
});

describe('the bottle planner follows the batch on screen', () => {
  // It used to assume the standard mix, which made sense when it was a
  // separate page with no access to the batch and stopped making sense once
  // both were on one page. recalculate() passes recipe.perGram in; without
  // that call it silently falls back to baseRecipeProfile() and quietly
  // stops reflecting the recipe above it.
  it('changes its answer when the recipe changes', () => {
    const before = $('ride-answer').textContent;
    setValue('in-carb-ratio', 0.2);
    expect($('ride-answer').textContent).not.toBe(before);
  });

  it('changes its answer when the salt level changes', () => {
    const before = $('ride-answer').textContent;
    setValue('in-salt-profile', 'hot', 'change');
    expect($('ride-answer').textContent).not.toBe(before);
  });

  it('re-answers when a planner input changes', () => {
    const before = $('ride-answer').textContent;
    setValue('in-duration', 6);
    expect($('ride-answer').textContent).not.toBe(before);
  });
});

describe('disclosure animation', () => {
  const click = (panel) => panel.querySelector(':scope > summary').dispatchEvent(
    new window.MouseEvent('click', { bubbles: true, cancelable: true }),
  );
  // The animation runs for 300ms and clears the flag on a timeout. Waiting
  // for the flag rather than the clock keeps this off a wall-clock assumption
  // on a loaded CI runner.
  const settle = (panel) => vi.waitFor(() => expect(panel.dataset.animating).toBe(''));

  // jsdom toggles <details> natively on a summary click, so asserting `open`
  // would pass with src/disclosure.js unwired. The animating flag and the
  // driven inline height are things only disclosure.js does.
  it('drives the panel body rather than leaving it to the browser', () => {
    const panel = $('cost');
    expect(panel.open).toBe(false);
    click(panel);
    expect(panel.dataset.animating).toBe('1');
    expect(panel.querySelector(':scope > .panel__body').style.height).not.toBe('');
    expect(panel.open).toBe(true);
  });

  it('cleans up after opening', async () => {
    const panel = $('cost');
    click(panel);
    await settle(panel);
    expect(panel.open).toBe(true);
    expect(panel.dataset.animating).toBe('');
    expect(panel.querySelector(':scope > .panel__body').style.height).toBe('');
  });

  // Closing is the half that can break on its own: the collapse is animated
  // first and `open` is cleared in the completion callback, so losing that
  // callback gives a panel that animates shut and springs back open.
  it('closes again on a second click', async () => {
    const panel = $('cost');
    click(panel);
    await settle(panel);
    click(panel);
    await settle(panel);
    expect(panel.open).toBe(false);
    expect(panel.dataset.animating).toBe('');
  });

  it('ignores a click while an animation is running', () => {
    const panel = $('cost');
    click(panel);
    expect(panel.open).toBe(true);
    click(panel);
    expect(panel.open).toBe(true);
  });
});

describe('anchors into collapsed panels', () => {
  it('opens a collapsed panel named in the url hash', async () => {
    await loadApp({ hash: '#cost' });
    expect($('cost').open).toBe(true);
  });

  it('leaves other panels closed', async () => {
    await loadApp({ hash: '#cost' });
    expect($('research').open).toBe(false);
  });

  it('lands with no hash and every collapsible panel closed', () => {
    const open = [...document.querySelectorAll('main > details.panel')].filter((d) => d.open);
    expect(open).toEqual([]);
  });

  // Navigating to an anchor after load is the separate path — same function,
  // reached through the hashchange listener rather than through init().
  it('opens a panel when the hash changes after load', async () => {
    expect($('research').open).toBe(false);
    window.location.hash = '#research';
    await new Promise((r) => setTimeout(r, 0));
    expect($('research').open).toBe(true);
  });
});
