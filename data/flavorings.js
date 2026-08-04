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
    note: 'The tested Daddy Pig Industries recipe baseline. ~60% of the powder’s mass is sugar; the rest is fiber/acid.',
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
    note: 'Assumes similar composition to strawberry powder. Freeze-dried fruit powders vary — check the label’s carb/sugar-per-gram if you want to dial this in.',
  },
  {
    id: 'unsweetened-drink-mix',
    shortName: 'Drink-mix packet',
    pricePerGram: 10 / 80,
    priceBasis: '~$10 / 100 packets (~0.8 g each)',
    priceConfidence: 'estimated',
    shareId: 2,
    name: 'Unsweetened drink-mix packet (True Lemon / True Lime style)',
    ratio: 0.02,
    carbFraction: 0.9,
    sugarFraction: 0,
    confidence: 'estimated',
    note: 'Very concentrated — mostly citric acid plus a maltodextrin/gum carrier, no added sugar. Start with a pinch and taste before committing a full batch.',
  },
  {
    id: 'kool-aid-unsweetened',
    shortName: 'Kool-Aid style',
    pricePerGram: 0.25 / 3.9,
    priceBasis: '~$0.25 / 3.9 g packet',
    priceConfidence: 'estimated',
    shareId: 3,
    name: 'Unsweetened powdered drink mix (Kool-Aid style)',
    ratio: 0.03,
    carbFraction: 0.5,
    sugarFraction: 0,
    confidence: 'estimated',
    note: 'Citric acid, color, and a small amount of maltodextrin filler — no sugar in the unsweetened packets.',
  },
  {
    id: 'zero-sugar-flavor-drops',
    shortName: 'Zero-sugar drops',
    pricePerGram: 0,
    priceBasis: 'Negligible by mass — dose to taste',
    priceConfidence: 'estimated',
    shareId: 4,
    name: 'Zero-sugar liquid flavor drops (sucralose/stevia-based)',
    ratio: 0.01,
    carbFraction: 0,
    sugarFraction: 0,
    confidence: 'estimated',
    note: 'Negligible mass and calories — add drop by drop to taste rather than scaling with the batch ratios.',
  },
  {
    id: 'lemon-powder',
    shortName: 'Lemon juice powder',
    pricePerGram: 18 / 283,
    priceBasis: '~$18 / 10 oz (283 g)',
    priceConfidence: 'estimated',
    shareId: 7,
    name: 'Lemon juice powder',
    ratio: 0.10,
    carbFraction: 0.9,
    sugarFraction: 0.35,
    confidence: 'estimated',
    note: 'Dehydrated lemon juice — the citrus option that actually works in a dry batch, unlike the bottled liquid. Tart rather than sweet, which cuts through maltodextrin better than a fruit powder does. Start below the default ratio and work up; it is sharper than it looks.',
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
    note: 'Cheap, easy to find, and it cuts the sweetness of a maltodextrin mix better than most powders. Being a liquid it cannot go in the jar — keep the batch unflavoured and add roughly 30 ml (2 tbsp) per bottle when you mix. Bottled juice from concentrate is fine and keeps far longer than fresh.',
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
