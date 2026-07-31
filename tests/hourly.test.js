import { describe, it, expect } from 'vitest';
import { computeRecipe } from '../src/calculator.js';
import { hourlyTotals, recommendScoopsPerHour, scoopsForDuration, CARB_TARGET_RANGE } from '../src/hourly.js';

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
