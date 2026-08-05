import { describe, it, expect } from 'vitest';
import {
  INTENSITIES, WEATHER, SALT_CAPSULE_MG, CONCENTRATION_BANDS,
  baseRecipeProfile, carbTargetFor, sodiumNeedFor, planRide, concentrationBand,
  drinkingRateFor, MAX_FLUID_L_PER_HOUR,
} from '../src/ride.js';
import { CARB_INTAKE_TIERS } from '../src/hourly.js';
import { computeRecipe } from '../src/calculator.js';

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

describe('bottle plan', () => {
  it('divides the mix across bottles of the size you actually use', () => {
    const small = planRide({ durationHours: 3, intensityId: 'moderate', weatherId: 'mild', bottleMl: 500 });
    const large = planRide({ durationHours: 3, intensityId: 'moderate', weatherId: 'mild', bottleMl: 950 });

    expect(large.gramsPerBottle).toBeGreaterThan(small.gramsPerBottle);
    expect(large.bottlesNeeded).toBeLessThan(small.bottlesNeeded);
    // Same ride, so concentration is a property of the plan, not the bottle.
    expect(large.concentrationPercent).toBeCloseTo(small.concentrationPercent, 6);
  });

  it('derives fluid from the same sweat estimate used for sodium', () => {
    // Rather than asking a fourth question. Hotter means more fluid, which
    // means the same powder ends up more dilute.
    const mild = planRide({ durationHours: 3, intensityId: 'moderate', weatherId: 'mild', bottleMl: 750 });
    const hot = planRide({ durationHours: 3, intensityId: 'moderate', weatherId: 'hot', bottleMl: 750 });
    expect(hot.fluidMl).toBeGreaterThan(mild.fluidMl);
    expect(hot.concentrationPercent).toBeLessThan(mild.concentrationPercent);
  });

  it('flags a long hard effort in the cold as too concentrated', () => {
    // The realistic bad case: high carb need, low sweat rate, so the powder
    // has little fluid to dissolve into.
    const p = planRide({ durationHours: 5, intensityId: 'hard', weatherId: 'cool', bottleMl: 750 });
    expect(p.concentrationPercent).toBeGreaterThan(20);
    expect(p.concentration.id).toBe('very-concentrated');
  });

  it('calls a normal ride typical rather than alarming', () => {
    const p = planRide({ durationHours: 3, intensityId: 'moderate', weatherId: 'mild', bottleMl: 750 });
    expect(['typical', 'dilute', 'concentrated']).toContain(p.concentration.id);
  });

  it('bands concentration in ascending order with no gaps', () => {
    const maxes = CONCENTRATION_BANDS.map((b) => b.max);
    expect([...maxes].sort((a, b) => a - b)).toEqual(maxes);
    expect(CONCENTRATION_BANDS.at(-1).max).toBe(Infinity);
  });

  it('classifies any concentration, however extreme', () => {
    for (const pct of [0, 5, 9, 13, 20, 50, 500]) {
      expect(concentrationBand(pct)).toBeDefined();
    }
  });

  it('grams per bottle is consistent with the concentration', () => {
    const p = planRide({ durationHours: 4, intensityId: 'hard', weatherId: 'warm', bottleMl: 620 });
    expect(p.gramsPerBottle).toBeCloseTo((p.concentrationPercent / 100) * 620, 6);
  });
});

describe('using the batch on screen', () => {
  it('follows a supplied per-gram profile instead of the standard mix', () => {
    // A saltier, less carb-dense batch should change both answers.
    const custom = { carbsG: 0.80, sugarsG: 0.3, sodiumMg: 14, calories: 3.2 };
    const standard = planRide({ durationHours: 3, intensityId: 'moderate', weatherId: 'mild' });
    const mine = planRide({ durationHours: 3, intensityId: 'moderate', weatherId: 'mild', perGram: custom });

    // Fewer carbs per gram means more powder for the same carb target.
    expect(mine.mixGramsPerHour).toBeGreaterThan(standard.mixGramsPerHour);
    // More sodium per gram means less to add on top.
    expect(mine.sodiumFromMix).toBeGreaterThan(standard.sodiumFromMix);
  });

  it('falls back to the standard recipe when no batch is supplied', () => {
    const a = planRide({ durationHours: 3, intensityId: 'moderate', weatherId: 'mild' });
    const b = planRide({ durationHours: 3, intensityId: 'moderate', weatherId: 'mild', perGram: baseRecipeProfile() });
    expect(a.mixGramsPerHour).toBeCloseTo(b.mixGramsPerHour, 9);
  });

  it('reflects a real batch built by the calculator', () => {
    const recipe = computeRecipe({
      onHand: { maltodextrin: 5000, fructose: 5000, flavoring: 5000, salt: 5000 },
      saltProfile: 'hot', maxBatchGrams: 1900, scoopGrams: 46, carbRatio: 0.5,
    });
    const plan = planRide({ durationHours: 3, intensityId: 'moderate', weatherId: 'mild', perGram: recipe.perGram });
    // A hot-profile batch carries more sodium than the endurance default.
    const standard = planRide({ durationHours: 3, intensityId: 'moderate', weatherId: 'mild' });
    expect(plan.sodiumFromMix).toBeGreaterThan(standard.sodiumFromMix);
  });
});

describe('drinkingRateFor', () => {
  it('is well below the sweat rate — riders do not replace losses in full', () => {
    // The original bug: sweat rate was used directly as drinking rate, which
    // overstated bottles by roughly a third.
    const d = drinkingRateFor('moderate', 'mild');
    expect(d.litresPerHour).toBeLessThan(d.sweatLitresPerHour);
    expect(d.litresPerHour / d.sweatLitresPerHour).toBeCloseTo(0.75, 2);
  });

  it('never exceeds what the stomach can absorb', () => {
    for (const i of INTENSITIES) {
      for (const w of WEATHER) {
        expect(drinkingRateFor(i.id, w.id).litresPerHour).toBeLessThanOrEqual(MAX_FLUID_L_PER_HOUR);
      }
    }
  });

  it('flags the cases where sweat outpaces absorption', () => {
    expect(drinkingRateFor('hard', 'hot').limitedByStomach).toBe(true);
    expect(drinkingRateFor('moderate', 'mild').limitedByStomach).toBe(false);
  });

  it('puts a mild moderate ride near one 620 ml bottle an hour', () => {
    // Sanity anchor: a rider who drinks a large bottle an hour should come out
    // slightly above this estimate, not far below it.
    const bottlesPerHour = drinkingRateFor('moderate', 'mild').litresPerHour * 1000 / 620;
    expect(bottlesPerHour).toBeGreaterThan(0.6);
    expect(bottlesPerHour).toBeLessThan(1.1);
  });

  it('keeps a three-hour ride within a plausible bottle count', () => {
    const p = planRide({ durationHours: 3, intensityId: 'moderate', weatherId: 'mild', bottleMl: 620 });
    expect(p.bottlesNeeded).toBeGreaterThan(1.5);
    expect(p.bottlesNeeded).toBeLessThan(3.5);
  });
});
