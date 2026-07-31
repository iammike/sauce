// Per-hour fueling recommendation, built on top of a computed recipe's
// per-scoop nutrition (see calculator.js).
//
// Research targets (see docs/recipe-source.md for sources):
//   - Carbs: 60-90 g/hr for efforts long/hard enough to need dual-transporter fueling
//   - Sodium: 500-1000 mg/hr for an average sweater, up to ~1500 mg/hr hot/heavy

export const CARB_TARGET_RANGE = { min: 60, max: 90 };
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

/** Total scoops (and batches) needed to fuel a ride/run of a given duration. */
export function scoopsForDuration(scoopsPerHour, durationHours, actualBatchGrams, scoopGrams) {
  const totalScoops = scoopsPerHour * durationHours;
  const totalGrams = totalScoops * scoopGrams;
  const batchesNeeded = actualBatchGrams > 0 ? totalGrams / actualBatchGrams : 0;
  return { totalScoops, totalGrams, batchesNeeded };
}
