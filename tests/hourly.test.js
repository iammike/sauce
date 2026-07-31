import { describe, it, expect } from 'vitest';
import { computeRecipe } from '../src/calculator.js';
import { hourlyTotals, recommendScoopsPerHour, scoopsForDuration, planForCarbTarget, CARB_TARGET_RANGE } from '../src/hourly.js';

const recipe = computeRecipe({
  onHand: { maltodextrin: 2300, fructose: 2000, flavoring: 500, salt: 400 },
  saltProfile: 'endurance',
  maxBatchGrams: 1800,
  scoopGrams: 46,
});

describe('hourlyTotals', () => {
  it('scales per-scoop nutrition linearly by scoops/hr', () => {
    const at2 = hourlyTotals(recipe.perScoop, 2);
    const at3 = hourlyTotals(recipe.perScoop, 3);
    expect(at3.carbsG).toBeCloseTo(at2.carbsG * 1.5, 5);
    expect(at3.sodiumMg).toBeCloseTo(at2.sodiumMg * 1.5, 5);
  });
});

describe('recommendScoopsPerHour', () => {
  it('recommends fewer scoops for a lower carb target', () => {
    const low = recommendScoopsPerHour(recipe.perScoop, 60);
    const high = recommendScoopsPerHour(recipe.perScoop, 90);
    expect(low.scoopsPerHour).toBeLessThan(high.scoopsPerHour);
  });

  it('flags carb intake outside the research target range', () => {
    const wayLow = recommendScoopsPerHour(recipe.perScoop, 10);
    expect(wayLow.carbStatus).toBe('low');

    const inRange = recommendScoopsPerHour(recipe.perScoop, (CARB_TARGET_RANGE.min + CARB_TARGET_RANGE.max) / 2);
    expect(inRange.carbStatus).toBe('in-range');
  });
});

describe('scoopsForDuration', () => {
  it('multiplies scoops/hr by ride duration and converts to batches needed', () => {
    const result = scoopsForDuration(3, 4, recipe.actualBatch, 46);
    expect(result.totalScoops).toBe(12);
    expect(result.totalGrams).toBeCloseTo(12 * 46, 5);
    expect(result.batchesNeeded).toBeCloseTo((12 * 46) / recipe.actualBatch, 5);
  });
});

describe('planForCarbTarget', () => {
  const scoopIndependent = { onHand: { maltodextrin: 2300, fructose: 2000, flavoring: 500, salt: 400 },
    saltProfile: 'endurance', maxBatchGrams: 1800 };

  it('gives the same grams of mix per hour regardless of scoop size', () => {
    // Regression: this was derived from per-scoop values, so owning a bigger
    // scoop changed how much mix an hour of riding supposedly took.
    const small = computeRecipe({ ...scoopIndependent, scoopGrams: 20 });
    const large = computeRecipe({ ...scoopIndependent, scoopGrams: 60 });

    const a = planForCarbTarget(small.perGram, 20, 75);
    const b = planForCarbTarget(large.perGram, 60, 75);

    expect(a.mixGramsPerHour).toBeCloseTo(b.mixGramsPerHour, 6);
    expect(a.sodiumMg).toBeCloseTo(b.sodiumMg, 6);
  });

  it('still reports the plan when no scoop size is known', () => {
    // Regression: a blank scoop size zeroed out the whole plan.
    const r = computeRecipe({ ...scoopIndependent, scoopGrams: 46 });
    const plan = planForCarbTarget(r.perGram, 0, 75);

    expect(plan.mixGramsPerHour).toBeGreaterThan(0);
    expect(plan.sodiumMg).toBeGreaterThan(0);
    expect(plan.scoopsPerHour).toBeNull();
  });

  it('delivers the carb target it was asked for', () => {
    const r = computeRecipe({ ...scoopIndependent, scoopGrams: 46 });
    const plan = planForCarbTarget(r.perGram, 46, 90);
    expect(plan.carbsG).toBeCloseTo(90, 6);
  });

  it('converts to scoops using the measured scoop size', () => {
    const r = computeRecipe({ ...scoopIndependent, scoopGrams: 46 });
    const plan = planForCarbTarget(r.perGram, 46, 75);
    expect(plan.scoopsPerHour).toBeCloseTo(plan.mixGramsPerHour / 46, 6);
  });
});
