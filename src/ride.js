// Day-of bottle planning: how long are you out, how hard, how hot.
//
// Simpler than the batch calculator: it estimates sodium need from conditions
// alone, with no sweat profile and no salt solving. The point is a number in
// ten seconds while you're filling bottles.
//
// It does use the batch on screen when one is passed in — the calculator is
// right there, so assuming a standard mix would be wrong for anyone who has
// changed the ratio or salt level. `baseRecipeProfile()` is the fallback.

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
// mg/L, which is exactly the variation this page declines to model.
const AVERAGE_SWEAT_SODIUM_MG_PER_L = 950;
const REPLACEMENT_FRACTION = 0.65;

// How much of the sweat lost actually gets drunk. Riders do not replace their
// losses in full — measured fluid replacement in cycling sits near 73%, which
// leaves a small body-mass deficit rather than a matched intake. Treating
// sweat rate as drinking rate overstated bottles by roughly a third.
const FLUID_REPLACEMENT_FRACTION = 0.75;

// Gastric emptying during cycling runs about 18-20 ml/min, so roughly 1.0-1.2
// litres an hour is the ceiling on what can be absorbed however much is
// drunk. Without this, hot and hard predicted 2 L/hr — more than the stomach
// can pass.
export const MAX_FLUID_L_PER_HOUR = 1.2;

/** Litres an hour a rider will actually drink in these conditions. */
export function drinkingRateFor(intensityId, weatherId) {
  const intensity = findIntensity(intensityId) ?? INTENSITIES[1];
  const weather = findWeather(weatherId) ?? WEATHER[1];
  const sweatLitres = weather.litresPerHour * intensity.sweatFactor;
  const wanted = sweatLitres * FLUID_REPLACEMENT_FRACTION;
  return {
    litresPerHour: Math.min(wanted, MAX_FLUID_L_PER_HOUR),
    // True when sweat outpaces what can be absorbed — a real situation in
    // heat, and worth saying rather than quietly capping.
    limitedByStomach: wanted > MAX_FLUID_L_PER_HOUR,
    sweatLitresPerHour: sweatLitres,
  };
}

// Common cycling bottle sizes. Volume matters less for dividing the powder up
// — that's arithmetic — than for concentration, which is the usual culprit
// behind a drink that won't go down.
export const BOTTLE_SIZES = [
  { id: '500', ml: 500, label: '500 ml (17 oz)' },
  { id: '620', ml: 620, label: '620 ml (21 oz)' },
  { id: '710', ml: 710, label: '710 ml (24 oz)' },
  { id: '750', ml: 750, label: '750 ml (26 oz)' },
  { id: '950', ml: 950, label: '950 ml (32 oz)' },
];

// Carbohydrate as a percentage of the drink by weight.
//   ~6-8%   a conventional sports drink, easy to absorb
//   ~9-13%  where a purpose-made fuel mix normally sits
//   13-20%  concentrated; workable with a trained gut, better with water alongside
//   >20%    empties slowly enough to cause trouble for most people
export const CONCENTRATION_BANDS = [
  { id: 'dilute', max: 9, label: 'Dilute', note: 'Gentle on the stomach — closer to a sports drink than a fuel.' },
  { id: 'typical', max: 13, label: 'Typical', note: 'About where a purpose-made endurance mix sits.' },
  { id: 'concentrated', max: 20, label: 'Concentrated', note: 'Strong. Fine if you have practised it, but carry plain water alongside.' },
  { id: 'very-concentrated', max: Infinity, label: 'Very concentrated', note: 'Likely to sit in your stomach. Split the powder across more fluid, or carry a separate water bottle and drink both.' },
];

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

export function findBottle(id) {
  return BOTTLE_SIZES.find((b) => b.id === String(id));
}

export function concentrationBand(percent) {
  return CONCENTRATION_BANDS.find((b) => percent < b.max) ?? CONCENTRATION_BANDS.at(-1);
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
export function planRide({ durationHours, intensityId, weatherId, bottleMl = 750, perGram }) {
  perGram = perGram ?? baseRecipeProfile();
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
    ...bottlePlan({ intensityId, weatherId, durationHours, totalMixGrams, bottleMl }),
  };
}

/**
 * How the powder lands in bottles.
 *
 * Fluid comes from the drinking rate, not the sweat rate — see
 * drinkingRateFor. Sodium still works off sweat, because that is what is
 * actually lost.
 */
function bottlePlan({ intensityId, weatherId, durationHours, totalMixGrams, bottleMl }) {
  const drinking = drinkingRateFor(intensityId, weatherId);
  const fluidMl = drinking.litresPerHour * durationHours * 1000;
  if (!(fluidMl > 0) || !(bottleMl > 0)) return { concentrationPercent: 0 };

  const concentrationPercent = (totalMixGrams / fluidMl) * 100;

  return {
    fluidMl,
    bottleMl,
    bottlesNeeded: fluidMl / bottleMl,
    // Exact rather than derived from a rounded bottle count.
    gramsPerBottle: (totalMixGrams / fluidMl) * bottleMl,
    concentrationPercent,
    concentration: concentrationBand(concentrationPercent),
    litresPerHour: drinking.litresPerHour,
    limitedByStomach: drinking.limitedByStomach,
  };
}
