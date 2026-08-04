// Reference table of flavoring options for The Sauce.
//
// `ratio` / `carbFraction` / `sugarFraction` map directly onto the
// `flavorRatio` / `flavorCarbFraction` / `flavorSugarFraction` inputs of
// computeRecipe() in src/calculator.js. Only "strawberry" has been measured
// against an actual tested batch — everything else is a reasonable starting
// point based on typical product composition. Confirm against the label of
// whatever you actually buy, and adjust to taste.
//
// confidence: 'tested' (measured in a real batch) | 'estimated' (typical
// composition for the category, not lab-verified for this recipe)
//
// `shortName` is what the dropdown shows — a native select can't ellipsize,
// so a long label just runs under the arrow. `name` is the full descriptive
// form used on the recipe cards and the printed ingredients list.
//
// `shareId` is a permanent numeric handle used by the compact share-link
// encoder (src/share.js). It is deliberately explicit rather than derived
// from array position, so reordering or removing an entry can never silently
// change what an existing shared link decodes to. Only ever append new ids.
// (7 was lemon juice powder, dropped — do not reuse it.)

export const FLAVORINGS = [
  {
    id: 'strawberry',
    shortName: 'Strawberry',
    pricePerGram: 26 / 499,
    priceBasis: '$26 / 1.1 lb (499 g)',
    priceConfidence: 'actual',
    shareId: 0,
    name: 'Strawberry (freeze-dried powder)',
    ratio: 0.2,
    carbFraction: 1,
    sugarFraction: 0.6,
    confidence: 'tested',
    note: 'The tested baseline for this recipe. ~60% of the powder’s mass is sugar; the rest is fiber/acid.',
  },
  {
    id: 'other-freeze-dried-fruit',
    shortName: 'Other fruit powder',
    pricePerGram: 26 / 500,
    priceBasis: '~$26 / 500 g, as for strawberry',
    priceConfidence: 'estimated',
    shareId: 1,
    name: 'Other freeze-dried fruit powder (raspberry, mango, etc.)',
    ratio: 0.2,
    carbFraction: 1,
    sugarFraction: 0.6,
    confidence: 'estimated',
    note: 'The same ratio as strawberry, since freeze-dried fruit powders are all roughly whole fruit with the water removed. The most trustworthy of the untested options for that reason, though sharper fruits will carry further per gram.',
  },
  {
    id: 'unsweetened-drink-mix',
    shortName: 'Drink-mix packet',
    pricePerGram: 10 / 80,
    priceBasis: '~$10 / 100 packets (~0.8 g each)',
    priceConfidence: 'estimated',
    shareId: 2,
    name: 'Unsweetened drink-mix packet (True Lemon / True Lime style)',
    ratio: 0.055,
    carbFraction: 0.9,
    sugarFraction: 0,
    confidence: 'estimated',
    note: 'Very concentrated — mostly citric acid with a maltodextrin carrier, no added sugar. The ratio comes from the packet\'s own dosing: 0.8 g per 8 oz works out to about 2.5 g in a 750 ml bottle, roughly 3% of the mix. That is a calculation, not a tasted result, so treat it as a starting point.',
  },
  {
    id: 'kool-aid-unsweetened',
    shortName: 'Kool-Aid style',
    pricePerGram: 0.25 / 3.9,
    priceBasis: '~$0.25 / 3.9 g packet',
    priceConfidence: 'estimated',
    shareId: 3,
    name: 'Unsweetened powdered drink mix (Kool-Aid style)',
    ratio: 0.035,
    carbFraction: 0.5,
    sugarFraction: 0,
    confidence: 'estimated',
    note: 'Citric acid, colour and a little maltodextrin filler; no sugar in the unsweetened packets. A 3.9 g packet is meant to flavour 2 quarts, which is about 1.5 g per 750 ml bottle, or 2% of the mix. Calculated from the packet rather than tasted.',
  },
  {
    id: 'zero-sugar-flavor-drops',
    shortName: 'Zero-sugar drops',
    pricePerGram: 0,
    priceBasis: 'Negligible by mass — dose to taste',
    priceConfidence: 'estimated',
    shareId: 4,
    name: 'Zero-sugar liquid flavor drops (sucralose/stevia-based)',
    perBottle: true,
    perBottleMl: 2,
    pricePerMl: 0.08,
    ratio: 0,
    carbFraction: 0,
    sugarFraction: 0,
    confidence: 'estimated',
    note: 'A liquid dosed by eye, so it belongs in the bottle rather than the batch — the mass is too small to matter to the mix and no ratio would be meaningful. A couple of squirts per bottle, adjusted to taste.',
  },
  {
    id: 'citrus-juice',
    shortName: 'Lemon or lime juice',
    pricePerGram: 0,
    priceBasis: '~$5.50 / 48 fl oz (1420 ml)',
    priceConfidence: 'estimated',
    shareId: 6,
    name: 'Lemon or lime juice',
    // Liquid, so it never goes in the jar — the dry batch stays unflavoured
    // and the juice goes into the bottle at mixing time.
    perBottle: true,
    perBottleMl: 30,
    pricePerMl: 5.5 / 1420,
    carbsPerBottleG: 1.8,
    ratio: 0,
    carbFraction: 0,
    sugarFraction: 0,
    confidence: 'estimated',
    note: 'Probably the best-value flavouring here, and most kitchens already have a bottle. It goes in the bottle rather than the jar, which turns out to be the advantage: you can dial it up or down ride to ride instead of committing a whole batch to one flavour. Roughly 30 ml (2 tbsp) per bottle to start. Juice from concentrate is fine and keeps far longer than fresh.',
  },
  {
    id: 'unflavored',
    shortName: 'Unflavored',
    pricePerGram: 0,
    priceBasis: 'No flavoring',
    priceConfidence: 'actual',
    shareId: 5,
    name: 'Unflavored / plain',
    ratio: 0,
    carbFraction: 0,
    sugarFraction: 0,
    confidence: 'tested',
    note: 'Skips the flavoring slot entirely — batch is just maltodextrin, fructose, and salt.',
  },
];

export function findFlavoring(id) {
  return FLAVORINGS.find((f) => f.id === id);
}
