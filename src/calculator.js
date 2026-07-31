// Batch/recipe math for The Sauce hydration mix.
// Ratios are "grams per 1 g of maltodextrin," taken from the tested recipe
// (see docs/recipe-source.md). Salt profile is one input that varies on a
// fixed menu; flavoring is a free slot — any powder, any ratio, any sugar
// content — since the recipe isn't tied to strawberry specifically.

// Maltodextrin is the reference unit (always 1). Fructose is expressed
// relative to it and is a caller-supplied input, because the glucose:fructose
// ratio is the main lever for how many carbs/hr the gut can absorb — see
// data/recipes.js and docs/recipe-source.md.
export const DEFAULT_CARB_RATIO = 0.65; // g fructose per 1g maltodextrin

// Defaults match the tested recipe's strawberry powder, but every one of
// these is a caller-supplied input, not a fixed constant.
export const DEFAULT_FLAVOR_RATIO = 0.2; // g flavoring per 1g maltodextrin
export const DEFAULT_FLAVOR_CARB_FRACTION = 1; // fraction of flavoring mass that's carbohydrate
export const DEFAULT_FLAVOR_SUGAR_FRACTION = 0.6; // fraction of flavoring mass that's sugar (rest is fiber/acid/other)

export const SALT_PROFILES = {
  moderate: { ratio: 0.046, label: 'Moderate', note: '~147 mg Na/scoop' },
  endurance: { ratio: 0.065, label: 'Endurance', note: '~206 mg Na/scoop' },
  hot: { ratio: 0.085, label: 'Hot / heavy sweat', note: '~264 mg Na/scoop' },
};

// Sodium citrate dihydrate. (Table salt/NaCl is ~393 mg Na/g — do not use that
// figure here; an earlier version of the source spreadsheet did, and overstated
// sodium by ~40%.)
export const SODIUM_MG_PER_G_SALT = 235;

export const CALORIES_PER_G_CARB = 4;

const INGREDIENTS = ['maltodextrin', 'fructose', 'flavoring', 'salt'];

function ratiosFor(saltProfile, carbRatio, flavorRatio) {
  const profile = SALT_PROFILES[saltProfile];
  if (!profile) throw new Error(`Unknown salt profile: ${saltProfile}`);
  return {
    maltodextrin: 1,
    fructose: carbRatio,
    flavoring: flavorRatio,
    salt: profile.ratio,
  };
}

/**
 * Given what you have on hand, figure out the biggest batch you can make
 * without running out of any single ingredient, then return the recipe,
 * yield, and per-scoop nutrition for that batch.
 *
 * @param {object} onHand - grams available: { maltodextrin, fructose, flavoring, salt }
 * @param {string} saltProfile - one of SALT_PROFILES keys
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
  maxBatchGrams,
  scoopGrams,
  carbRatio = DEFAULT_CARB_RATIO,
  flavorName = 'Flavoring',
  flavorRatio = DEFAULT_FLAVOR_RATIO,
  flavorCarbFraction = DEFAULT_FLAVOR_CARB_FRACTION,
  flavorSugarFraction = DEFAULT_FLAVOR_SUGAR_FRACTION,
}) {
  const ratios = ratiosFor(saltProfile, carbRatio, flavorRatio);
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

  const carbsG = recipeGrams.maltodextrin + recipeGrams.fructose
    + recipeGrams.flavoring * flavorCarbFraction;
  const sugarsG = recipeGrams.fructose + recipeGrams.flavoring * flavorSugarFraction;
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
