import { describe, it, expect } from 'vitest';
import {
  encodeFormulation,
  encodeLongForm,
  encodeToken,
  decodeToken,
  decodeFormulation,
  hasFormulation,
  DEFAULT_TARGET_CARBS,
  DEFAULT_FLAVORING_ID,
  DEFAULT_SALT_PROFILE,
} from '../src/share.js';
import { DEFAULT_CARB_RATIO } from '../src/calculator.js';
import { RECIPES } from '../data/recipes.js';

const FORMULATION = {
  carbRatio: 0.8,
  saltProfile: 'hot',
  flavoringId: 'unflavored',
  targetCarbsPerHour: 100,
};

describe('long-form encode/decode round trip', () => {
  it('preserves a formulation exactly', () => {
    expect(decodeFormulation(encodeLongForm(FORMULATION))).toEqual(FORMULATION);
  });

  it('tolerates a leading question mark', () => {
    expect(decodeFormulation('?' + encodeLongForm(FORMULATION))).toEqual(FORMULATION);
  });
});

describe('decodeFormulation treats the URL as untrusted', () => {
  it('falls back to defaults on an empty query string', () => {
    expect(decodeFormulation('')).toEqual({
      carbRatio: DEFAULT_CARB_RATIO,
      saltProfile: DEFAULT_SALT_PROFILE,
      flavoringId: DEFAULT_FLAVORING_ID,
      targetCarbsPerHour: DEFAULT_TARGET_CARBS,
    });
  });

  it('rejects an unknown salt profile rather than passing it through', () => {
    expect(decodeFormulation('s=notaprofile').saltProfile).toBe(DEFAULT_SALT_PROFILE);
  });

  it('rejects an unknown flavoring id', () => {
    expect(decodeFormulation('f=nope').flavoringId).toBe(DEFAULT_FLAVORING_ID);
  });

  it('does not let prototype keys pass as a salt profile', () => {
    // hasOwnProperty guard, not `in` — otherwise "constructor"/"toString" pass.
    expect(decodeFormulation('s=constructor').saltProfile).toBe(DEFAULT_SALT_PROFILE);
    expect(decodeFormulation('s=toString').saltProfile).toBe(DEFAULT_SALT_PROFILE);
    expect(decodeFormulation('s=__proto__').saltProfile).toBe(DEFAULT_SALT_PROFILE);
  });

  it('clamps out-of-range numbers instead of trusting them', () => {
    expect(decodeFormulation('r=99').carbRatio).toBe(1.5);
    expect(decodeFormulation('r=-5').carbRatio).toBe(0);
    expect(decodeFormulation('t=99999').targetCarbsPerHour).toBe(200);
    expect(decodeFormulation('t=0').targetCarbsPerHour).toBe(10);
  });

  it('falls back on non-numeric and NaN-ish input', () => {
    expect(decodeFormulation('r=abc').carbRatio).toBe(DEFAULT_CARB_RATIO);
    expect(decodeFormulation('r=NaN').carbRatio).toBe(DEFAULT_CARB_RATIO);
    expect(decodeFormulation('t=Infinity').targetCarbsPerHour).toBe(DEFAULT_TARGET_CARBS);
  });

  it('keeps the good params when one is malformed', () => {
    const result = decodeFormulation('r=0.8&s=garbage&f=unflavored&t=100');
    expect(result.carbRatio).toBe(0.8);
    expect(result.saltProfile).toBe(DEFAULT_SALT_PROFILE);
    expect(result.flavoringId).toBe('unflavored');
    expect(result.targetCarbsPerHour).toBe(100);
  });

  it('does not return script-ish strings for enum fields', () => {
    const result = decodeFormulation('s=<script>alert(1)</script>&f=<img onerror=x>');
    expect(result.saltProfile).toBe(DEFAULT_SALT_PROFILE);
    expect(result.flavoringId).toBe(DEFAULT_FLAVORING_ID);
  });
});

describe('hasFormulation', () => {
  it('detects recipe params', () => {
    expect(hasFormulation('r=0.65')).toBe(true);
    expect(hasFormulation('?s=hot')).toBe(true);
  });

  it('ignores unrelated query strings', () => {
    expect(hasFormulation('')).toBe(false);
    expect(hasFormulation('utm_source=strava')).toBe(false);
  });
});


