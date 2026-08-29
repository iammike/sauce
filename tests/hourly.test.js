import { describe, it, expect } from 'vitest';
import { computeRecipe } from '../src/calculator.js';
import { findResearch, RESEARCH } from '../data/research.js';
import { planForCarbTarget, CARB_INTAKE_TIERS, ratioStatus,
  FRUCTOSE_RATIO_OPTIMAL, FRUCTOSE_RATIO_MEASURED_BEST,
  FRUCTOSE_RATIO_SOURCE_ID } from '../src/hourly.js';

const findResearchRoles = () => RESEARCH.map((r) => r.role);

const recipe = computeRecipe({
  onHand: { maltodextrin: 2300, fructose: 2000, flavoring: 500, salt: 400 },
  saltProfile: 'endurance',
  maxBatchGrams: 1800,
  scoopGrams: 46,
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

describe('carb intake tiers', () => {
  it('follows the current duration-based guidance (Morton et al. 2026)', () => {
    expect(CARB_INTAKE_TIERS.map((t) => t.gramsPerHour)).toEqual([30, 60, 90, 120]);
    expect(CARB_INTAKE_TIERS.map((t) => t.range)).toEqual([[0, 30], [30, 60], [60, 90], [90, 120]]);
  });

  it('cites a source for every tier', () => {
    for (const tier of CARB_INTAKE_TIERS) {
      expect(findResearch(tier.sourceId)).toBeDefined();
    }
  });

  it('has contiguous bands with no gaps', () => {
    for (let i = 1; i < CARB_INTAKE_TIERS.length; i += 1) {
      expect(CARB_INTAKE_TIERS[i].range[0]).toBe(CARB_INTAKE_TIERS[i - 1].range[1]);
    }
  });

  it('marks the tiers that require fructose', () => {
    // Glucose alone saturates SGLT1 near 60 g/hr, so only the tiers above
    // that depend on a second transporter.
    for (const tier of CARB_INTAKE_TIERS) {
      expect(tier.needsFructose).toBe(tier.gramsPerHour > 60);
    }
  });

  it('flags the 90-120 band as needing gut training', () => {
    expect(CARB_INTAKE_TIERS.find((t) => t.gramsPerHour === 120).aggressive).toBe(true);
  });
});


describe('ratioStatus', () => {
  it('recognises the evidence-backed optimal fructose band', () => {
    expect(ratioStatus(FRUCTOSE_RATIO_OPTIMAL.min)).toBe('optimal');
    expect(ratioStatus(FRUCTOSE_RATIO_OPTIMAL.max)).toBe('optimal');
    expect(ratioStatus(0.8)).toBe('optimal');
  });

  it('places the tested house ratio inside the optimal band', () => {
    // 0.65 is the ratio from the original recipe — worth knowing it holds up.
    expect(ratioStatus(0.65)).toBe('optimal');
  });

  it('marks the classic 2:1 ratio as just below optimal', () => {
    expect(ratioStatus(0.5)).toBe('below');
  });

  it('distinguishes no fructose from merely low fructose', () => {
    expect(ratioStatus(0)).toBe('none');
    expect(ratioStatus(0.3)).toBe('below');
  });

  it('flags ratios past the optimal band', () => {
    expect(ratioStatus(1.4)).toBe('above');
  });
});

describe('the measured-best fructose ratio', () => {
  // The app singles this ratio out as better-evidenced than the rest of the
  // band. If it ever fell outside the band the page would contradict itself.
  it('sits inside the optimal band', () => {
    expect(ratioStatus(FRUCTOSE_RATIO_MEASURED_BEST)).toBe('optimal');
  });

  // Same door tests/flavorings.test.js closes on DEFAULT_FLAVORING_ID: a
  // constant that names a source is only worth anything if the source exists,
  // and the readout renders it as an #ref- anchor either way.
  it('names a source that is actually on the page', () => {
    expect(findResearch(FRUCTOSE_RATIO_SOURCE_ID)).toBeDefined();
  });
});

describe('research card roles', () => {
  it('gives every source a specific role, not a generic one', () => {
    const roles = findResearchRoles();
    for (const role of roles) {
      expect(role).toBeTruthy();
    }
    // A column of cards all saying the same thing tells a reader nothing.
    expect(new Set(roles).size).toBe(roles.length);
  });
});
