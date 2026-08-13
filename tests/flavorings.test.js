import { describe, it, expect } from 'vitest';
import { computeRecipe } from '../src/calculator.js';
import { FLAVORINGS, findFlavoring, DEFAULT_FLAVORING_ID } from '../data/flavorings.js';

describe('FLAVORINGS table', () => {
  it('has well-formed entries', () => {
    for (const f of FLAVORINGS) {
      expect(f.id).toEqual(expect.any(String));
      expect(f.name).toEqual(expect.any(String));
      expect(f.ratio).toBeGreaterThanOrEqual(0);
      expect(f.carbFraction).toBeGreaterThanOrEqual(0);
      expect(f.carbFraction).toBeLessThanOrEqual(1);
      expect(f.sugarFraction).toBeGreaterThanOrEqual(0);
      expect(f.sugarFraction).toBeLessThanOrEqual(1);
      expect(['tested', 'estimated']).toContain(f.confidence);
    }
  });

  it('every entry plugs into computeRecipe without error', () => {
    for (const f of FLAVORINGS) {
      const result = computeRecipe({
        onHand: { maltodextrin: 2300, fructose: 2000, flavoring: 500, salt: 400 },
        saltProfile: 'endurance',
        maxBatchGrams: 1800,
        scoopGrams: 46,
        flavorName: f.name,
        flavorRatio: f.ratio,
        flavorCarbFraction: f.carbFraction,
        flavorSugarFraction: f.sugarFraction,
      });
      expect(result.actualBatch).toBeGreaterThan(0);
      expect(Number.isFinite(result.perScoop.carbsG)).toBe(true);
    }
  });

  it('findFlavoring looks up by id', () => {
    expect(findFlavoring('strawberry').ratio).toBe(0.2);
    expect(findFlavoring('nonexistent')).toBeUndefined();
  });

  // DEFAULT_FLAVORING_ID is a named id specifically so it can't silently
  // drift out of sync with the table it's meant to point into — the same
  // thing this file already guards for src/calculator.js's
  // DEFAULT_SALT_PROFILE/SALT_PROFILES pair. Every ?? findFlavoring(...)
  // fallback in src/app.js depends on this actually resolving.
  it('DEFAULT_FLAVORING_ID names a real entry in FLAVORINGS', () => {
    expect(findFlavoring(DEFAULT_FLAVORING_ID)).toBeDefined();
  });

  // tests/app-dom.test.js identifies which flavoring renderCost() actually
  // used by checking $('cost-note') contains a specific priceBasis string —
  // an assertion that's only meaningful if no two entries share one.
  it('has a unique priceBasis per entry', () => {
    const bases = FLAVORINGS.map((f) => f.priceBasis);
    expect(new Set(bases).size).toBe(bases.length);
  });
});
