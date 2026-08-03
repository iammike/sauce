import { describe, it, expect } from 'vitest';
import {
  INTENSITIES, WEATHER, SALT_CAPSULE_MG,
  baseRecipeProfile, carbTargetFor, sodiumNeedFor, planRide,
} from '../src/ride.js';
import { CARB_INTAKE_TIERS } from '../src/hourly.js';

const plan = (o) => planRide({ durationHours: 3, intensityId: 'moderate', weatherId: 'mild', ...o });

describe('baseRecipeProfile', () => {
  it('describes the base recipe, not whatever the batch calculator holds', () => {
    const p = baseRecipeProfile();
    // ~97% carbohydrate by weight, ~8 mg sodium per gram of mix.
    expect(p.carbsG).toBeGreaterThan(0.9);
    expect(p.carbsG).toBeLessThan(1);
    expect(p.sodiumMg).toBeGreaterThan(5);
    expect(p.sodiumMg).toBeLessThan(12);
  });
});

describe('carbTargetFor', () => {
  it('picks the band from duration', () => {
    expect(carbTargetFor(0.5, 'moderate').tier.gramsPerHour).toBe(30);
    expect(carbTargetFor(2, 'moderate').tier.gramsPerHour).toBe(60);
    expect(carbTargetFor(3, 'moderate').tier.gramsPerHour).toBe(90);
    expect(carbTargetFor(5, 'moderate').tier.gramsPerHour).toBe(120);
  });

  it('places the target inside the band by intensity', () => {
    const [min, max] = CARB_INTAKE_TIERS.find((t) => t.gramsPerHour === 90).range;
    expect(carbTargetFor(3, 'easy').gramsPerHour).toBe(min);
    expect(carbTargetFor(3, 'hard').gramsPerHour).toBe(max);
    const mid = carbTargetFor(3, 'moderate').gramsPerHour;
    expect(mid).toBeGreaterThan(min);
    expect(mid).toBeLessThan(max);
  });

  it('never recommends more carbs for an easier ride of the same length', () => {
    for (const hours of [1, 2, 3, 5]) {
      const easy = carbTargetFor(hours, 'easy').gramsPerHour;
      const hard = carbTargetFor(hours, 'hard').gramsPerHour;
      expect(easy).toBeLessThanOrEqual(hard);
    }
  });

  it('scales up with duration at fixed intensity', () => {
    const targets = [1, 2, 3, 5].map((h) => carbTargetFor(h, 'moderate').gramsPerHour);
    expect([...targets].sort((a, b) => a - b)).toEqual(targets);
  });
});

describe('sodiumNeedFor', () => {
  it('rises with heat and with intensity', () => {
    expect(sodiumNeedFor('moderate', 'hot')).toBeGreaterThan(sodiumNeedFor('moderate', 'cool'));
    expect(sodiumNeedFor('hard', 'warm')).toBeGreaterThan(sodiumNeedFor('easy', 'warm'));
  });

  it('stays within a defensible range across every combination', () => {
    for (const i of INTENSITIES) {
      for (const w of WEATHER) {
        const need = sodiumNeedFor(i.id, w.id);
        expect(need).toBeGreaterThan(100);
        expect(need).toBeLessThan(1500);
      }
    }
  });
});

describe('planRide', () => {
  it('reports carbs for the whole ride, not just per hour', () => {
    const p = plan({ durationHours: 4 });
    expect(p.totalCarbs).toBe(p.carbsPerHour * 4);
  });

  it('converts the carb target into grams of mix to pack', () => {
    const p = plan({});
    // The mix is ~97% carbohydrate, so mix weight is slightly above carbs.
    expect(p.mixGramsPerHour).toBeGreaterThan(p.carbsPerHour);
    expect(p.mixGramsPerHour).toBeLessThan(p.carbsPerHour * 1.15);
    expect(p.totalMixGrams).toBeCloseTo(p.mixGramsPerHour * 3, 6);
  });

  it('says nothing about extra salt on a cool easy ride', () => {
    // The base recipe already carries enough sodium here; advising a capsule
    // would be noise.
    const p = plan({ intensityId: 'easy', weatherId: 'cool' });
    expect(p.extraSodiumPerHour).toBe(0);
    expect(p.capsulesPerHour).toBe(0);
  });

  it('advises extra salt when it is hot and hard', () => {
    const p = plan({ intensityId: 'hard', weatherId: 'hot' });
    expect(p.extraSodiumPerHour).toBeGreaterThan(0);
    expect(p.capsulesPerHour).toBeGreaterThan(0);
  });

  it('rounds salt advice coarsely rather than pretending to precision', () => {
    for (const w of WEATHER) {
      for (const i of INTENSITIES) {
        const p = plan({ intensityId: i.id, weatherId: w.id });
        expect(p.extraSodiumPerHour % 50).toBe(0);
      }
    }
  });

  it('expresses extra salt in countable capsules', () => {
    const p = plan({ intensityId: 'hard', weatherId: 'hot' });
    expect(p.capsulesPerHour).toBeCloseTo(
      Math.round((p.extraSodiumPerHour / SALT_CAPSULE_MG) * 2) / 2, 6,
    );
  });

  it('flags when the carb target needs a trained gut', () => {
    expect(plan({ durationHours: 5, intensityId: 'hard' }).needsTrainedGut).toBe(true);
    expect(plan({ durationHours: 2, intensityId: 'easy' }).needsTrainedGut).toBe(false);
  });

  it('says a short easy ride needs nothing at all', () => {
    // Not a bug: under an hour at an easy pace, water is the right answer,
    // and printing a recipe for 0 g of powder would be worse than saying so.
    const p = planRide({ durationHours: 0.5, intensityId: 'easy', weatherId: 'cool' });
    expect(p.carbsPerHour).toBe(0);
    expect(p.nothingNeeded).toBe(true);
  });

  it('produces a usable plan for every combination of inputs', () => {
    for (const hours of [0.5, 1, 2, 3, 4, 6, 8]) {
      for (const i of INTENSITIES) {
        for (const w of WEATHER) {
          const p = planRide({ durationHours: hours, intensityId: i.id, weatherId: w.id });
          expect(Number.isFinite(p.mixGramsPerHour)).toBe(true);
          expect(Number.isFinite(p.totalMixGrams)).toBe(true);
          expect(p.mixGramsPerHour).toBeGreaterThanOrEqual(0);
          expect(p.nothingNeeded).toBe(p.carbsPerHour === 0);
        }
      }
    }
  });

  it('falls back to sane defaults on unknown ids', () => {
    const p = planRide({ durationHours: 3, intensityId: 'nope', weatherId: 'nope' });
    expect(p.carbsPerHour).toBeGreaterThan(0);
    expect(Number.isFinite(p.sodiumNeed)).toBe(true);
  });
});
