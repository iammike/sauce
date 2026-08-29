import { CARB_BASES, DEFAULT_CARB_BASE, findCarbBase, baseIngredientKeys } from '../data/carb-bases.js';

export { CARB_BASES, DEFAULT_CARB_BASE, findCarbBase };

// Batch/recipe math for The Sauce hydration mix.
// Ratios are "grams per 1 g of the base's reference carb," taken from the
// tested recipe
// (see docs/recipe-source.md). Salt profile is one input that varies on a
// fixed menu; flavoring is a free slot — any powder, any ratio, any sugar
// content — since the recipe isn't tied to strawberry specifically. The carb
// base itself varies too (see data/carb-bases.js), so nothing here may assume
// maltodextrin and fructose are the carbs.

// Maltodextrin is the reference unit (always 1). Fructose is expressed
// relative to it and is a caller-supplied input, because the glucose:fructose
// ratio is the main lever for how many carbs/hr the gut can absorb — see
// data/recipes.js and docs/recipe-source.md.
//
// 0.8 rather than the 0.65 originally mixed: O'Brien et al. 2013 rode 0.5, 0.8
// and 1.25 head to head at 90 g/hr and 0.8 won. 1.25 placed between the other
// two, so 0.8 is a peak, not a floor — don't drift the default above it.
export const DEFAULT_CARB_RATIO = 0.8; // g fructose per 1g maltodextrin

// Defaults match the tested recipe's strawberry powder, but every one of
// these is a caller-supplied input, not a fixed constant.
export const DEFAULT_FLAVOR_RATIO = 0.2; // g flavoring per 1g maltodextrin
export const DEFAULT_FLAVOR_CARB_FRACTION = 1; // fraction of flavoring mass that's carbohydrate
export const DEFAULT_FLAVOR_SUGAR_FRACTION = 0.6; // fraction of flavoring mass that's sugar (rest is fiber/acid/other)

// Notes describe what the level is for rather than a milligrams-per-scoop
// figure — scoops are no longer the unit anywhere, and the actual sodium
// depends on how much you drink per hour, which the batch can't know.
// Expressed as grams of salt per gram of CARBOHYDRATE, not per gram of the
// reference carb. You dose by carbohydrate, so that is the only definition
// under which "Endurance" means the same sodium per hour whatever else moves.
//
// Per-reference-carb was the old definition and it drifted: raising the
// fructose ratio 0.65 -> 0.8 quietly took endurance from 619 to 573 mg/hr,
// and a single-carb base (table sugar, #30) would have jumped it to 955 —
// same label on the select, 66% more salt in the jar. These values are the
// shipped ones back-derived at the 0.8 default, so today's batch is unchanged.
export const SALT_PROFILES = {
  moderate: { saltPerCarb: 0.0230, label: 'Moderate', note: 'Least salty. Cool weather, shorter efforts.' },
  endurance: { saltPerCarb: 0.0325, label: 'Endurance', note: 'The tested default, and a sensible general-purpose batch.' },
  hot: { saltPerCarb: 0.0425, label: 'Hot / heavy sweat', note: 'As salty as the mix takes before you taste it.' },
};

// Named rather than left as "the first key" — SALT_PROFILES is ordered by
// increasing salt concentration (moderate, endurance, hot), not by which one
// is the default, so Object.keys(SALT_PROFILES)[0] would silently pick
// 'moderate'. This is the one every caller falling back to "the tested
// recipe" should use.
export const DEFAULT_SALT_PROFILE = 'endurance';

// Sodium citrate dihydrate. (Table salt/NaCl is ~393 mg Na/g — do not use that
// figure here; an earlier version of the source spreadsheet did, and overstated
// sodium by ~40%.)
export const SODIUM_MG_PER_G_SALT = 235;

export const CALORIES_PER_G_CARB = 4;

// The ingredient list is derived from the chosen carb base rather than fixed,
// so a single-carb base (table sugar, #30) doesn't have to carry a phantom
// second carb at ratio 0. Flavouring and salt apply to every base.
function ingredientsFor(base) {
  return [...baseIngredientKeys(base), 'flavoring', 'salt'];
}

// An explicit saltRatio wins over the named profile. That's how a solved
// formulation (see src/sodium.js) gets in — the profiles become presets
// rather than the only available salt levels.
function ratiosFor(base, saltProfile, carbRatio, flavorRatio, saltRatio, flavorCarbFraction) {
  let salt = saltRatio;
  let saltPerCarb = 0;
  if (typeof salt !== 'number' || !Number.isFinite(salt) || salt < 0) {
    const profile = SALT_PROFILES[saltProfile];
    if (!profile) throw new Error(`Unknown salt profile: ${saltProfile}`);
    saltPerCarb = profile.saltPerCarb;
    salt = null;
  }

  const ratios = { flavoring: flavorRatio };
  for (const part of base.parts) {
    // 'carbRatio' is the one ratio the user sets; the rest are the base's own.
    ratios[part.key] = part.ratio === 'carbRatio' ? carbRatio : part.ratio;
  }

  // Salt scales with the carbohydrate the batch actually carries, so the
  // profile delivers its sodium per gram of carb whatever the base or ratio.
  // An explicit saltRatio (from the parked src/sodium.js solver) stays a raw
  // per-reference-carb ratio and bypasses this.
  ratios.salt = salt ?? carbSumFor(base, ratios, flavorCarbFraction) * saltPerCarb;
  return ratios;
}

