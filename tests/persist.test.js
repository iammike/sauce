// @vitest-environment jsdom
//
// persist.js reads/writes real DOM inputs and real localStorage, so it needs
// a DOM the way ride-app.js and app.js do — this file is the exception to
// the rest of tests/, which stays on environment: 'node'.
//
// The fields under test are built by hand rather than loaded from
// index.html: persist.js only touches nine specific ids, and a hand-built
// fixture makes it obvious exactly which ones a test is exercising. The
// full-page wiring (restore running before the first render, save firing on
// input) is covered separately in tests/app-dom.test.js.
//
// The number inputs are genuinely type="number", matching index.html, not
// the untyped (so text) inputs an earlier version of this fixture used.
// That distinction is load-bearing: a type="number" input silently blanks
// itself if assigned a string its value-sanitization algorithm rejects —
// leading whitespace, hex notation, a bare trailing "." — even when
// Number() parses that same string fine. A text-input fixture can't see a
// bug that only exists on the real element type.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'sauce.calcForm.v1';

const FIELDS = {
  'in-malto': { min: '0', step: '1', value: '1814' },
  'in-fructose': { min: '0', step: '1', value: '1361' },
  'in-sucrose': { min: '0', step: '1', value: '1814' },
  'in-carb-base': { tag: 'select', options: ['malto-fructose', 'sucrose'], value: 'malto-fructose' },
  'in-flavor-preset': { tag: 'select', options: ['strawberry', 'unflavored'], value: 'strawberry' },
  'in-flavoring': { min: '0', step: '1', value: '499' },
  'in-salt': { min: '0', step: '1', value: '397' },
  'in-salt-profile': { tag: 'select', options: ['moderate', 'endurance', 'hot'], value: 'endurance' },
  'in-cap': { min: '0', step: '1', value: '1900' },
  'in-target-carbs': { min: '10', max: '200', step: '5', value: '75' },
  'in-carb-ratio': { min: '0', max: '1.5', step: '0.05', value: '0.8' },
};

function buildFixture() {
  for (const [id, spec] of Object.entries(FIELDS)) {
    const el = document.createElement(spec.tag === 'select' ? 'select' : 'input');
    el.id = id;
    if (spec.tag === 'select') {
      el.innerHTML = spec.options.map((o) => `<option value="${o}">${o}</option>`).join('');
    } else {
      el.type = 'number';
      if (spec.min !== undefined) el.min = spec.min;
      if (spec.max !== undefined) el.max = spec.max;
      if (spec.step !== undefined) el.step = spec.step;
    }
    el.value = spec.value;
    document.body.appendChild(el);
  }
}

const $ = (id) => document.getElementById(id);

beforeEach(async () => {
  document.body.innerHTML = '';
  localStorage.clear();
  buildFixture();
  // Fresh module instance so no import-time state survives across tests.
  await vi.resetModules();
});

async function loadPersist() {
  return import('../src/persist.js');
}

