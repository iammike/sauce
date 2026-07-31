// Ingredient prices and commercial comparisons.
//
// PRICES MOVE. Everything here is an estimate with a date attached, shown on
// the page as such — the point is the order-of-magnitude comparison, not
// precision to the cent. Re-check periodically and bump PRICED_AS_OF.
//
// Flavoring costs live on the flavorings themselves (data/flavorings.js),
// since that ingredient is a free slot and its price varies enormously —
// freeze-dried fruit powder is the single biggest cost lever in the mix.

export const PRICED_AS_OF = 'May 2026';

export const INGREDIENT_COSTS = {
  maltodextrin: {
    pricePerGram: 23 / 1814,
    basis: '$23 / 4 lb (1814 g)',
    product: 'Nutricost Maltodextrin Powder',
    confidence: 'actual',
  },
  fructose: {
    pricePerGram: 17 / 1361,
    // Recorded against a single 3 lb bag. The product currently linked in
    // data/products.js is a 2-pack, so confirm the per-gram price still holds
    // next time these are refreshed.
    basis: '$17 / 3 lb (1361 g)',
    product: 'Now Foods Fructose Fruit Sugar',
    confidence: 'actual',
  },
  salt: {
    pricePerGram: 10 / 397,
    basis: '$10 / 14 oz (397 g)',
    product: 'Sodium citrate dihydrate',
    confidence: 'actual',
  },
};

// Normalised on carbohydrate, because that's what you're actually buying —
// the products differ in carb density, so comparing per gram of powder would
// flatter whichever is most diluted.
//
// `carbFraction` is carbohydrate as a share of powder weight.
// `sodiumMgPerServing` / `carbsPerServing` describe one label serving.
export const COMMERCIAL_PRODUCTS = [
  {
    id: 'gatorade-endurance',
    name: 'Gatorade Endurance Formula',
    pricePerGramPowder: 38.99 / 907,
    carbFraction: 22 / 24,
    sodiumMgPerGramCarb: 300 / 22,
    basis: '$38.99 / 32 oz (907 g); 24 g serving = 22 g carbs, 300 mg sodium',
    confidence: 'actual',
    note: 'Read off the label and a real purchase price. The closest commercial equivalent to what this mix is for.',
  },
  {
    id: 'maurten-320',
    name: 'Maurten Drink Mix 320',
    pricePerGramCarb: 3.42 / 80,
    carbFraction: 0.97,
    sodiumMgPerGramCarb: 250 / 80,
    basis: '~$3.42 / sachet; 80 g carbs per sachet',
    confidence: 'estimated',
    note: 'The premium benchmark. Hydrogel formulation, priced accordingly.',
  },
  {
    id: 'gatorade-regular',
    name: 'Gatorade powder (regular)',
    pricePerGramPowder: 0.0101,
    carbFraction: 0.84,
    sodiumMgPerGramCarb: 850 / 75,
    basis: 'Approximate retail pricing',
    confidence: 'estimated',
    note: 'Cheapest per gram of carb, but it is a general sports drink rather than concentrated endurance fuel — a different tool for a different job.',
  },
];

/** Dollars per gram of carbohydrate, however the product's price was recorded. */
export function commercialCostPerGramCarb(product) {
  if (typeof product.pricePerGramCarb === 'number') return product.pricePerGramCarb;
  return product.pricePerGramPowder / product.carbFraction;
}