/** Carbohydrate per 1 g of the base's reference carb, flavouring included. */
function carbSumFor(base, ratios, flavorCarbFraction) {
  return base.parts.reduce((sum, p) => sum + ratios[p.key] * p.carbFraction, 0)
    + ratios.flavoring * flavorCarbFraction;
}

/**
 * Given what you have on hand, figure out the biggest batch you can make
 * without running out of any single ingredient, then return the recipe,
 * yield, and per-scoop nutrition for that batch.
 *
 * @param {object} onHand - grams available: { maltodextrin, fructose, flavoring, salt }
 * @param {string} saltProfile - one of SALT_PROFILES keys
 * @param {number} [saltRatio] - explicit g salt per 1g maltodextrin; overrides saltProfile
 * @param {number} [maxBatchGrams] - optional hard cap on total batch weight
 * @param {number} scoopGrams - grams per scoop
 * @param {number} [carbRatio] - g fructose per 1g maltodextrin; the glucose:fructose lever
 * @param {string} [flavorName] - display name for the flavoring in use (e.g. "Strawberry", "Fruit punch", "Unflavored")
 * @param {number} [flavorRatio] - g flavoring per 1g maltodextrin; varies by product concentration
 * @param {number} [flavorCarbFraction] - fraction of flavoring mass that's carbohydrate (0 for a non-caloric flavor/color powder)
 * @param {number} [flavorSugarFraction] - fraction of flavoring mass that's sugar
 */
export function computeRecipe({
  onHand,
  saltProfile,
  saltRatio,
  maxBatchGrams,
  scoopGrams,
  carbBase = DEFAULT_CARB_BASE,
  carbRatio = DEFAULT_CARB_RATIO,
  flavorName = 'Flavoring',
  flavorRatio = DEFAULT_FLAVOR_RATIO,
  flavorCarbFraction = DEFAULT_FLAVOR_CARB_FRACTION,
  flavorSugarFraction = DEFAULT_FLAVOR_SUGAR_FRACTION,
}) {
  // Resolved once here and threaded through, the same rule #16/#19/#20
  // established for the flavouring, scoop size and salt profile: a second
  // independent resolution can disagree with this one's fallback.
  const base = findCarbBase(carbBase) ?? findCarbBase(DEFAULT_CARB_BASE);
  const INGREDIENTS = ingredientsFor(base);

  const ratios = ratiosFor(base, saltProfile, carbRatio, flavorRatio, saltRatio, flavorCarbFraction);
  const sumRatio = INGREDIENTS.reduce((sum, key) => sum + ratios[key], 0);

  const candidates = INGREDIENTS
    .filter((key) => ratios[key] > 0)
    .map((key) => ({
      key,
      maxBatch: ((onHand[key] ?? 0) / ratios[key]) * sumRatio,
    }));

  const limitingCandidate = candidates.reduce((min, c) => (c.maxBatch < min.maxBatch ? c : min));

  let actualBatch = limitingCandidate.maxBatch;
  let limiting = limitingCandidate.key;
  if (typeof maxBatchGrams === 'number' && maxBatchGrams < actualBatch) {
    actualBatch = maxBatchGrams;
    limiting = 'cap';
  }

  const recipeGrams = {};
  for (const key of INGREDIENTS) {
    recipeGrams[key] = actualBatch * (ratios[key] / sumRatio);
  }

  const totalScoops = scoopGrams > 0 ? actualBatch / scoopGrams : 0;

  // Summed from the base's own parts rather than named ingredients. Keying
  // sugars to `fructose` was correct only while fructose was the only sugar
  // in the jar — sucrose is entirely sugar, and getting this wrong is a
  // nutrition-label error rather than a cosmetic one.
  const carbsG = base.parts.reduce((sum, p) => sum + recipeGrams[p.key] * p.carbFraction, 0)
    + recipeGrams.flavoring * flavorCarbFraction;
  const sugarsG = base.parts.reduce((sum, p) => sum + recipeGrams[p.key] * p.sugarFraction, 0)
    + recipeGrams.flavoring * flavorSugarFraction;
  const sodiumMg = recipeGrams.salt * SODIUM_MG_PER_G_SALT;
  const calories = carbsG * CALORIES_PER_G_CARB;

  const perScoop = totalScoops > 0
    ? {
        carbsG: carbsG / totalScoops,
        sugarsG: sugarsG / totalScoops,
        sodiumMg: sodiumMg / totalScoops,
        calories: calories / totalScoops,
      }
    : { carbsG: 0, sugarsG: 0, sodiumMg: 0, calories: 0 };

  // Nutrition per gram of finished mix. This is a property of the formulation
  // alone — it does not depend on scoop size, which is why per-hour fueling
  // math should be built on it rather than on per-scoop values.
  const perGram = actualBatch > 0
    ? {
        carbsG: carbsG / actualBatch,
        sugarsG: sugarsG / actualBatch,
        sodiumMg: sodiumMg / actualBatch,
        calories: calories / actualBatch,
      }
    : { carbsG: 0, sugarsG: 0, sodiumMg: 0, calories: 0 };

  return {
    flavorName,
    ratios,
    sumRatio,
    actualBatch,
    limiting,
    recipeGrams,
    totalScoops,
    totals: { carbsG, sugarsG, sodiumMg, calories },
    perScoop,
    perGram,
  };
}
