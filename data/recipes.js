// Recommended recipe presets.
//
// Each preset sets the *formulation* (glucose:fructose ratio, salt profile,
// flavoring, intended intake rate). It deliberately does NOT touch the "on
// hand" pantry inputs or the scoop size — those describe the user's kitchen,
// not the recipe. Scoop size in particular varies wildly between scoops;
// there is no standard, so it must be measured rather than assumed.
//
// `carbRatio` is grams of fructose per 1g of maltodextrin. Since maltodextrin
// digests to glucose, carbRatio is effectively the glucose:fructose ratio:
//   0.50 -> 2:1     0.65 -> ~1.5:1     0.80 -> 1.25:1
//
// confidence: 'tested' means made and ridden on. 'variant' means it's the
// tested recipe with one lever moved for a documented reason — the ratio is
// research-backed, but this exact formulation hasn't been batch-tested.

export const RECIPES = [
  {
    id: 'classic',
    name: 'The Classic',
    tagline: 'The tested house recipe',
    carbRatio: 0.65,
    saltProfile: 'endurance',
    flavoringId: 'strawberry',
    targetCarbsPerHour: 75,
    confidence: 'tested',
    bestFor: 'Most rides. 2–4 hours, moderate conditions.',
    why: 'The original formulation — roughly 1.5:1 glucose:fructose, which sits comfortably inside the dual-transporter window without pushing fructose high enough to upset most stomachs.',
  },
  {
    id: 'hot-day',
    name: 'Hot Day',
    tagline: 'Same fuel, more salt',
    carbRatio: 0.65,
    saltProfile: 'hot',
    flavoringId: 'strawberry',
    targetCarbsPerHour: 75,
    confidence: 'variant',
    bestFor: 'Heat, humidity, or if you finish rides with salt crust on your face.',
    why: 'Identical carbs to the Classic, salt bumped from 6.5% to 8.5% of the maltodextrin weight. Heavy sweaters can lose 1000+ mg sodium/hr; the standard profile undershoots that.',
  },
  {
    id: 'big-day',
    name: 'Big Day',
    tagline: 'For 90g+ carbs an hour',
    carbRatio: 0.8,
    saltProfile: 'endurance',
    flavoringId: 'strawberry',
    targetCarbsPerHour: 100,
    confidence: 'variant',
    bestFor: 'Racing, or any effort where you are deliberately fueling above 90 g/hr.',
    why: 'Shifts to 1.25:1 glucose:fructose. Above ~90 g/hr the glucose transporter is the bottleneck, so leaning harder on fructose raises the ceiling — this is the ratio most modern high-carb products use. Needs a trained gut; do not debut it on race day.',
  },
  {
    id: 'steady',
    name: 'Steady',
    tagline: 'Classic 2:1, easier on the gut',
    carbRatio: 0.5,
    saltProfile: 'moderate',
    flavoringId: 'strawberry',
    targetCarbsPerHour: 60,
    confidence: 'variant',
    bestFor: 'Long slow distance, or if fructose gives you GI trouble.',
    why: 'The textbook 2:1 ratio. Less fructose per hour, which is gentler on the gut, at the cost of a lower absorption ceiling. Fine when you are fueling at 60 g/hr and do not need the headroom.',
  },
  {
    id: 'bare-bones',
    name: 'Bare Bones',
    tagline: 'No flavoring, lowest cost',
    carbRatio: 0.65,
    saltProfile: 'endurance',
    flavoringId: 'unflavored',
    targetCarbsPerHour: 75,
    confidence: 'tested',
    bestFor: 'Mixing into something that is already flavored, or cutting cost.',
    why: 'The Classic minus the flavoring. Freeze-dried fruit powder is ~11% of the mix by weight but roughly a third of the cost, so dropping it is the single biggest lever on price per hour.',
  },
];

export function findRecipe(id) {
  return RECIPES.find((r) => r.id === id);
}
