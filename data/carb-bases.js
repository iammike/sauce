// The carbohydrate half of the formulation, as data rather than as hardcoded
// ingredient keys.
//
// The batch used to be welded to maltodextrin + fructose: src/calculator.js
// carried a literal INGREDIENTS list and computed sugars as
// `recipeGrams.fructose + ...`. Sucrose replaces both carbs and is entirely
// sugar, so that arithmetic can't be keyed to `fructose` any more (#30).
//
// Each part carries:
//   key           the recipeGrams / onHand key, and the INGREDIENT_COSTS key
//   ratio         grams per 1 g of the reference part, or 'carbRatio' to take
//                 the user's fructose:glucose value
//   carbFraction  fraction of the part's mass that is carbohydrate
//   sugarFraction fraction of the part's mass that is sugar, for the label's
//                 "of which sugars" line. Maltodextrin is a glucose polymer
//                 and doesn't count; sucrose and fructose are both 1.
//
// Flavouring and salt are not here. They apply to every base — salt most of
// all, since sucrose brings none of its own.
export const CARB_BASES = {
  'malto-fructose': {
    id: 'malto-fructose',
    // shortName is what the <select> shows and must fit the control — a
    // native select doesn't ellipsize, it runs the label under the arrow.
    // "Maltodextrin + fructose" measured 170px against a 136px content box
    // at 1024. Detail belongs in the hint, not the option text.
    shortName: 'Malto + fructose',
    // The ratio control only means something when there are two carbs to
    // hold in a ratio.
    adjustableRatio: true,
    note: 'The tested base. Two powders, and the glucose:fructose ratio is yours to set.',
    ratioHint: 'Grams of fructose per gram of maltodextrin, which digests to glucose. The research writes the ratio this way round.',
    parts: [
      { key: 'maltodextrin', name: 'Maltodextrin', ratio: 1, carbFraction: 1, sugarFraction: 0 },
      { key: 'fructose', name: 'Fructose', ratio: 'carbRatio', carbFraction: 1, sugarFraction: 1 },
    ],
  },
  sucrose: {
    id: 'sucrose',
    shortName: 'Table sugar',
    // Sucrose IS glucose+fructose bonded 1:1. There is no ratio to set —
    // the molecule fixes it — so the control is shown locked rather than
    // hidden, because "why can't I change this" is the obvious question.
    adjustableRatio: false,
    fixedCarbRatio: 1,
    // On the base rather than in app.js: a second fixed-ratio base would make
    // a hardcoded sentence about sucrose a lie.
    fixedRatioNote: 'Fixed by the carbohydrate — sucrose is one glucose bonded to one fructose.',
    note: 'One ingredient, glucose and fructose bonded 1:1. Cheapest by a distance, but it carries no sodium and the ratio is not yours to move.',
    ratioHint: 'Sucrose is one glucose bonded to one fructose, so the ratio is a property of the molecule rather than something you weigh out. Switch to maltodextrin + fructose to move it.',
    parts: [
      { key: 'sucrose', name: 'Sugar (sucrose)', ratio: 1, carbFraction: 1, sugarFraction: 1 },
    ],
  },
};

// Named rather than Object.keys(CARB_BASES)[0], for the same reason
// DEFAULT_SALT_PROFILE and DEFAULT_FLAVORING_ID are named: the object's order
// is about how the options should read, not about which one is the default.
export const DEFAULT_CARB_BASE = 'malto-fructose';

export function findCarbBase(id) {
  return Object.prototype.hasOwnProperty.call(CARB_BASES, id) ? CARB_BASES[id] : undefined;
}

/** Every ingredient key a base uses, in the order it should be listed. */
export function baseIngredientKeys(base) {
  return base.parts.map((p) => p.key);
}