describe('saveCalcFormState', () => {
  it('writes every field to localStorage', async () => {
    const { saveCalcFormState } = await loadPersist();
    saveCalcFormState();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved).toMatchObject({
      'in-malto': '1814',
      'in-fructose': '1361',
      'in-flavor-preset': 'strawberry',
      'in-flavoring': '499',
      'in-salt': '397',
      'in-salt-profile': 'endurance',
      'in-cap': '1900',
      'in-target-carbs': '75',
      'in-carb-ratio': '0.8',
    });
  });

  it('captures a changed value, not the fixture default', async () => {
    const { saveCalcFormState } = await loadPersist();
    $('in-malto').value = '2500';
    saveCalcFormState();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))['in-malto']).toBe('2500');
  });

  it('does not throw when localStorage.setItem throws', async () => {
    const { saveCalcFormState } = await loadPersist();
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('quota exceeded'); };
    try {
      expect(() => saveCalcFormState()).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe('restoreCalcFormState', () => {
  it('does nothing when nothing is saved', async () => {
    const { restoreCalcFormState } = await loadPersist();
    restoreCalcFormState();
    expect($('in-malto').value).toBe('1814');
  });

  it('restores a saved value over the fixture default', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-malto': '3000' }));
    const { restoreCalcFormState } = await loadPersist();
    restoreCalcFormState();
    expect($('in-malto').value).toBe('3000');
  });

  it('restores a saved select value', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-salt-profile': 'hot' }));
    const { restoreCalcFormState } = await loadPersist();
    restoreCalcFormState();
    expect($('in-salt-profile').value).toBe('hot');
  });

  it('restores every field in one record', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      'in-malto': '2222', 'in-fructose': '1111', 'in-flavor-preset': 'unflavored',
      'in-flavoring': '50', 'in-salt': '80', 'in-salt-profile': 'hot',
      'in-cap': '2000', 'in-target-carbs': '90', 'in-carb-ratio': '0.7',
    }));
    const { restoreCalcFormState } = await loadPersist();
    restoreCalcFormState();
    expect($('in-malto').value).toBe('2222');
    expect($('in-fructose').value).toBe('1111');
    expect($('in-flavor-preset').value).toBe('unflavored');
    expect($('in-flavoring').value).toBe('50');
    expect($('in-salt').value).toBe('80');
    expect($('in-salt-profile').value).toBe('hot');
    expect($('in-cap').value).toBe('2000');
    expect($('in-target-carbs').value).toBe('90');
    expect($('in-carb-ratio').value).toBe('0.7');
  });

  // A type="number" input's value-sanitization algorithm accepts a narrower
  // syntax than Number() does. Assigning a string that parses fine but that
  // sanitizer rejects silently blanks the field — producing exactly the
  // 0-gram batch a rejected value was supposed to prevent, and doing it
  // silently, since the input just reads empty rather than erroring.
  describe('normalises a saved value the number-input sanitizer would otherwise reject', () => {
    it('surrounding whitespace', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-malto': ' 5000 ' }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-malto').value).toBe('5000');
    });

    it('a leading "+"', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-malto': '+500' }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-malto').value).toBe('500');
    });

    it('a bare trailing "."', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-malto': '500.' }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-malto').value).toBe('500');
    });

    it('hexadecimal notation', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-malto': '0x10' }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      // Number('0x10') is 16 — restoring the value Number() actually parsed,
      // not the original string, so the field ends up meaningful either way.
      expect($('in-malto').value).toBe('16');
    });

    it('never leaves the field blank for a value Number() could parse', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-malto': ' 5000 ' }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-malto').value).not.toBe('');
    });
  });

  it('preserves the empty "no limit" state of the batch cap', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-cap': '' }));
    $('in-cap').value = '1900';
    const { restoreCalcFormState } = await loadPersist();
    restoreCalcFormState();
    expect($('in-cap').value).toBe('');
  });

  // Every case below is a record that should NOT overwrite the fixture
  // default — a saved record is untrusted input, per persist.js's own
  // framing, the same way share.js treats a query string.
  describe('rejects and falls back to the existing value for', () => {
    it('garbage JSON', async () => {
      localStorage.setItem(STORAGE_KEY, '{not json');
      const { restoreCalcFormState } = await loadPersist();
      expect(() => restoreCalcFormState()).not.toThrow();
      expect($('in-malto').value).toBe('1814');
    });

    it('a JSON value that is not an object', async () => {
      localStorage.setItem(STORAGE_KEY, '"just a string"');
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-malto').value).toBe('1814');
    });

    it('a null JSON value', async () => {
      localStorage.setItem(STORAGE_KEY, 'null');
      const { restoreCalcFormState } = await loadPersist();
      expect(() => restoreCalcFormState()).not.toThrow();
      expect($('in-malto').value).toBe('1814');
    });

    it('a negative amount on hand', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-malto': '-50' }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-malto').value).toBe('1814');
    });

    it('a target above the 200 g/hr ceiling', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-target-carbs': '9999' }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-target-carbs').value).toBe('75');
    });

    it('a target below the 10 g/hr floor', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-target-carbs': '1' }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-target-carbs').value).toBe('75');
    });

    it('a fructose ratio above 1.5', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-carb-ratio': '3' }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-carb-ratio').value).toBe('0.8');
    });

    it('a value that was in range at module load but isn\'t any more', async () => {
      // Confirms bounds are read from the element at restore time, not
      // cached from whenever the module first evaluated an import.
      $('in-carb-ratio').max = '1.0';
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-carb-ratio': '1.3' }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-carb-ratio').value).toBe('0.8');
    });

    it('a non-numeric amount', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-malto': 'banana' }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-malto').value).toBe('1814');
    });

    // Number(null) and Number('') are both 0 — the exact trap share.js's own
    // regression test exists for. A blank/missing field must not silently
    // clamp to whatever floor the field has.
    it('an explicit null on a field with a nonzero minimum', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-target-carbs': null }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-target-carbs').value).toBe('75');
    });

    it('a blank string on a field that does not allow one', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-malto': '' }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-malto').value).toBe('1814');
    });

    it('a retired flavoring id', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-flavor-preset': 'lemon-powder-retired' }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-flavor-preset').value).toBe('strawberry');
    });

    it('an unknown salt profile', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-salt-profile': 'nuclear' }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-salt-profile').value).toBe('endurance');
    });

    // Object.keys/Array.includes rather than the `in` operator — confirm the
    // prototype-chain trap share.js's own comment warns about doesn't apply
    // here either.
    it('"constructor" and "__proto__" as select values', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        'in-salt-profile': 'constructor', 'in-flavor-preset': '__proto__',
      }));
      const { restoreCalcFormState } = await loadPersist();
      restoreCalcFormState();
      expect($('in-salt-profile').value).toBe('endurance');
      expect($('in-flavor-preset').value).toBe('strawberry');
    });

    it('an unrecognised field name, without disturbing known ones', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-nonexistent': '5', 'in-malto': '3000' }));
      const { restoreCalcFormState } = await loadPersist();
      expect(() => restoreCalcFormState()).not.toThrow();
      expect($('in-malto').value).toBe('3000');
    });
  });

  // Select values are validated against the live <option>s actually present
  // on the page, not against data/flavorings.js or calculator.js's
  // SALT_PROFILES directly — even though in production both selects' options
  // are themselves built from those exact data files, so the two always
  // agree there. Checking a model instead of the DOM would still be a latent
  // risk in this module specifically: an accepted-by-the-model-but-absent-
  // in-the-DOM value assigned to a <select> resolves to "", which throws
  // deeper in the render chain and blanks the whole page. This fixture
  // proves the acceptance genuinely comes from the element's own options —
  // including a value no real data file defines — not from a name persist.js
  // happens to recognise some other way.
  it('accepts a select value that exists in the DOM but not in any data file', async () => {
    // A value no real data file defines, proving acceptance comes from the
    // element's own options rather than a name recognised elsewhere.
    $('in-salt-profile').innerHTML += '<option value="experimental-batch">Experimental</option>';
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-salt-profile': 'experimental-batch' }));
    const { restoreCalcFormState } = await loadPersist();
    restoreCalcFormState();
    expect($('in-salt-profile').value).toBe('experimental-batch');
  });

  it('rejects a select value the DOM does not currently offer, even one that looks plausible', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-salt-profile': 'moderate-plus' }));
    const { restoreCalcFormState } = await loadPersist();
    restoreCalcFormState();
    expect($('in-salt-profile').value).toBe('endurance');
  });

  it('a bad field does not block the rest of the record from restoring', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      'in-malto': 'not a number', 'in-fructose': '5000',
    }));
    const { restoreCalcFormState } = await loadPersist();
    restoreCalcFormState();
    expect($('in-malto').value).toBe('1814');
    expect($('in-fructose').value).toBe('5000');
  });

  it('does not throw when localStorage.getItem throws', async () => {
    const { restoreCalcFormState } = await loadPersist();
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('access denied'); };
    try {
      expect(() => restoreCalcFormState()).not.toThrow();
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});

