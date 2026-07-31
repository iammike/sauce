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
// Cost is not the only axis, and presenting it alone is misleading: the
// cheapest option per gram of carbohydrate is a hydration drink you'd have to
// consume nearly two litres an hour of to fuel on. Every entry therefore
// carries a `limitation` — what the price doesn't tell you.
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
    note: 'Purpose-built endurance fuel, and the closest commercial equivalent to what this mix is trying to be. Multiple carbohydrate sources, and by a distance the best electrolyte profile here — it is the only option on this page that covers a serious sweat rate without anything added to it. Figures are from an actual label and an actual purchase price, so this is the most trustworthy comparison of the four.',
    limitation: 'Two things. First, price: roughly two and a half times what the same carbohydrate costs to mix yourself, and that gap compounds over a season rather than a ride. Second, and more interesting, the carb-to-sodium ratio is fixed. It is generous sodium, which suits a heavy sweater in the heat — but on a cool day at an easy pace you are taking that same sodium load whether you need it or not, because the only way to take less is to take fewer carbs. That coupling is exactly what a homemade mix breaks, and it is worth more than the money.',
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
    note: 'The premium benchmark, and genuinely good at the thing it is designed for: getting a lot of carbohydrate down in very little fluid. The hydrogel encapsulation is the differentiator — 80 g of carbohydrate in 500 ml, which is roughly a quarter of the fluid regular Gatorade needs for the same fuel. If your constraint is stomach volume or how much you can carry, that matters.',
    limitation: 'The sodium is the problem, and it is not marginal — well under half the replacement target at any realistic carb intake, so most people end up taking a salt tab alongside it. That means the true cost is higher than the sticker, and you are managing two products instead of one. It is also the most expensive option here per gram of carbohydrate, and the hydrogel benefit is most defensible at very high intakes; at 60 g/hr you are paying a premium for headroom you are not using.',
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
    note: 'Cheapest per gram of carbohydrate by a wide margin, and there is nothing wrong with it — for what it is. As a hydration drink for shorter or hotter sessions it works, tastes fine, and is available everywhere. The sodium is reasonable and the price is unbeatable. It only becomes the wrong tool when you ask it to be fuel.',
    limitation: 'It is a hydration drink, not a fuel, and the carbs are the reason. Sucrose and dextrose are small molecules, so each one adds an osmotic particle: a 9% glucose solution runs near 1000 mOsm/kg where 9% maltodextrin is roughly isotonic at ~290. That caps how concentrated it can usefully get. Mixed as directed, hitting a real endurance carb target means drinking close to two litres an hour — more than most people can stomach while working hard, and more than anyone wants to carry. Mixing it stronger to avoid that just makes it hypertonic, so it sits in your stomach instead of emptying, and you trade a volume problem for a nausea one. There is no dilution that makes it work.',
  },
];

// What the homemade mix gives up. Included so the comparison isn't one-sided:
// every other product here has its drawback spelled out.
export const HOMEMADE_LIMITATION = 'The obvious costs are effort and trust: you weigh four ingredients on a scale, source them separately, and there is no third-party testing standing behind the result — if you misread the sodium, nothing catches it. The subtler cost is that every decision is now yours. Dilution, salt level, ratio and flavour are all unset defaults rather than someone else\'s tested formulation, which is the whole advantage and also the whole risk. It is worth making a batch and riding on it before it matters, and worth re-checking your arithmetic the first time. There is also a floor on how little you can buy: the ingredients arrive in kilogram quantities, so the first batch costs far more than a serving of anything else here.';

// Why the mix is mostly maltodextrin rather than sugar. Osmolality depends on
// particle count, not mass: maltodextrin is a polymer, so each molecule
// carries many glucose units while counting once osmotically. That is what
// lets a drink be carb-dense without being hypertonic.
export const OSMOLALITY_NOTE = 'Maltodextrin is why this works. Osmolality depends on how many particles are in solution, not how much they weigh — and because maltodextrin is a chain of glucose units, it counts as one particle while delivering many. A 9% maltodextrin solution is roughly isotonic at ~290 mOsm/kg; the same carbohydrate as glucose would be nearer 1000. That is the difference between a drink you can concentrate into fuel and one you cannot.';

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
