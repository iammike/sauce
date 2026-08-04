// Estimating how much sodium you need, and solving the formulation to deliver it.
//
// NOT CURRENTLY WIRED INTO THE UI. Conditions are a day-of reading and a batch
// is mixed in advance, so asking about sweat while planning a jar was asking
// the wrong question at the wrong time. The bottle planner (src/ride.js) now
// handles conditions, with a deliberately coarser model. Kept, with its tests,
// because solveSaltRatio is the non-obvious part and worth not rederiving.
//
// The problem this exists to fix: carbohydrate need and sodium need are driven
// by different things. Carbs scale with duration and intensity; sodium scales
// with sweat rate and heat. In a single powder they're welded together by the
// formulation ratio, so a long easy ride in the heat — low carbs, high sodium —
// is a case a fixed salt percentage simply cannot express.
//
// Being homemade is exactly what lets you break that coupling: rather than
// picking from a menu of salt percentages, solve for the one that lands your
// sodium where you want it at the carb intake you're actually fuelling at.

import { SODIUM_MG_PER_G_SALT } from './calculator.js';

// Sweat rate, litres per hour. Grounded in the 0.75–1.5 L/hr typical range
// (see data/research.js), extended at both ends for cool easy efforts and for
// hard efforts in real heat.
export const SWEAT_RATES = [
  { id: 'low', label: 'Cool, or easy effort', litresPerHour: 0.5 },
  { id: 'moderate', label: 'Moderate conditions', litresPerHour: 1.0 },
  { id: 'high', label: 'Hot, or hard effort', litresPerHour: 1.5 },
  { id: 'extreme', label: 'Very hot and hard', litresPerHour: 2.0 },
];

// Sweat sodium concentration, mg per litre. This varies several-fold between
// people and is the single biggest source of uncertainty here — the visible
// cues are the only guide most people have without a lab sweat test.
export const SWEAT_SODIUM_LEVELS = [
  { id: 'light', label: 'Light — no residue', mgPerLitre: 500, cue: 'Sweat doesn’t sting your eyes; no marks on kit.' },
  { id: 'average', label: 'Average', mgPerLitre: 950, cue: 'Occasional white marks after long, hot efforts.' },
  { id: 'salty', label: 'Salty — visible crust', mgPerLitre: 1300, cue: 'White streaks on your face and kit; sweat stings and tastes salty.' },
];

// Replace 50–80% of what you lose. The midpoint is a reasonable default;
// replacing everything isn't the goal and isn't necessary.
export const REPLACEMENT_FRACTION = { min: 0.5, max: 0.8, default: 0.65 };

// Past this the mix genuinely starts to taste of salt, and adding more stops
// being the right tool — a salt tab alongside is better than an undrinkable
// bottle. Expressed, like every other ratio here, per 1 g of maltodextrin.
export const MAX_PRACTICAL_SALT_RATIO = 0.12;

export function findSweatRate(id) {
  return SWEAT_RATES.find((r) => r.id === id);
}

export function findSweatSodium(id) {
  return SWEAT_SODIUM_LEVELS.find((s) => s.id === id);
}

/**
 * Estimated sodium replacement target, mg/hr.
 * This is an estimate built on two coarse inputs — treat it as a starting
 * point to adjust from, not a prescription.
 */
export function estimateSodiumNeed({
  sweatRateId = 'moderate',
  sweatSodiumId = 'average',
  replacementFraction = REPLACEMENT_FRACTION.default,
} = {}) {
  const rate = findSweatRate(sweatRateId) ?? SWEAT_RATES[1];
  const level = findSweatSodium(sweatSodiumId) ?? SWEAT_SODIUM_LEVELS[1];

  const lossMgPerHour = rate.litresPerHour * level.mgPerLitre;
  return {
    lossMgPerHour,
    targetMgPerHour: lossMgPerHour * replacementFraction,
    rangeMgPerHour: [
      lossMgPerHour * REPLACEMENT_FRACTION.min,
      lossMgPerHour * REPLACEMENT_FRACTION.max,
    ],
    rate,
    level,
  };
}

/**
 * Salt ratio (g sodium citrate per 1 g maltodextrin) that delivers a sodium
 * target at a given carb intake.
 *
 * Derivation — batch size cancels out entirely, which is why this is a closed
 * form rather than a search. With ratios expressed per 1 g maltodextrin:
 *
 *   carbUnits   = 1 + fructoseRatio + flavorRatio * flavorCarbFraction
 *   mix g/hr    = targetCarbs * sumRatio / carbUnits
 *   sodium mg/hr = (salt * 235 / sumRatio) * mix g/hr
 *                = salt * 235 * targetCarbs / carbUnits
 *
 * so  salt = targetSodium * carbUnits / (235 * targetCarbs).
 */
export function solveSaltRatio({
  targetSodiumPerHour,
  targetCarbsPerHour,
  carbRatio,
  flavorRatio = 0,
  flavorCarbFraction = 1,
}) {
  if (!(targetCarbsPerHour > 0)) return null;

  const carbUnits = 1 + carbRatio + flavorRatio * flavorCarbFraction;
  const ratio = (targetSodiumPerHour * carbUnits)
    / (SODIUM_MG_PER_G_SALT * targetCarbsPerHour);

  return {
    ratio,
    practical: ratio <= MAX_PRACTICAL_SALT_RATIO,
    // Sodium the mix can actually carry at this carb intake before it stops
    // being drinkable. What's left over has to come from somewhere else.
    maxSodiumAtThisCarbRate:
      (MAX_PRACTICAL_SALT_RATIO * SODIUM_MG_PER_G_SALT * targetCarbsPerHour) / carbUnits,
  };
}

/**
 * Sodium a solved-or-chosen salt ratio actually delivers per hour — the
 * inverse of solveSaltRatio, used to verify and to report on manual profiles.
 */
export function sodiumAtSaltRatio({
  saltRatio,
  targetCarbsPerHour,
  carbRatio,
  flavorRatio = 0,
  flavorCarbFraction = 1,
}) {
  const carbUnits = 1 + carbRatio + flavorRatio * flavorCarbFraction;
  return (saltRatio * SODIUM_MG_PER_G_SALT * targetCarbsPerHour) / carbUnits;
}
