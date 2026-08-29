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
// Cost is not the only axis, and presenting it alone is misleading: the two
// cheapest options per gram of carbohydrate are a bag of sugar with no sodium
// in it and a hydration drink you'd have to consume nearly two litres an hour
// of to fuel on. Every entry therefore carries a `limitation` — what the price
// doesn't tell you.
//
// `mlPerServing` is the fluid the label prescribes for one serving, which is
// what makes the volume comparison possible. Left null where the dilution
// isn't verified, rather than guessed.
export const COMMERCIAL_PRODUCTS = [
  {
    id: 'gatorade-endurance',
    name: 'Gatorade Endurance Formula',
    pricePerGramPowder: 38.99 / 907,
    carbFraction: 22 / 24,
    sodiumMgPerGramCarb: 300 / 22,
    carbsPerServing: 22,
    mlPerServing: null,
    basis: '$38.99 / 32 oz (907 g); 24 g serving = 22 g carbs, 300 mg sodium',
    confidence: 'actual',
    note: 'Purpose-built endurance fuel and the closest commercial equivalent to this mix. Multiple carb sources, and the only option here that covers a serious sweat rate without added salt. Figures are from the label and a real purchase price.',
    limitation: 'About 2.5x the cost of mixing it yourself, and the carb-to-sodium ratio is fixed — on a cool day you take the same sodium load regardless, since the only way to take less is to take fewer carbs.',
  },
  {
    id: 'maurten-320',
    name: 'Maurten Drink Mix 320',
    pricePerGramCarb: 3.42 / 80,
    carbFraction: 0.97,
    sodiumMgPerGramCarb: 250 / 80,
    carbsPerServing: 80,
    mlPerServing: 500,
    basis: '~$3.42 / sachet; 80 g carbs per sachet in 500 ml',
    confidence: 'estimated',
    note: 'Very high carb density: 80 g in 500 ml, about a quarter the fluid regular Gatorade needs for the same carbs. Worth it if your constraint is stomach volume or carrying capacity.',
    limitation: 'Sodium is under half the replacement target at any realistic intake, so most people add a salt tab — two products, and a higher real cost than the sticker. The density advantage only earns its price at high intakes.',
  },
  {
    // Not a commercial sports drink, but the honest floor of this comparison
    // and the thing people actually ask about (#27): sucrose is glucose and
    // fructose bonded 1:1, which lands inside the optimal ratio band on its
    // own. It sits here rather than in a FAQ because the panel's whole shape
    // — a price next to what the price doesn't cover — is the answer.
    id: 'table-sugar',
    name: 'Table sugar (sucrose)',
    pricePerGramCarb: 4.50 / 1814,
    carbFraction: 1,
    sodiumMgPerGramCarb: 0,
    carbsPerServing: null,
    mlPerServing: null,
    basis: '~$4.50 / 4 lb (1814 g), pure sucrose; no label dilution to quote',
    confidence: 'estimated',
    note: 'The cheapest carbohydrate there is, and a real fuel rather than a joke one: sucrose is glucose and fructose bonded 1:1, so it hits the optimal ratio band with one ingredient. It carries no sodium at all, so a salt source is not optional alongside it.',
    limitation: 'Sweetness is the practical limit, not the ratio. Gram for gram of carbohydrate it lands somewhere between a sixth and two thirds sweeter than this mix, and you cannot dial it back — the ratio is welded at 1:1. That is a lot of sweet to still be drinking at hour four. On concentration it beats loose glucose, but only draws level with this mix: 75 g of carbohydrate in 750 ml is about 292 mOsm/L as sucrose against 286 as this mix, before either gets its salt. The gap only opens at low fructose ratios, where the mix drops to 238 and sugar cannot follow.',
  },
  {
    id: 'gatorade-regular',
    name: 'Gatorade Thirst Quencher (powder)',
    pricePerGramPowder: 0.0101,
    carbFraction: 0.84,
    // Verified from the label: 21 g carbs and 150 mg sodium per 500 ml
    // serving. An earlier estimate here put sodium ~60% too high.
    sodiumMgPerGramCarb: 150 / 21,
    carbsPerServing: 21,
    mlPerServing: 500,
    basis: 'Approximate retail pricing; label serving = 21 g carbs, 150 mg sodium in 500 ml',
    confidence: 'estimated',
    note: 'The cheapest thing here that arrives ready to drink, and fine at what it is for: hydration on shorter sessions. Reasonable sodium, available everywhere, and no weighing.',
    limitation: 'A hydration drink, not a fuel, because of the carb sources. Sucrose and dextrose are small molecules, so each adds an osmotic particle: 9% glucose runs near 500 mOsm/L where 9% maltodextrin is nearer 55, against plasma at roughly 290. Mixed as directed, an endurance carb target means close to two litres an hour. Mixing it stronger makes it hypertonic, so it empties slowly — a volume problem traded for a nausea one.',
  },
];

// What the homemade mix gives up. Included so the comparison isn't one-sided:
// every other product here has its drawback spelled out.
export const HOMEMADE_LIMITATION = 'Nothing checks your work — get the sodium wrong and there is no label to catch it. Ingredients come in kilogram bags, so the up-front cost is high and you commit to four of them before knowing whether you like it. Ride on a batch before it matters.';

// Why the mix leans on maltodextrin rather than sugar. Osmolality depends on
// particle count, not mass: maltodextrin is a polymer, so each molecule
// carries many glucose units while counting once osmotically.
//
// The numbers here were wrong until #27 and both errors flattered the recipe:
// 9% glucose was given as ~1000 mOsm (it is ~500 — 90 g/L over 180 g/mol, and
// D10W's documented 505 mOsm/L agrees — that is 10% dextrose *monohydrate*,
// i.e. 9.1% anhydrous glucose, 100 g/L over 198.17 g/mol, so anyone
// re-deriving it from 100/180 will get 555 and think this is wrong), and 9%
// maltodextrin as "roughly isotonic
// at ~290" (a DE 10 maltodextrin averages ~10 glucose units, so ~1639 g/mol
// and ~55 mOsm/L — strongly hypotonic, which is better than isotonic, not
// worse). The honest version also has to admit where the headroom goes: free
// fructose is a single molecule like glucose, so it dominates the count.
export const OSMOLALITY_NOTE = 'Osmolality depends on how many particles are dissolved, not what they weigh. Maltodextrin is a chain of glucose units, so it counts once while delivering many: at 9% it contributes roughly 55–110 mOsm/L depending on chain length, where 9% glucose contributes about 500 and plasma sits near 290. That headroom is what makes a carb-dense drink possible at all. Free fructose spends it — one molecule, one particle — so at the standard ratio around two thirds of this mix\'s osmoles are fructose and well under a fifth is maltodextrin.';

// The note states numbers on the page, so the page has to carry the source —
// this repo has been bitten before by a claim that lived only in a comment.
export const OSMOLALITY_SOURCE_ID = 'gisolfi-2001';

/** Litres of fluid needed per hour to hit a carb target at label dilution. */
export function litresPerHour(product, targetCarbsPerHour) {
  if (!product.mlPerServing || !product.carbsPerServing) return null;
  const servings = targetCarbsPerHour / product.carbsPerServing;
  return (servings * product.mlPerServing) / 1000;
}

/** Dollars per gram of carbohydrate, however the product's price was recorded. */
export function commercialCostPerGramCarb(product) {
  if (typeof product.pricePerGramCarb === 'number') return product.pricePerGramCarb;
  return product.pricePerGramPowder / product.carbFraction;
}
