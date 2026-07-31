import { describe, it, expect } from 'vitest';
import {
  SWEAT_RATES, SWEAT_SODIUM_LEVELS, REPLACEMENT_FRACTION, MAX_PRACTICAL_SALT_RATIO,
  estimateSodiumNeed, solveSaltRatio, sodiumAtSaltRatio,
} from '../src/sodium.js';
import { SALT_PROFILES, computeRecipe } from '../src/calculator.js';
import { planForCarbTarget } from '../src/hourly.js';

describe('estimateSodiumNeed', () => {
  it('multiplies sweat rate by sweat sodium and replaces a fraction of it', () => {
    const r = estimateSodiumNeed({ sweatRateId: 'moderate', sweatSodiumId: 'average', replacementFraction: 0.65 });
    expect(r.lossMgPerHour).toBe(1.0 * 950);
    expect(r.targetMgPerHour).toBeCloseTo(950 * 0.65, 6);
  });

  it('lands the moderate/average case near the tested recipe’s sodium', () => {
    // The existing "endurance" profile delivers ~619 mg/hr at 75 g carbs.
    // A moderate sweat rate with average sweat sodium should land close to
    // that, which is a decent sanity check on the whole estimation model.
    const r = estimateSodiumNeed({ sweatRateId: 'moderate', sweatSodiumId: 'average' });
    expect(r.targetMgPerHour).toBeGreaterThan(550);
    expect(r.targetMgPerHour).toBeLessThan(700);
  });

  it('spans a wide range across conditions, as the research says it should', () => {
    const low = estimateSodiumNeed({ sweatRateId: 'low', sweatSodiumId: 'light' });
    const high = estimateSodiumNeed({ sweatRateId: 'extreme', sweatSodiumId: 'salty' });
    expect(high.targetMgPerHour / low.targetMgPerHour).toBeGreaterThan(5);
  });

  it('reports a replacement range, not just a point estimate', () => {
    const r = estimateSodiumNeed({ sweatRateId: 'high', sweatSodiumId: 'salty' });
    const [lo, hi] = r.rangeMgPerHour;
    expect(lo).toBeCloseTo(r.lossMgPerHour * REPLACEMENT_FRACTION.min, 6);
    expect(hi).toBeCloseTo(r.lossMgPerHour * REPLACEMENT_FRACTION.max, 6);
    expect(r.targetMgPerHour).toBeGreaterThanOrEqual(lo);
    expect(r.targetMgPerHour).toBeLessThanOrEqual(hi);
  });

  it('falls back to sane defaults for unknown ids', () => {
    const r = estimateSodiumNeed({ sweatRateId: 'nope', sweatSodiumId: 'nope' });
    expect(Number.isFinite(r.targetMgPerHour)).toBe(true);
    expect(r.targetMgPerHour).toBeGreaterThan(0);
  });
});

