import { describe, it, expect } from 'vitest';
import {
  encodeFormulation,
  decodeFormulation,
  hasFormulation,
  DEFAULT_TARGET_CARBS,
  DEFAULT_FLAVORING_ID,
  DEFAULT_SALT_PROFILE,
} from '../src/share.js';
import { DEFAULT_CARB_RATIO } from '../src/calculator.js';

const FORMULATION = {
  carbRatio: 0.8,
  saltProfile: 'hot',
  flavoringId: 'unflavored',
  targetCarbsPerHour: 100,
};

describe('encode/decode round trip', () => {
  it('preserves a formulation exactly', () => {
    expect(decodeFormulation(encodeFormulation(FORMULATION))).toEqual(FORMULATION);
  });

  it('tolerates a leading question mark', () => {
    expect(decodeFormulation('?' + encodeFormulation(FORMULATION))).toEqual(FORMULATION);
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
