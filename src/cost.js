// Cost of a batch, and how it compares to buying a commercial mix.
//
// Everything is normalised on carbohydrate rather than powder weight, because
// carbohydrate is what you're actually buying. Comparing per gram of powder
// would flatter whichever product is most diluted.

import { INGREDIENT_COSTS, COMMERCIAL_PRODUCTS, commercialCostPerGramCarb, litresPerHour } from '../data/costs.js';

/**
 * What a batch costs to make, broken down by ingredient.
 *
 * @param recipeGrams - grams of each ingredient in the batch
 * @param flavorPricePerGram - price of the chosen flavoring (varies hugely)
 */
export function batchCost(recipeGrams, flavorPricePerGram = 0) {
  // Driven by what the batch actually contains rather than a fixed list of
  // four, since the carb base decides which carbs are in it (#30). Flavouring
  // is priced from the caller because that slot's price varies enormously.
  const perIngredient = {};
  for (const [key, grams] of Object.entries(recipeGrams)) {
    const price = key === 'flavoring'
      ? flavorPricePerGram
      : INGREDIENT_COSTS[key]?.pricePerGram ?? 0;
    perIngredient[key] = grams * price;
  }

  const total = Object.values(perIngredient).reduce((sum, v) => sum + v, 0);

  // Share of spend per ingredient — the interesting number, since it rarely
  // matches share of weight.
  const share = {};
  for (const [key, value] of Object.entries(perIngredient)) {
    share[key] = total > 0 ? value / total : 0;
  }

  return { perIngredient, total, share };
}

/**
 * Cost of the mix per gram of carbohydrate, which is the only basis on which
 * mixes of different carb densities can be fairly compared.
 */
export function costPerGramCarb(totalCost, totalCarbsG) {
  return totalCarbsG > 0 ? totalCost / totalCarbsG : 0;
}

/**
 * Cost comparison at a given hourly carb intake — "what does an hour of
 * fueling cost, this way versus buying it".
 */
/**
 * What the homemade mix costs per gram of carbohydrate, per-bottle flavourings
 * included.
 *
 * Extracted from renderCost() so there is one implementation rather than two.
 * A test that recomputed this inline omitted the per-bottle term and still
 * claimed to follow "the same path the page uses" — true for the current
 * defaults, since neither is perBottle, and silently false the moment
 * DEFAULT_FLAVORING_ID names one. Two independent computations of the same
 * number disagreeing is the failure this codebase keeps meeting.
 *
 * @param costTotal - batchCost(...).total for the batch
 * @param carbsG - carbohydrate in the whole batch
 * @param flavor - the resolved flavouring; a perBottle one adds nothing to the
 *   jar but isn't free, so it is amortised over an hour's carbohydrate
 */
export function mixCostPerGramCarb({ costTotal, carbsG, flavor, targetCarbsPerHour }) {
  // Roughly a bottle an hour, which is what the planner assumes too.
  const perBottleCostPerHour = flavor.perBottle
    ? flavor.perBottleMl * flavor.pricePerMl
    : 0;
  return costPerGramCarb(costTotal, carbsG)
    + (targetCarbsPerHour > 0 ? perBottleCostPerHour / targetCarbsPerHour : 0);
}

export function compareAtCarbTarget(mixCostPerGramCarb, targetCarbsPerHour) {
  const mine = mixCostPerGramCarb * targetCarbsPerHour;

  const commercial = COMMERCIAL_PRODUCTS.map((product) => {
    const perGramCarb = commercialCostPerGramCarb(product);
    const perHour = perGramCarb * targetCarbsPerHour;
    return {
      ...product,
      perGramCarb,
      perHour,
      // Computed but deliberately not displayed: a bare "1.8 L/hr" means
      // nothing unless you already know what's a lot. The fluid problem is
      // stated in words in each product's `limitation` instead. Kept here
      // because the tests use it to assert those words stay true.
      litresPerHour: litresPerHour(product, targetCarbsPerHour),
      sodiumMgPerHour: product.sodiumMgPerGramCarb * targetCarbsPerHour,
      // How many times more expensive than making it yourself. Below 1 means
      // the commercial option is actually cheaper — true for regular Gatorade,
      // and worth showing rather than hiding.
      multiple: mine > 0 ? perHour / mine : 0,
    };
  }).sort((a, b) => a.perHour - b.perHour);

  return { mine, commercial };
}