describe('solveSaltRatio', () => {
  const FORMULATION = { carbRatio: 0.65, flavorRatio: 0.2, flavorCarbFraction: 1 };

  it('reproduces the tested endurance profile from its own numbers', () => {
    // 619 mg/hr at 75 g carbs is what the endurance profile (0.065) delivers.
    // Solving backwards must return that ratio, or the algebra is wrong.
    const solved = solveSaltRatio({
      targetSodiumPerHour: 619, targetCarbsPerHour: 75, ...FORMULATION,
    });
    expect(solved.ratio).toBeCloseTo(SALT_PROFILES.endurance.ratio, 3);
  });

  it('round-trips against sodiumAtSaltRatio', () => {
    for (const targetSodiumPerHour of [300, 619, 900, 1200]) {
      for (const targetCarbsPerHour of [30, 60, 75, 120]) {
        const solved = solveSaltRatio({ targetSodiumPerHour, targetCarbsPerHour, ...FORMULATION });
        const delivered = sodiumAtSaltRatio({
          saltRatio: solved.ratio, targetCarbsPerHour, ...FORMULATION,
        });
        expect(delivered).toBeCloseTo(targetSodiumPerHour, 6);
      }
    }
  });

  it('agrees with the full recipe pipeline end to end', () => {
    // The real check: solve a ratio, build an actual batch with it, and see
    // whether the per-hour plan delivers the sodium that was asked for.
    const targetSodiumPerHour = 800;
    const targetCarbsPerHour = 90;
    const solved = solveSaltRatio({ targetSodiumPerHour, targetCarbsPerHour, ...FORMULATION });

    const recipe = computeRecipe({
      onHand: { maltodextrin: 5000, fructose: 5000, flavoring: 5000, salt: 5000 },
      saltProfile: 'endurance',
      saltRatio: solved.ratio,
      maxBatchGrams: 1800,
      scoopGrams: 46,
      carbRatio: FORMULATION.carbRatio,
      flavorRatio: FORMULATION.flavorRatio,
      flavorCarbFraction: FORMULATION.flavorCarbFraction,
    });

    const plan = planForCarbTarget(recipe.perGram, 46, targetCarbsPerHour);
    expect(plan.sodiumMg).toBeCloseTo(targetSodiumPerHour, 4);
  });

  it('needs more salt when carbs are low but sodium need is high', () => {
    // The exact case a fixed salt percentage cannot express: an easy effort in
    // the heat. Low carbs, high sodium.
    const easyHot = solveSaltRatio({ targetSodiumPerHour: 1000, targetCarbsPerHour: 40, ...FORMULATION });
    const hardCool = solveSaltRatio({ targetSodiumPerHour: 1000, targetCarbsPerHour: 100, ...FORMULATION });
    expect(easyHot.ratio).toBeGreaterThan(hardCool.ratio);
  });

  it('refuses to recommend an undrinkable mix', () => {
    const absurd = solveSaltRatio({ targetSodiumPerHour: 1400, targetCarbsPerHour: 30, ...FORMULATION });
    expect(absurd.ratio).toBeGreaterThan(MAX_PRACTICAL_SALT_RATIO);
    expect(absurd.practical).toBe(false);
  });

  it('says how much sodium the mix can carry before that point', () => {
    const targetCarbsPerHour = 30;
    const absurd = solveSaltRatio({ targetSodiumPerHour: 1400, targetCarbsPerHour, ...FORMULATION });
    expect(absurd.maxSodiumAtThisCarbRate).toBeLessThan(1400);

    // At exactly that ceiling the solve should come out practical.
    const atCeiling = solveSaltRatio({
      targetSodiumPerHour: absurd.maxSodiumAtThisCarbRate, targetCarbsPerHour, ...FORMULATION,
    });
    expect(atCeiling.ratio).toBeCloseTo(MAX_PRACTICAL_SALT_RATIO, 6);
    expect(atCeiling.practical).toBe(true);
  });

  it('marks a normal moderate case as practical', () => {
    const normal = solveSaltRatio({ targetSodiumPerHour: 619, targetCarbsPerHour: 75, ...FORMULATION });
    expect(normal.practical).toBe(true);
  });

  it('returns null rather than dividing by zero', () => {
    expect(solveSaltRatio({ targetSodiumPerHour: 600, targetCarbsPerHour: 0, ...FORMULATION })).toBeNull();
  });
});

describe('condition data', () => {
  it('has ascending sweat rates and sodium levels', () => {
    const rates = SWEAT_RATES.map((r) => r.litresPerHour);
    expect([...rates].sort((a, b) => a - b)).toEqual(rates);
    const levels = SWEAT_SODIUM_LEVELS.map((s) => s.mgPerLitre);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
  });

  it('gives every sweat sodium level an observable cue', () => {
    // Most people have never had a sweat test, so the cue is the only way to
    // actually pick one of these.
    for (const level of SWEAT_SODIUM_LEVELS) {
      expect(level.cue.length).toBeGreaterThan(10);
    }
  });
});