describe('compact token', () => {
  it('round-trips every recipe preset', () => {
    for (const r of RECIPES) {
      const f = {
        carbRatio: r.carbRatio,
        saltProfile: r.saltProfile,
        flavoringId: r.flavoringId,
        targetCarbsPerHour: r.targetCarbsPerHour,
      };
      expect(decodeToken(encodeToken(f))).toEqual(f);
    }
  });

  it('round-trips arbitrary in-range formulations', () => {
    for (const carbRatio of [0, 0.5, 0.65, 0.8, 1.5]) {
      for (const saltProfile of ['moderate', 'endurance', 'hot']) {
        for (const targetCarbsPerHour of [10, 75, 110, 200]) {
          const f = { carbRatio, saltProfile, flavoringId: 'unflavored', targetCarbsPerHour };
          expect(decodeToken(encodeToken(f))).toEqual(f);
        }
      }
    }
  });

  it('stays short', () => {
    for (const r of RECIPES) {
      expect(encodeToken(r).length).toBeLessThanOrEqual(6);
    }
  });

  it('rejects a token from an unknown version', () => {
    expect(decodeToken('9zzz')).toBeNull();
  });

  it('rejects malformed tokens rather than guessing', () => {
    expect(decodeToken('')).toBeNull();
    expect(decodeToken(null)).toBeNull();
    expect(decodeToken('1')).toBeNull();
    expect(decodeToken('1!!!')).toBeNull();
    expect(decodeToken('1-5')).toBeNull();
  });

  it('rejects a tampered token that decodes out of range', () => {
    expect(decodeToken('1zzzzzzz')).toBeNull();
  });

  it('is stable — a token minted today must keep decoding the same', () => {
    // Frozen expectations, computed by hand from the packing above:
    //   r=13, s=1, f=0, t=13 -> 13 + 31*(1 + 8*(0 + 32*13)) = 103212 -> '27n0'
    // If these fail, the packing changed and every link already shared has
    // silently started meaning something else. Bump TOKEN_VERSION instead.
    expect(encodeToken({ carbRatio: 0.65, saltProfile: 'endurance', flavoringId: 'strawberry', targetCarbsPerHour: 75 })).toBe('127n0');
    expect(decodeToken('127n0')).toEqual({
      carbRatio: 0.65, saltProfile: 'endurance', flavoringId: 'strawberry', targetCarbsPerHour: 75,
    });
  });
});

describe('encodeFormulation picks the best form', () => {
  it('uses a readable slug when the formulation matches a preset', () => {
    const classic = RECIPES.find((r) => r.id === 'classic');
    expect(encodeFormulation(classic, RECIPES)).toBe('p=classic');
  });

  it('falls back to a packed token for a custom formulation', () => {
    const custom = { carbRatio: 0.35, saltProfile: 'hot', flavoringId: 'unflavored', targetCarbsPerHour: 85 };
    const q = encodeFormulation(custom, RECIPES);
    expect(q.startsWith('c=')).toBe(true);
    expect(decodeFormulation(q, RECIPES)).toEqual(custom);
  });

  it('round-trips presets through the slug form', () => {
    for (const r of RECIPES) {
      const f = {
        carbRatio: r.carbRatio, saltProfile: r.saltProfile,
        flavoringId: r.flavoringId, targetCarbsPerHour: r.targetCarbsPerHour,
      };
      expect(decodeFormulation(encodeFormulation(f, RECIPES), RECIPES)).toEqual(f);
    }
  });

  it('ignores an unknown slug instead of erroring', () => {
    expect(decodeFormulation('p=not-a-recipe', RECIPES).carbRatio).toBe(DEFAULT_CARB_RATIO);
  });

  it('does not let a slug reach into object prototypes', () => {
    expect(decodeFormulation('p=__proto__', RECIPES).carbRatio).toBe(DEFAULT_CARB_RATIO);
    expect(decodeFormulation('p=constructor', RECIPES).carbRatio).toBe(DEFAULT_CARB_RATIO);
  });

  it('prefers a valid slug over other params in the same URL', () => {
    const result = decodeFormulation('p=steady&r=1.5&s=hot', RECIPES);
    const steady = RECIPES.find((r) => r.id === 'steady');
    expect(result.carbRatio).toBe(steady.carbRatio);
  });
});
