import { describe, it, expect } from 'vitest';
import { computeRecipe } from '../src/calculator.js';
import { batchCost, costPerGramCarb, compareAtCarbTarget } from '../src/cost.js';
import { COMMERCIAL_PRODUCTS, commercialCostPerGramCarb } from '../data/costs.js';
import { FLAVORINGS, findFlavoring } from '../data/flavorings.js';

const PANTRY = { maltodextrin: 2300, fructose: 2000, flavoring: 500, salt: 400 };
const strawberry = findFlavoring('strawberry');

const recipe = computeRecipe({
  onHand: PANTRY,
  saltProfile: 'endurance',
  maxBatchGrams: 1800,
  scoopGrams: 46,
  flavorRatio: strawberry.ratio,
  flavorCarbFraction: strawberry.carbFraction,
  flavorSugarFraction: strawberry.sugarFraction,
});

describe('batchCost', () => {
  it('costs an 1800 g batch in the right ballpark', () => {
    // The source cost doc puts a full 1800 g batch around $31.
    const { total } = batchCost(recipe.recipeGrams, strawberry.pricePerGram);
    expect(total).toBeGreaterThan(20);
    expect(total).toBeLessThan(45);
  });

  it('shares sum to 1', () => {
    const { share } = batchCost(recipe.recipeGrams, strawberry.pricePerGram);
    expect(Object.values(share).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });

  it('shows flavoring taking a far bigger share of cost than of weight', () => {
    // The headline cost insight: ~10% of the weight, roughly a third of the
    // spend. If this stops being true the "drop the flavoring to save money"
    // advice elsewhere on the site is wrong.
    const { share } = batchCost(recipe.recipeGrams, strawberry.pricePerGram);
    const weightShare = recipe.recipeGrams.flavoring / recipe.actualBatch;
    expect(share.flavoring).toBeGreaterThan(weightShare * 2);
  });

  it('drops to near zero flavoring cost when unflavored', () => {
    const unflavored = findFlavoring('unflavored');
    const plain = computeRecipe({
      onHand: PANTRY, saltProfile: 'endurance', maxBatchGrams: 1800, scoopGrams: 46,
      flavorRatio: unflavored.ratio,
    });
    const { perIngredient, total } = batchCost(plain.recipeGrams, unflavored.pricePerGram);
    expect(perIngredient.flavoring).toBe(0);
    expect(total).toBeLessThan(batchCost(recipe.recipeGrams, strawberry.pricePerGram).total);
  });

  it('handles a zero batch without dividing by zero', () => {
    const empty = { maltodextrin: 0, fructose: 0, flavoring: 0, salt: 0 };
    const { total, share } = batchCost(empty, strawberry.pricePerGram);
    expect(total).toBe(0);
    expect(Object.values(share).every((v) => v === 0)).toBe(true);
  });
});

describe('costPerGramCarb', () => {
  it('divides cost by carbohydrate delivered', () => {
    const { total } = batchCost(recipe.recipeGrams, strawberry.pricePerGram);
    expect(costPerGramCarb(total, recipe.totals.carbsG))
      .toBeCloseTo(total / recipe.totals.carbsG, 9);
  });

  it('returns zero rather than Infinity for a carb-free batch', () => {
    expect(costPerGramCarb(5, 0)).toBe(0);
  });
});

describe('compareAtCarbTarget', () => {
  const { total } = batchCost(recipe.recipeGrams, strawberry.pricePerGram);
  const perGramCarb = costPerGramCarb(total, recipe.totals.carbsG);

  it('puts an hour of homemade fuel near a dollar or two', () => {
    const { mine } = compareAtCarbTarget(perGramCarb, 75);
    expect(mine).toBeGreaterThan(0.5);
    expect(mine).toBeLessThan(3);
  });

  it('finds Gatorade Endurance several times more expensive', () => {
    const { commercial } = compareAtCarbTarget(perGramCarb, 75);
    const endurance = commercial.find((c) => c.id === 'gatorade-endurance');
    expect(endurance.multiple).toBeGreaterThan(2);
  });

  it('does not hide that regular Gatorade is cheaper per carb', () => {
    // Honesty check: the comparison must not be rigged to always win.
    const { commercial } = compareAtCarbTarget(perGramCarb, 75);
    const regular = commercial.find((c) => c.id === 'gatorade-regular');
    expect(regular.multiple).toBeLessThan(1);
  });

  it('sorts cheapest first', () => {
    const { commercial } = compareAtCarbTarget(perGramCarb, 75);
    const costs = commercial.map((c) => c.perHour);
    expect([...costs].sort((a, b) => a - b)).toEqual(costs);
  });

  it('scales linearly with the carb target', () => {
    const a = compareAtCarbTarget(perGramCarb, 60);
    const b = compareAtCarbTarget(perGramCarb, 120);
    expect(b.mine).toBeCloseTo(a.mine * 2, 9);
  });
});

describe('commercial product data', () => {
  it('can price every product per gram of carb', () => {
    for (const p of COMMERCIAL_PRODUCTS) {
      const v = commercialCostPerGramCarb(p);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  it('labels each price as actual or estimated', () => {
    for (const p of COMMERCIAL_PRODUCTS) {
      expect(['actual', 'estimated']).toContain(p.confidence);
    }
  });
});

describe('flavoring price data', () => {
  it('prices every flavoring', () => {
    for (const f of FLAVORINGS) {
      expect(typeof f.pricePerGram).toBe('number');
      expect(f.pricePerGram).toBeGreaterThanOrEqual(0);
      expect(['actual', 'estimated']).toContain(f.priceConfidence);
    }
  });
});
