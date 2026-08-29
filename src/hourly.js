// Per-hour fueling math and the intake guidance behind it.
// Sources in data/research.js; derivation in docs/recipe-source.md.

// Carbohydrate intake guidance is framed by effort duration, not as one
// number — the right target for a 90-minute ride is not the right target for
// a six-hour one.
//
// These tiers follow Morton et al. 2026 (J Nutr), which revisits the 2016
// ACSM/AND/DC position statement. The substantive change: 90 g/hr is no
// longer treated as the ceiling. For trained athletes on a glucose/fructose
// blend, 90–120 g/hr is the contemporary upper range. Above 120 g/hr is
// experimental — people do it, the efficacy evidence doesn't back it yet.
//
// Anything past 60 g/hr needs both glucose and fructose: glucose alone
// saturates its intestinal transporter (SGLT1) around there no matter how
// much you drink. That is the entire reason this mix exists.
export const CARB_INTAKE_TIERS = [
  {
    gramsPerHour: 30,
    range: [0, 30],
    duration: 'Under 1 hour',
    note: 'Usually unnecessary unless the effort is very intense. Water is often enough.',
    needsFructose: false,
    sourceId: 'morton-2026',
  },
  {
    gramsPerHour: 60,
    range: [30, 60],
    duration: '1–2.5 hours',
    note: 'A single carbohydrate source covers the lower end; a glucose/fructose blend starts to earn its place as you approach 60.',
    needsFructose: false,
    sourceId: 'morton-2026',
  },
  {
    gramsPerHour: 90,
    range: [60, 90],
    duration: '2.5–4 hours',
    note: 'The standard range for long efforts, and it needs multiple transportable carbohydrates.',
    needsFructose: true,
    sourceId: 'morton-2026',
  },
  {
    gramsPerHour: 120,
    range: [90, 120],
    duration: '4+ hours, trained',
    note: 'The contemporary upper range for trained athletes — raised from the old 90 g/hr cap. Requires deliberate gut training; build up in training, never on race day.',
    needsFructose: true,
    aggressive: true,
    sourceId: 'morton-2026',
  },
];

export const DEFAULT_TARGET_CARBS = 75;

// Glucose alone saturates SGLT1 around 60 g/hr. Adding fructose opens a
// second transporter (GLUT5) and lifts the ceiling — to ~90 g/hr for most
// people, and to ~120 for trained athletes who have practised it.
export const GLUCOSE_ONLY_CEILING = 60;
export const DUAL_TRANSPORT_TYPICAL = 90;
export const DUAL_TRANSPORT_TRAINED = 120;

// Optimal fructose-to-glucose ratio per Morton et al. 2026. Since maltodextrin
// digests to glucose, this maps directly onto the calculator's carbRatio.
// Encompasses both common formulations: 2:1 glucose:fructose (0.5) sits just
// below it, and 1:0.8 (0.8) sits inside.
//
// The literature writes it fructose-first with glucose held at 1 (0.8:1),
// which is the number the calculator stores. Product labels write the same
// thing glucose-first (1:0.8), and so does the control — the value is
// identical either way round, only the fixed term swaps sides.
export const FRUCTOSE_RATIO_OPTIMAL = { min: 0.6, max: 1.0 };

// 0.8 is the only point inside Morton's band tried against its neighbours
// directly — O'Brien et al. 2013, where it beat both 0.5 and 1.25.
export const FRUCTOSE_RATIO_MEASURED_BEST = 0.8;
export const FRUCTOSE_RATIO_SOURCE_ID = 'obrien-2013';

/** Where a fructose ratio sits relative to the evidence-backed optimal band. */
export function ratioStatus(carbRatio) {
  if (carbRatio <= 0.05) return 'none';
  if (carbRatio < FRUCTOSE_RATIO_OPTIMAL.min) return 'below';
  if (carbRatio > FRUCTOSE_RATIO_OPTIMAL.max) return 'above';
  return 'optimal';
}

// A coarse sanity band for the status pills. The tiers above are the real
// guidance; this is just "is the number broadly sensible".
export const CARB_TARGET_RANGE = { min: 30, max: 120 };
export const SODIUM_TARGET_RANGE = { min: 500, max: 1000, hot: 1500 };

/** Status of a sodium-per-hour figure against the replacement target range. */
export function sodiumStatus(sodiumMgPerHour) {
  return rangeStatus(sodiumMgPerHour, SODIUM_TARGET_RANGE);
}

function rangeStatus(value, { min, max }) {
  if (value < min) return 'low';
  if (value > max) return 'high';
  return 'in-range';
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
