import { describe, it, expect } from 'vitest';
import { computeRecipe, DEFAULT_SALT_PROFILE, DEFAULT_CARB_BASE } from '../src/calculator.js';
import { batchCost, costPerGramCarb, mixCostPerGramCarb, compareAtCarbTarget } from '../src/cost.js';
import { COMMERCIAL_PRODUCTS, commercialCostPerGramCarb, litresPerHour, HOMEMADE_LIMITATION } from '../data/costs.js';
import { sodiumStatus, SODIUM_TARGET_RANGE, DEFAULT_TARGET_CARBS } from '../src/hourly.js';
import { FLAVORINGS, findFlavoring, DEFAULT_FLAVORING_ID } from '../data/flavorings.js';
import { CARB_BASES } from '../data/carb-bases.js';
import { TUNING } from '../data/tuning.js';

const PANTRY = { maltodextrin: 2300, fructose: 2000, flavoring: 500, salt: 400 };
const strawberry = findFlavoring('strawberry');

const recipe = computeRecipe({
  onHand: PANTRY,
  saltProfile: 'endurance',
  maxBatchGrams: 1800,
  scoopGrams: 46,
  flavorRatio: strawberry.ratio,
  flavorCarbFraction: strawberry.carbFraction,
  flavorSugarFraction: strawberry.sugarFraction,
});