// Distinguishes "bounds are read from the DOM" from "bounds are hardcoded
// and happen to match the fixture" — a value inside a fixture's widened
// range but outside index.html's real range would pass either way, so this
// needs a bound the fixture's own attribute genuinely disagrees with the
// field's usual one, and a value that only one of the two would accept.
describe('number bounds are read from the element, not duplicated', () => {
  it('accepts a value only a raised max permits', async () => {
    $('in-carb-ratio').max = '3.0';
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-carb-ratio': '2.5' }));
    const { restoreCalcFormState } = await loadPersist();
    restoreCalcFormState();
    expect($('in-carb-ratio').value).toBe('2.5');
  });

  it('rejects a value only a lowered max would reject', async () => {
    $('in-target-carbs').max = '80';
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-target-carbs': '90' }));
    const { restoreCalcFormState } = await loadPersist();
    restoreCalcFormState();
    expect($('in-target-carbs').value).toBe('75');
  });

  it('has no bound at all when the element has no min/max attributes', async () => {
    $('in-malto').removeAttribute('min');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'in-malto': '-500' }));
    const { restoreCalcFormState } = await loadPersist();
    restoreCalcFormState();
    // Only proves the bound check was skipped, not that -500 is desirable —
    // the field still requires a well-formed finite number either way.
    expect($('in-malto').value).toBe('-500');
  });
});

describe('round trip', () => {
  it('a saved-then-restored value matches what was on screen', async () => {
    const { saveCalcFormState, restoreCalcFormState } = await loadPersist();
    $('in-malto').value = '2750';
    $('in-salt-profile').value = 'hot';
    saveCalcFormState();

    // A fresh page load: fields reset to their markup defaults, then restore
    // is expected to bring the saved values back.
    $('in-malto').value = '1814';
    $('in-salt-profile').value = 'endurance';
    restoreCalcFormState();

    expect($('in-malto').value).toBe('2750');
    expect($('in-salt-profile').value).toBe('hot');
  });

  // Documented in saveCalcFormState()'s comment as deliberate: save writes
  // whatever the browser allowed on screen, which includes typing past a
  // number input's max (the browser only enforces that at form submission,
  // and this form is never submitted). Validation lives in restore, so an
  // out-of-range edit reverts on the next visit instead of surviving as an
  // unvalidated saved value.
  it('does not round-trip a value that was on screen but out of range', async () => {
    const { saveCalcFormState, restoreCalcFormState } = await loadPersist();
    $('in-target-carbs').value = '250';
    saveCalcFormState();

    $('in-target-carbs').value = '75';
    restoreCalcFormState();

    expect($('in-target-carbs').value).toBe('75');
  });
});
