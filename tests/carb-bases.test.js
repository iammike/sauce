// Data-integrity tests for the carb bases, in the same spirit as
// tests/flavorings.test.js: a new base gets picked up by these loops
// automatically, and the invariants the render code relies on are pinned
// here rather than discovered at render time.

import { describe, it, expect } from 'vitest';
import { CARB_BASES, DEFAULT_CARB_BASE, findCarbBase, baseIngredientKeys } from '../data/carb-bases.js';
import { INGREDIENT_COSTS } from '../data/costs.js';
import { computeRecipe, SALT_PROFILES } from '../src/calculator.js';

const PANTRY = {
  maltodextrin: 1e6, fructose: 1e6, sucrose: 1e6, flavoring: 1e6, salt: 1e6,
};
const BATCH = {
  onHand: PANTRY, saltProfile: 'endurance', maxBatchGrams: 1000,
  flavorRatio: 0.2, flavorCarbFraction: 1, flavorSugarFraction: 0.6,
};

describe('CARB_BASES', () => {
  it('gives every base the fields the render code reads', () => {
    for (const [id, base] of Object.entries(CARB_BASES)) {
      expect(base.id).toBe(id);
      expect(base.shortName).toEqual(expect.any(String));
      expect(base.note).toEqual(expect.any(String));
      expect(base.ratioHint).toEqual(expect.any(String));
      expect(base.parts.length).toBeGreaterThan(0);
    }
  });

  it('gives every part a name, a carb fraction and a sugar fraction', () => {
    for (const base of Object.values(CARB_BASES)) {
      for (const part of base.parts) {
        expect(part.name).toEqual(expect.any(String));
        expect(part.carbFraction).toBeGreaterThan(0);
        expect(part.sugarFraction).toBeGreaterThanOrEqual(0);
        expect(part.sugarFraction).toBeLessThanOrEqual(part.carbFraction);
      }
    }
  });

  // Every carb part is priced by key in batchCost(). A part with no entry
  // silently costs nothing, which would understate the batch rather than
  // failing — exactly the kind of quiet wrong number this repo cares about.
  it('prices every carb part', () => {
    for (const base of Object.values(CARB_BASES)) {
      for (const key of baseIngredientKeys(base)) {
        expect(INGREDIENT_COSTS[key]).toBeDefined();
      }
    }
  });

  // Same door tests/flavorings.test.js closes on DEFAULT_FLAVORING_ID: the
  // `?? findCarbBase(DEFAULT_CARB_BASE)` fallback in app.js and calculator.js
  // can itself resolve to undefined if this names nothing.
  it('names a default that exists', () => {
    expect(findCarbBase(DEFAULT_CARB_BASE)).toBeDefined();
  });

  // hasOwnProperty, not `in` — see "Share links are untrusted input".
  it('rejects prototype keys rather than resolving them', () => {
    expect(findCarbBase('constructor')).toBeUndefined();
    expect(findCarbBase('__proto__')).toBeUndefined();
  });

  it('only marks a base non-adjustable if it says what the ratio is', () => {
    for (const base of Object.values(CARB_BASES)) {
      if (!base.adjustableRatio) expect(base.fixedCarbRatio).toEqual(expect.any(Number));
    }
  });
});

describe('a table-sugar batch', () => {
  const sugar = computeRecipe({ ...BATCH, carbBase: 'sucrose' });

  it('carries no maltodextrin or fructose line at all', () => {
    expect(sugar.recipeGrams.sucrose).toBeGreaterThan(0);
    expect(sugar.recipeGrams.maltodextrin).toBeUndefined();
    expect(sugar.recipeGrams.fructose).toBeUndefined();
  });

  // The reason the sugar math couldn't stay keyed to `fructose`: sucrose is
  // entirely sugar, and on a printed nutrition label that line is not
  // cosmetic. Only the flavouring's non-sugar carbohydrate separates the two.
  it('counts all of its carbohydrate as sugars, bar the flavouring', () => {
    const flavourNonSugar = sugar.recipeGrams.flavoring * (1 - 0.6);
    expect(sugar.totals.sugarsG).toBeCloseTo(sugar.totals.carbsG - flavourNonSugar, 6);
  });
});

// Salt used to be grams per gram of the *reference* carb, so the number of
// carbs beside it changed what "Endurance" delivered: 0.65 -> 0.8 quietly took
// it from 619 to 573 mg/hr, and a one-carb base would have jumped it to 955.
describe('salt profiles deliver their sodium per gram of carbohydrate', () => {
  const sodiumPerHour = (opts) => {
    const r = computeRecipe({ ...BATCH, ...opts });
    return (r.perGram.sodiumMg / r.perGram.carbsG) * 75;
  };

  it.each(Object.keys(SALT_PROFILES))('holds %s steady across base and ratio', (saltProfile) => {
    const reference = sodiumPerHour({ saltProfile, carbRatio: 0.8 });
    expect(sodiumPerHour({ saltProfile, carbRatio: 0.5 })).toBeCloseTo(reference, 6);
    expect(sodiumPerHour({ saltProfile, carbRatio: 1.2 })).toBeCloseTo(reference, 6);
    expect(sodiumPerHour({ saltProfile, carbBase: 'sucrose' })).toBeCloseTo(reference, 6);
  });

  // Pins the actual shipped figure, not just that it's consistent — the
  // profiles were back-derived from this so today's batch was unchanged.
  it('still delivers the endurance batch its tested 573 mg/hr', () => {
    expect(sodiumPerHour({ saltProfile: 'endurance', carbRatio: 0.8 })).toBeCloseTo(573, 0);
  });
});
