// Day-of bottle planning: how long are you out, how hard, how hot.
//
// Deliberately simpler than the batch calculator. It assumes the base recipe
// rather than reading your actual formulation, and it estimates sodium from
// conditions alone — no sweat profile, no salt solving. The point is a number
// in ten seconds while you're filling bottles, not an accurate model.
//
// Anything more precise lives on the batch calculator, which knows what you
// actually mixed.

import { computeRecipe, DEFAULT_CARB_RATIO, DEFAULT_FLAVOR_RATIO } from './calculator.js';
import { CARB_INTAKE_TIERS, DUAL_TRANSPORT_TYPICAL } from './hourly.js';

export const INTENSITIES = [
  { id: 'easy', label: 'Easy', note: 'Conversational, endurance pace', position: 0, sweatFactor: 0.75 },
  { id: 'moderate', label: 'Moderate', note: 'Steady, working but sustainable', position: 0.5, sweatFactor: 1.0 },
  { id: 'hard', label: 'Hard', note: 'Race pace, or repeated efforts', position: 1, sweatFactor: 1.35 },
];

export const WEATHER = [
  { id: 'cool', label: 'Cool', note: 'Under ~10°C / 50°F', litresPerHour: 0.4 },
  { id: 'mild', label: 'Mild', note: 'Around 10–20°C / 50–68°F', litresPerHour: 0.7 },
  { id: 'warm', label: 'Warm', note: 'Around 20–28°C / 68–82°F', litresPerHour: 1.1 },
  { id: 'hot', label: 'Hot', note: 'Above ~28°C / 82°F', litresPerHour: 1.5 },
];

// Average sweat sodium. Individual values range from roughly 500 to 1300
// mg/L, which is exactly the variation this page declines to model — the
// batch calculator asks about it if you want that precision.
const AVERAGE_SWEAT_SODIUM_MG_PER_L = 950;
const REPLACEMENT_FRACTION = 0.65;

// A typical electrolyte capsule. Products vary a lot; this is only used to
// turn a milligram figure into something countable.
export const SALT_CAPSULE_MG = 300;

/** Nutrition per gram of the base recipe, so the page doesn't need a batch. */
export function baseRecipeProfile() {
  const recipe = computeRecipe({
    onHand: { maltodextrin: 1e6, fructose: 1e6, flavoring: 1e6, salt: 1e6 },
    saltProfile: 'endurance',
    maxBatchGrams: 1000,
    scoopGrams: 1000,
    carbRatio: DEFAULT_CARB_RATIO,
    flavorRatio: DEFAULT_FLAVOR_RATIO,
  });
  return recipe.perGram;
}

export function findIntensity(id) {
  return INTENSITIES.find((i) => i.id === id);
}

export function findWeather(id) {
  return WEATHER.find((w) => w.id === id);
}

/**
 * Duration picks the carb band; intensity picks where you sit inside it.
 * That's the same rule stated on the batch page, applied automatically.
 */
export function carbTargetFor(durationHours, intensityId) {
  const intensity = findIntensity(intensityId) ?? INTENSITIES[1];
  const tier = CARB_INTAKE_TIERS.reduce(
    (best, t) => (durationHours * 60 >= tierMinutes(t) ? t : best),
    CARB_INTAKE_TIERS[0],
  );
  const [min, max] = tier.range;
  return { tier, gramsPerHour: Math.round(min + (max - min) * intensity.position) };
}

// Lower bound of each tier in minutes, from its duration label.
function tierMinutes(tier) {
  return { 30: 0, 60: 60, 90: 150, 120: 240 }[tier.gramsPerHour] ?? 0;
}

/**
 * Rough sodium need from conditions alone. Weather sets the sweat rate,
 * intensity scales it. No individual sweat profile — see the note above.
 */
export function sodiumNeedFor(intensityId, weatherId) {
  const intensity = findIntensity(intensityId) ?? INTENSITIES[1];
  const weather = findWeather(weatherId) ?? WEATHER[1];
  const litres = weather.litresPerHour * intensity.sweatFactor;
  return Math.round(litres * AVERAGE_SWEAT_SODIUM_MG_PER_L * REPLACEMENT_FRACTION);
}

/** The whole plan for one ride. */
export function planRide({ durationHours, intensityId, weatherId }) {
  const perGram = baseRecipeProfile();
  const { tier, gramsPerHour } = carbTargetFor(durationHours, intensityId);

  const mixGramsPerHour = perGram.carbsG > 0 ? gramsPerHour / perGram.carbsG : 0;
  const totalMixGrams = mixGramsPerHour * durationHours;

  const sodiumFromMix = perGram.sodiumMg * mixGramsPerHour;
  const sodiumNeed = sodiumNeedFor(intensityId, weatherId);
  const sodiumGap = sodiumNeed - sodiumFromMix;

  // Round hard — this is a rough estimate and precise-looking numbers would
  // overstate how much it knows.
  const extraSodiumPerHour = sodiumGap > 100 ? Math.round(sodiumGap / 50) * 50 : 0;

  return {
    tier,
    carbsPerHour: gramsPerHour,
    totalCarbs: Math.round(gramsPerHour * durationHours),
    mixGramsPerHour,
    totalMixGrams,
    sodiumFromMix,
    sodiumNeed,
    extraSodiumPerHour,
    capsulesPerHour: extraSodiumPerHour > 0
      ? Math.round((extraSodiumPerHour / SALT_CAPSULE_MG) * 2) / 2
      : 0,
    // Above this, intake stops being a "just drink more" problem and needs a
    // trained gut. Worth saying rather than quietly recommending it.
    needsTrainedGut: gramsPerHour > DUAL_TRANSPORT_TYPICAL,
    // A short easy ride genuinely needs nothing. Saying so is more useful
    // than printing a recipe for 0 g of powder.
    nothingNeeded: gramsPerHour === 0,
  };
}
