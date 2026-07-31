// Per-hour fueling recommendation, built on top of a computed recipe's
// per-scoop nutrition (see calculator.js).
//
// Research targets (see docs/recipe-source.md for sources):
//   - Carbs: 60-90 g/hr for efforts long/hard enough to need dual-transporter fueling
//   - Sodium: 500-1000 mg/hr for an average sweater, up to ~1500 mg/hr hot/heavy

// Established carbohydrate intake guidance is framed by effort duration, not
// as one number — the right target for a 90-minute ride is not the right
// target for a six-hour one. These tiers follow the ACSM/ISSN position stands
// and Jeukendrup's work (see data/research.js).
//
// The 90 g/hr tier and above are only reachable with both glucose and
// fructose: glucose alone saturates its intestinal transporter (SGLT1) at
// roughly 60 g/hr no matter how much you drink. That is the entire reason
// this mix exists.
export const CARB_INTAKE_TIERS = [
  {
    gramsPerHour: 30,
    duration: '1–2 hours',
    note: 'Enough to matter without much to digest. Single-source carbs are fine here.',
    needsFructose: false,
  },
  {
    gramsPerHour: 60,
    duration: '2–3 hours',
    note: 'The long-standing default, and the ceiling for glucose on its own.',
    needsFructose: false,
  },
  {
    gramsPerHour: 90,
    duration: '3 hours and up',
    note: 'Requires glucose plus fructose. Worth practising in training before you rely on it.',
    needsFructose: true,
  },
  {
    gramsPerHour: 120,
    duration: 'Racing, trained gut',
    note: 'Beyond the classic guidance — common in pro cycling, but it takes deliberate gut training and does not suit everyone.',
    needsFructose: true,
    aggressive: true,
  },
];

// Glucose alone saturates SGLT1 around 60 g/hr. Adding fructose opens a
// second transporter (GLUT5) and lifts the ceiling toward 90 and beyond.
export const GLUCOSE_ONLY_CEILING = 60;
export const DUAL_TRANSPORT_CEILING = 90;

/** The most carbs per hour this formulation can realistically deliver. */
export function absorptionCeiling(carbRatio) {
  return carbRatio > 0.05 ? DUAL_TRANSPORT_CEILING : GLUCOSE_ONLY_CEILING;
}

/** The tier a target falls into, for labelling what an intake actually means. */
export function tierFor(gramsPerHour) {
  return CARB_INTAKE_TIERS.reduce((best, tier) =>
    (gramsPerHour >= tier.gramsPerHour ? tier : best), CARB_INTAKE_TIERS[0]);
}

// Kept as a coarse sanity band for the status pills. The tiers above are the
// real guidance; this is just "is the number broadly sensible".
export const CARB_TARGET_RANGE = { min: 30, max: 120 };
export const SODIUM_TARGET_RANGE = { min: 500, max: 1000, hot: 1500 };

function rangeStatus(value, { min, max }) {
  if (value < min) return 'low';
  if (value > max) return 'high';
  return 'in-range';
}

/** Nutrition delivered per hour at a given scoops/hr rate. */
export function hourlyTotals(perScoop, scoopsPerHour) {
  return {
    scoopsPerHour,
    carbsG: perScoop.carbsG * scoopsPerHour,
    sugarsG: perScoop.sugarsG * scoopsPerHour,
    sodiumMg: perScoop.sodiumMg * scoopsPerHour,
    calories: perScoop.calories * scoopsPerHour,
  };
}

/**
 * Work backward from a target carb intake to the scoops/hr that delivers it,
 * and report where that lands relative to sodium targets.
 */
export function recommendScoopsPerHour(perScoop, targetCarbsPerHour = CARB_TARGET_RANGE.max) {
  const scoopsPerHour = perScoop.carbsG > 0 ? targetCarbsPerHour / perScoop.carbsG : 0;
  const totals = hourlyTotals(perScoop, scoopsPerHour);
  return {
    ...totals,
    carbStatus: rangeStatus(totals.carbsG, CARB_TARGET_RANGE),
    sodiumStatus: rangeStatus(totals.sodiumMg, SODIUM_TARGET_RANGE),
  };
}

/**
 * Fueling plan for a carb target, expressed in grams of mix per hour.
 *
 * Built on per-gram nutrition (see computeRecipe) rather than per-scoop,
 * because how much mix an hour of riding takes is a property of the
 * formulation — it must not change just because someone owns a bigger scoop.
 * Scoop size is used only for the optional scoops-per-hour convenience
 * conversion, and a missing scoop size leaves the rest of the plan intact.
 */
export function planForCarbTarget(perGram, scoopGrams, targetCarbsPerHour) {
  const mixGramsPerHour = perGram.carbsG > 0 ? targetCarbsPerHour / perGram.carbsG : 0;
  const sodiumMg = perGram.sodiumMg * mixGramsPerHour;

  return {
    targetCarbsPerHour,
    mixGramsPerHour,
    scoopsPerHour: scoopGrams > 0 ? mixGramsPerHour / scoopGrams : null,
    carbsG: perGram.carbsG * mixGramsPerHour,
    sugarsG: perGram.sugarsG * mixGramsPerHour,
    sodiumMg,
    calories: perGram.calories * mixGramsPerHour,
    carbStatus: rangeStatus(targetCarbsPerHour, CARB_TARGET_RANGE),
    sodiumStatus: rangeStatus(sodiumMg, SODIUM_TARGET_RANGE),
  };
}

/** Total scoops (and batches) needed to fuel a ride/run of a given duration. */
export function scoopsForDuration(scoopsPerHour, durationHours, actualBatchGrams, scoopGrams) {
  const totalScoops = scoopsPerHour * durationHours;
  const totalGrams = totalScoops * scoopGrams;
  const batchesNeeded = actualBatchGrams > 0 ? totalGrams / actualBatchGrams : 0;
  return { totalScoops, totalGrams, batchesNeeded };
}
