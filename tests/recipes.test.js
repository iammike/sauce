import { describe, it, expect } from 'vitest';
import { computeRecipe } from '../src/calculator.js';
import { RECIPES, findRecipe } from '../data/recipes.js';
import { findFlavoring } from '../data/flavorings.js';
import { SALT_PROFILES } from '../src/calculator.js';

const PANTRY = { maltodextrin: 2300, fructose: 2000, flavoring: 500, salt: 400 };

describe('RECIPES table', () => {
  it('has well-formed entries referencing real flavorings and salt profiles', () => {
    for (const r of RECIPES) {
      expect(r.id).toEqual(expect.any(String));
      expect(r.name).toEqual(expect.any(String));
      expect(r.carbRatio).toBeGreaterThanOrEqual(0);
      expect(SALT_PROFILES[r.saltProfile]).toBeDefined();
      expect(findFlavoring(r.flavoringId)).toBeDefined();
      expect(r.targetCarbsPerHour).toBeGreaterThan(0);
      expect(['tested', 'variant']).toContain(r.confidence);
    }
  });

  it('does not prescribe scoop size — that is the user\'s equipment, not the recipe', () => {
    for (const r of RECIPES) {
      expect(r.scoopGrams).toBeUndefined();
    }
  });

  it('every recipe produces a usable batch', () => {
    for (const r of RECIPES) {
      const flavor = findFlavoring(r.flavoringId);
      const result = computeRecipe({
        onHand: PANTRY,
        saltProfile: r.saltProfile,
        scoopGrams: 46,
        carbRatio: r.carbRatio,
        flavorRatio: flavor.ratio,
        flavorCarbFraction: flavor.carbFraction,
        flavorSugarFraction: flavor.sugarFraction,
      });
      expect(result.actualBatch).toBeGreaterThan(0);
      expect(result.perScoop.carbsG).toBeGreaterThan(0);
    }
  });

  it('orders recipes by fructose content the way their descriptions claim', () => {
    const steady = findRecipe('steady');
    const classic = findRecipe('classic');
    const bigDay = findRecipe('big-day');
    expect(steady.carbRatio).toBeLessThan(classic.carbRatio);
    expect(classic.carbRatio).toBeLessThan(bigDay.carbRatio);
  });

  it('Hot Day delivers more sodium per scoop than the Classic at equal carbs', () => {
    const build = (r) => {
      const flavor = findFlavoring(r.flavoringId);
      return computeRecipe({
        onHand: PANTRY,
        saltProfile: r.saltProfile,
        maxBatchGrams: 1800,
        scoopGrams: 46,
        carbRatio: r.carbRatio,
        flavorRatio: flavor.ratio,
        flavorCarbFraction: flavor.carbFraction,
        flavorSugarFraction: flavor.sugarFraction,
      });
    };
    const classic = build(findRecipe('classic'));
    const hot = build(findRecipe('hot-day'));

    expect(hot.perScoop.sodiumMg).toBeGreaterThan(classic.perScoop.sodiumMg);
    // Same carb ratio, so carbs per scoop should be within rounding of each other.
    expect(hot.perScoop.carbsG).toBeCloseTo(classic.perScoop.carbsG, 0);
  });
});

describe('carbRatio parameter', () => {
  it('raises the fructose share of the batch as it increases', () => {
    const low = computeRecipe({ onHand: PANTRY, saltProfile: 'endurance', scoopGrams: 46, maxBatchGrams: 1800, carbRatio: 0.5 });
    const high = computeRecipe({ onHand: PANTRY, saltProfile: 'endurance', scoopGrams: 46, maxBatchGrams: 1800, carbRatio: 0.8 });

    expect(high.recipeGrams.fructose).toBeGreaterThan(low.recipeGrams.fructose);
    expect(high.recipeGrams.maltodextrin).toBeLessThan(low.recipeGrams.maltodextrin);
  });

  it('defaults to the tested 0.65 when not supplied', () => {
    const explicit = computeRecipe({ onHand: PANTRY, saltProfile: 'endurance', scoopGrams: 46, maxBatchGrams: 1800, carbRatio: 0.65 });
    const implicit = computeRecipe({ onHand: PANTRY, saltProfile: 'endurance', scoopGrams: 46, maxBatchGrams: 1800 });

    expect(implicit.recipeGrams.fructose).toBeCloseTo(explicit.recipeGrams.fructose, 5);
  });

  it('supports a glucose-only mix at ratio 0', () => {
    const result = computeRecipe({ onHand: PANTRY, saltProfile: 'endurance', scoopGrams: 46, maxBatchGrams: 1800, carbRatio: 0 });
    expect(result.recipeGrams.fructose).toBe(0);
    expect(result.actualBatch).toBe(1800);
  });
});