describe('batchCost', () => {
  it('costs an 1800 g batch in the right ballpark', () => {
    // The source cost doc puts a full 1800 g batch around $31.
    const { total } = batchCost(recipe.recipeGrams, strawberry.pricePerGram);
    expect(total).toBeGreaterThan(20);
    expect(total).toBeLessThan(45);
  });

  it('shares sum to 1', () => {
    const { share } = batchCost(recipe.recipeGrams, strawberry.pricePerGram);
    expect(Object.values(share).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });

  it('shows flavoring taking a far bigger share of cost than of weight', () => {
    // The headline cost insight: ~10% of the weight, roughly a third of the
    // spend. If this stops being true the "drop the flavoring to save money"
    // advice elsewhere on the site is wrong.
    const { share } = batchCost(recipe.recipeGrams, strawberry.pricePerGram);
    const weightShare = recipe.recipeGrams.flavoring / recipe.actualBatch;
    expect(share.flavoring).toBeGreaterThan(weightShare * 2);
  });

  it('drops to near zero flavoring cost when unflavored', () => {
    const unflavored = findFlavoring('unflavored');
    const plain = computeRecipe({
      onHand: PANTRY, saltProfile: 'endurance', maxBatchGrams: 1800, scoopGrams: 46,
      flavorRatio: unflavored.ratio,
    });
    const { perIngredient, total } = batchCost(plain.recipeGrams, unflavored.pricePerGram);
    expect(perIngredient.flavoring).toBe(0);
    expect(total).toBeLessThan(batchCost(recipe.recipeGrams, strawberry.pricePerGram).total);
  });

  it('handles a zero batch without dividing by zero', () => {
    const empty = { maltodextrin: 0, fructose: 0, flavoring: 0, salt: 0 };
    const { total, share } = batchCost(empty, strawberry.pricePerGram);
    expect(total).toBe(0);
    expect(Object.values(share).every((v) => v === 0)).toBe(true);
  });
});

describe('costPerGramCarb', () => {
  it('divides cost by carbohydrate delivered', () => {
    const { total } = batchCost(recipe.recipeGrams, strawberry.pricePerGram);
    expect(costPerGramCarb(total, recipe.totals.carbsG))
      .toBeCloseTo(total / recipe.totals.carbsG, 9);
  });

  it('returns zero rather than Infinity for a carb-free batch', () => {
    expect(costPerGramCarb(5, 0)).toBe(0);
  });
});

describe('compareAtCarbTarget', () => {
  const { total } = batchCost(recipe.recipeGrams, strawberry.pricePerGram);
  const perGramCarb = costPerGramCarb(total, recipe.totals.carbsG);

  it('puts an hour of homemade fuel near a dollar or two', () => {
    const { mine } = compareAtCarbTarget(perGramCarb, 75);
    expect(mine).toBeGreaterThan(0.5);
    expect(mine).toBeLessThan(3);
  });

  it('finds Gatorade Endurance several times more expensive', () => {
    const { commercial } = compareAtCarbTarget(perGramCarb, 75);
    const endurance = commercial.find((c) => c.id === 'gatorade-endurance');
    expect(endurance.multiple).toBeGreaterThan(2);
  });

  it('does not hide that regular Gatorade is cheaper per carb', () => {
    // Honesty check: the comparison must not be rigged to always win.
    const { commercial } = compareAtCarbTarget(perGramCarb, 75);
    const regular = commercial.find((c) => c.id === 'gatorade-regular');
    expect(regular.multiple).toBeLessThan(1);
  });

  it('sorts cheapest first', () => {
    const { commercial } = compareAtCarbTarget(perGramCarb, 75);
    const costs = commercial.map((c) => c.perHour);
    expect([...costs].sort((a, b) => a - b)).toEqual(costs);
  });

  it('scales linearly with the carb target', () => {
    const a = compareAtCarbTarget(perGramCarb, 60);
    const b = compareAtCarbTarget(perGramCarb, 120);
    expect(b.mine).toBeCloseTo(a.mine * 2, 9);
  });
});

describe('commercial product data', () => {
  it('can price every product per gram of carb', () => {
    for (const p of COMMERCIAL_PRODUCTS) {
      const v = commercialCostPerGramCarb(p);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  it('labels each price as actual or estimated', () => {
    for (const p of COMMERCIAL_PRODUCTS) {
      expect(['actual', 'estimated']).toContain(p.confidence);
    }
  });
});

describe('flavoring price data', () => {
  it('prices every flavoring', () => {
    for (const f of FLAVORINGS) {
      expect(typeof f.pricePerGram).toBe('number');
      expect(f.pricePerGram).toBeGreaterThanOrEqual(0);
      expect(['actual', 'estimated']).toContain(f.priceConfidence);
    }
  });
});

describe('honest comparison', () => {
  it('states a limitation for every commercial product', () => {
    for (const p of COMMERCIAL_PRODUCTS) {
      expect(typeof p.limitation).toBe('string');
      expect(p.limitation.length).toBeGreaterThan(20);
    }
  });

  it('states a limitation for the homemade mix too', () => {
    // The comparison must cut both ways, or it's advertising.
    expect(typeof HOMEMADE_LIMITATION).toBe('string');
    expect(HOMEMADE_LIMITATION.length).toBeGreaterThan(20);
  });

  it('shows regular Gatorade needs impractical fluid volume', () => {
    // This is the whole point: cheapest per carb is a hydration drink you'd
    // have to drink ~2 L/hr of. If this stops being surfaced, the cost panel
    // becomes misleading.
    const gatorade = COMMERCIAL_PRODUCTS.find((p) => p.id === 'gatorade-regular');
    expect(litresPerHour(gatorade, 75)).toBeGreaterThan(1.5);
  });

  it('shows a real fuel needs far less fluid for the same carbs', () => {
    const maurten = COMMERCIAL_PRODUCTS.find((p) => p.id === 'maurten-320');
    expect(litresPerHour(maurten, 75)).toBeLessThan(0.6);
  });

  it('returns null rather than guessing an unpublished dilution', () => {
    const endurance = COMMERCIAL_PRODUCTS.find((p) => p.id === 'gatorade-endurance');
    expect(litresPerHour(endurance, 75)).toBeNull();
  });

  // Table sugar carries no sodium, which is a fact about it rather than
  // missing data — so the blanket `> 0` this used to assert had to go. But
  // relaxing it to `>= 0` for everything made it vacuous: hard-wiring
  // sodiumMgPerHour to 0 in src/cost.js left the whole suite green. Exempt
  // the known-zero product instead of weakening the predicate.
  it('reports sodium per hour alongside cost', () => {
    const { commercial } = compareAtCarbTarget(0.017, 75);
    expect(commercial.length).toBeGreaterThan(1);
    for (const c of commercial) {
      const source = COMMERCIAL_PRODUCTS.find((p) => p.name === c.name);
      expect(Number.isFinite(c.sodiumMgPerHour)).toBe(true);
      if (source.sodiumMgPerGramCarb > 0) {
        expect(c.sodiumMgPerHour).toBeGreaterThan(0);
      } else {
        expect(c.sodiumMgPerHour).toBe(0);
      }
    }
  });

  // The figure has to actually track the target, not just be non-zero.
  it('scales sodium with the carb target', () => {
    const at60 = compareAtCarbTarget(0.017, 60).commercial
      .find((c) => c.name === 'Gatorade Endurance Formula');
    const at120 = compareAtCarbTarget(0.017, 120).commercial
      .find((c) => c.name === 'Gatorade Endurance Formula');
    expect(at120.sodiumMgPerHour).toBeCloseTo(at60.sodiumMgPerHour * 2, 6);
  });
});

// data/tuning.js's cheapest-mix entry quotes two dollar figures and two UI
// labels. Prices move — the whole cost panel is built around saying so — and
// a number sitting in prose has nothing to keep it honest. These derive the
// figures from the cost model by the same path the page uses, so a price
// refresh, a different default intake, or a renamed option that leaves the
// copy behind fails here rather than shipping a confident wrong number.
//
// Every input is a named default rather than a literal. A first version
// hardcoded `* 75`: moving DEFAULT_TARGET_CARBS to 90 made the page render
// $0.30 and $1.56 while the prose still said $0.25 and $1.30, with all of
// these green.
// A per-bottle flavouring (citrus juice) never enters the jar, so batchCost()
// alone reports it as free. It isn't — you buy it by the bottle — and
// renderCost() amortises it over an hour's carbohydrate. That term lived only
// inside renderCost() until it was extracted, where no unit test could reach
// it and a test that recomputed the same figure silently omitted it.
describe('mixCostPerGramCarb', () => {
  const batchFlavour = findFlavoring(DEFAULT_FLAVORING_ID);
  const bottleFlavour = FLAVORINGS.find((f) => f.perBottle);
  const args = { costTotal: 10, carbsG: 1000, targetCarbsPerHour: 75 };

  it('charges for a per-bottle flavouring the batch never contains', () => {
    const withBottle = mixCostPerGramCarb({ ...args, flavor: bottleFlavour });
    const plain = costPerGramCarb(args.costTotal, args.carbsG);
    expect(withBottle).toBeGreaterThan(plain);
    expect(withBottle - plain).toBeCloseTo(
      (bottleFlavour.perBottleMl * bottleFlavour.pricePerMl) / args.targetCarbsPerHour, 10,
    );
  });

  it('adds nothing for a flavouring that goes in the jar', () => {
    expect(mixCostPerGramCarb({ ...args, flavor: batchFlavour }))
      .toBeCloseTo(costPerGramCarb(args.costTotal, args.carbsG), 10);
  });

  // targetCarbsPerHour of 0 is reachable — the field can be emptied.
  it('does not divide by a zero carb target', () => {
    const r = mixCostPerGramCarb({ ...args, flavor: bottleFlavour, targetCarbsPerHour: 0 });
    expect(Number.isFinite(r)).toBe(true);
  });
});

describe('the cheapest-mix answer quotes figures that are still true', () => {
  const perHour = (carbBase, flavoringId) => {
    const flavor = findFlavoring(flavoringId);
    const recipe = computeRecipe({
      // Deliberately unconstrained: cost per gram of carbohydrate is
      // scale-invariant, so the batch size is not load-bearing here.
      onHand: { maltodextrin: 1e6, fructose: 1e6, sucrose: 1e6, flavoring: 1e6, salt: 1e6 },
      saltProfile: DEFAULT_SALT_PROFILE,
      carbBase,
      flavorRatio: flavor.ratio,
      flavorCarbFraction: flavor.carbFraction,
      flavorSugarFraction: flavor.sugarFraction,
    });
    const cost = batchCost(recipe.recipeGrams, flavor.pricePerGram ?? 0);
    // The page's own function, not a reimplementation of it. Recomputing this
    // inline dropped the per-bottle flavouring term — invisible while no
    // default is perBottle, and wrong the moment one is.
    return mixCostPerGramCarb({
      costTotal: cost.total,
      carbsG: recipe.totals.carbsG,
      flavor,
      targetCarbsPerHour: DEFAULT_TARGET_CARBS,
    }) * DEFAULT_TARGET_CARBS;
  };

  const cheapest = () => perHour('sucrose', 'unflavored');
  const full = () => perHour(DEFAULT_CARB_BASE, DEFAULT_FLAVORING_ID);

  const entry = TUNING.find((t) => t.id === 'cheapest-mix');
  const quoted = () => [...entry.fix.matchAll(/\$(\d+\.\d{2})/g)].map((m) => Number(m[1]));
  const cents = (n) => Number(n.toFixed(2));

  it('quotes exactly two prices, cheapest first', () => {
    expect(quoted()).toHaveLength(2);
    expect(quoted()[0]).toBeLessThan(quoted()[1]);
  });

  it('matches what sugar and salt actually costs', () => {
    expect(quoted()[0]).toBe(cents(cheapest()));
  });

  it('matches what the full mix actually costs', () => {
    expect(quoted()[1]).toBe(cents(full()));
  });

  // "cheaper than anything you can buy ready-made" — table sugar is excluded
  // on purpose and the wording is what makes that honest: a bag of sugar is
  // bought, and it IS cheaper ($0.19 against $0.25), but it isn't ready-made
  // and carries no sodium, which is its own entry's stated limitation. If the
  // copy ever drops "ready-made", this exclusion stops being defensible.
  it('is cheaper than every ready-made option', () => {
    expect(entry.fix).toMatch(/ready-made/);
    const readyMade = COMMERCIAL_PRODUCTS
      .filter((p) => p.id !== 'table-sugar')
      .map((p) => commercialCostPerGramCarb(p) * DEFAULT_TARGET_CARBS);
    expect(cheapest()).toBeLessThan(Math.min(...readyMade));
  });

  // The `why` claims the carb swap saves more than dropping the flavouring.
  // A first version said the opposite, which was wrong by a wide margin.
  it('attributes the bigger saving to the lever that actually carries it', () => {
    const dropFlavour = full() - perHour(DEFAULT_CARB_BASE, 'unflavored');
    const swapCarb = full() - perHour('sucrose', DEFAULT_FLAVORING_ID);
    expect(swapCarb).toBeGreaterThan(dropFlavour);
  });

  // The copy names two options by the label the select shows. Those are
  // shortNames, which CLAUDE.md says get shortened whenever they don't fit
  // the control — so they are actively expected to change.
  it('names the options by labels the page actually shows', () => {
    expect(entry.fix).toContain(CARB_BASES.sucrose.shortName);
    expect(entry.fix).toContain(findFlavoring('unflavored').shortName);
  });
});

describe('sodium is judged, not just reported', () => {
  // Sugar's zero is the whole reason it needs a salt source beside it, so it
  // has to read as a judged shortfall rather than a blank.
  it('flags table sugar as carrying no sodium at all', () => {
    const sugar = COMMERCIAL_PRODUCTS.find((p) => p.id === 'table-sugar');
    expect(sugar.sodiumMgPerGramCarb).toBe(0);
    expect(sodiumStatus(0)).toBe('low');
  });

  it('flags Maurten as under the replacement target', () => {
    // ~250 mg per 80 g carbs is well under half the 500-1000 mg/hr range,
    // which is the point the cost figure alone would hide.
    const maurten = COMMERCIAL_PRODUCTS.find((p) => p.id === 'maurten-320');
    const perHour = maurten.sodiumMgPerGramCarb * 75;
    expect(perHour).toBeLessThan(SODIUM_TARGET_RANGE.min / 2);
    expect(sodiumStatus(perHour)).toBe('low');
  });

  it('finds Gatorade Endurance the one that covers sodium unaided', () => {
    const endurance = COMMERCIAL_PRODUCTS.find((p) => p.id === 'gatorade-endurance');
    expect(sodiumStatus(endurance.sodiumMgPerGramCarb * 75)).not.toBe('low');
  });

  // The mechanism used to have a standalone note on the panel. It was more
  // than a cost comparison needs, so it went — but the reason regular
  // Gatorade can't be concentrated into a fuel still has to be a mechanism
  // rather than a symptom, and that lives in its own limitation now.
  it('explains the osmolality mechanism, not just the symptom', () => {
    const regular = COMMERCIAL_PRODUCTS.find((p) => p.id === 'gatorade-regular');
    expect(regular.limitation).toMatch(/osmotic|osmolality/i);
    expect(regular.limitation).toMatch(/mOsm/);
  });
});
