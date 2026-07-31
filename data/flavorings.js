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

export const FLAVORINGS = [
  {
    id: 'strawberry',
    name: 'Strawberry (freeze-dried powder)',
    ratio: 0.2,
    carbFraction: 1,
    sugarFraction: 0.6,
    confidence: 'tested',
    note: 'The tested Daddy Pig Industries recipe baseline. ~60% of the powder’s mass is sugar; the rest is fiber/acid.',
  },
  {
    id: 'other-freeze-dried-fruit',
    name: 'Other freeze-dried fruit powder (raspberry, mango, etc.)',
    ratio: 0.2,
    carbFraction: 1,
    sugarFraction: 0.6,
    confidence: 'estimated',
    note: 'Assumes similar composition to strawberry powder. Freeze-dried fruit powders vary — check the label’s carb/sugar-per-gram if you want to dial this in.',
  },
  {
    id: 'unsweetened-drink-mix',
    name: 'Unsweetened drink-mix packet (True Lemon / True Lime style)',
    ratio: 0.02,
    carbFraction: 0.9,
    sugarFraction: 0,
    confidence: 'estimated',
    note: 'Very concentrated — mostly citric acid plus a maltodextrin/gum carrier, no added sugar. Start with a pinch and taste before committing a full batch.',
  },
  {
    id: 'kool-aid-unsweetened',
    name: 'Unsweetened powdered drink mix (Kool-Aid style)',
    ratio: 0.03,
    carbFraction: 0.5,
    sugarFraction: 0,
    confidence: 'estimated',
    note: 'Citric acid, color, and a small amount of maltodextrin filler — no sugar in the unsweetened packets.',
  },
  {
    id: 'zero-sugar-flavor-drops',
    name: 'Zero-sugar liquid flavor drops (sucralose/stevia-based)',
    ratio: 0.01,
    carbFraction: 0,
    sugarFraction: 0,
    confidence: 'estimated',
    note: 'Negligible mass and calories — add drop by drop to taste rather than scaling with the batch ratios.',
  },
  {
    id: 'unflavored',
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
