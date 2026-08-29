import { describe, it, expect } from 'vitest';
import { computeRecipe } from '../src/calculator.js';

describe('computeRecipe', () => {
  it('picks the limiting ingredient and scales the rest to match', () => {
    const result = computeRecipe({
      onHand: { maltodextrin: 2300, fructose: 2000, flavoring: 500, salt: 400 },
      saltProfile: 'endurance',
      scoopGrams: 46,
    });

    // Maltodextrin (ratio 1) supports only 2300/1 = 2300 "malto units" —
    // fewer than fructose (3077), flavoring (2500), or salt (6154) — so
    // it's the limiting ingredient.
    expect(result.limiting).toBe('maltodextrin');
    // Limiting ingredient is fully used up in the resulting recipe.
    expect(result.recipeGrams.maltodextrin).toBeCloseTo(2300, 0);
  });

  it('respects an explicit batch-size cap even when ingredients allow more', () => {
    const result = computeRecipe({
      onHand: { maltodextrin: 2300, fructose: 2000, flavoring: 500, salt: 400 },
      saltProfile: 'endurance',
      maxBatchGrams: 1800,
      scoopGrams: 46,
    });

    expect(result.limiting).toBe('cap');
    expect(result.actualBatch).toBe(1800);
    expect(result.recipeGrams.maltodextrin + result.recipeGrams.fructose
      + result.recipeGrams.flavoring + result.recipeGrams.salt).toBeCloseTo(1800, 5);
  });

  // The source spreadsheet was built at a 0.65 carb ratio, so this passes it
  // explicitly rather than leaning on DEFAULT_CARB_RATIO. The point is that
  // the port still agrees with the sheet; moving the shipped default is a
  // separate decision and must not make this look like a maths regression.
  it('matches the reference sheet numbers for a capped 1800g endurance batch', () => {
    const result = computeRecipe({
      onHand: { maltodextrin: 2300, fructose: 2000, flavoring: 500, salt: 400 },
      saltProfile: 'endurance',
      maxBatchGrams: 1800,
      scoopGrams: 46,
      carbRatio: 0.65,
    });

    expect(result.totalScoops).toBeCloseTo(39.1, 1);
    expect(result.perScoop.carbsG).toBeCloseTo(44.4, 0);
    expect(result.perScoop.sugarsG).toBeCloseTo(18.5, 0);
    // Reference sheet shows 368 mg, rounded from a slightly coarser salt
    // percentage (3.41% vs. the precise 0.065/1.915 = 3.39% used here).
    expect(result.perScoop.sodiumMg).toBeCloseTo(367, 0);
    expect(result.perScoop.calories).toBeCloseTo(178, 0);
  });

  it('scales salt with the chosen profile', () => {
    const hot = computeRecipe({
      onHand: { maltodextrin: 2300, fructose: 2000, flavoring: 500, salt: 400 },
      saltProfile: 'hot',
      maxBatchGrams: 1800,
      scoopGrams: 46,
    });
    const moderate = computeRecipe({
      onHand: { maltodextrin: 2300, fructose: 2000, flavoring: 500, salt: 400 },
      saltProfile: 'moderate',
      maxBatchGrams: 1800,
      scoopGrams: 46,
    });

    expect(hot.perScoop.sodiumMg).toBeGreaterThan(moderate.perScoop.sodiumMg);
  });

  it('returns a zero batch when a required ingredient is unavailable', () => {
    const result = computeRecipe({
      onHand: { maltodextrin: 2300, fructose: 2000, flavoring: 0, salt: 400 },
      saltProfile: 'endurance',
      scoopGrams: 46,
    });

    expect(result.actualBatch).toBe(0);
    expect(result.limiting).toBe('flavoring');
  });

  it('supports an arbitrary flavoring type with its own ratio and sugar content', () => {
    // A concentrated lemon-lime flavor used at half the ratio of the tested
    // strawberry recipe, with no sugar of its own (sweetness comes purely
    // from the fructose/maltodextrin already in the mix).
    const result = computeRecipe({
      onHand: { maltodextrin: 2300, fructose: 2000, flavoring: 500, salt: 400 },
      saltProfile: 'endurance',
      maxBatchGrams: 1800,
      scoopGrams: 46,
      flavorName: 'Lemon-lime (unsweetened)',
      flavorRatio: 0.1,
      flavorCarbFraction: 0,
      flavorSugarFraction: 0,
    });

    expect(result.flavorName).toBe('Lemon-lime (unsweetened)');
    // With flavorCarbFraction 0, carbs come only from maltodextrin + fructose.
    expect(result.totals.carbsG).toBeCloseTo(
      result.recipeGrams.maltodextrin + result.recipeGrams.fructose,
      5
    );
    expect(result.totals.sugarsG).toBeCloseTo(result.recipeGrams.fructose, 5);
  });

  it('allows an unflavored batch (flavoring ratio of zero)', () => {
    const result = computeRecipe({
      onHand: { maltodextrin: 2300, fructose: 2000, flavoring: 0, salt: 400 },
      saltProfile: 'endurance',
      maxBatchGrams: 1800,
      scoopGrams: 46,
      flavorName: 'Unflavored',
      flavorRatio: 0,
    });

    expect(result.limiting).not.toBe('flavoring');
    expect(result.recipeGrams.flavoring).toBe(0);
  });
});
