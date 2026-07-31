# Recipe source & derivation

The calculator's ratios and nutrition math are ported from a tested batch,
originally worked out in a
[Google Sheet](https://docs.google.com/spreadsheets/d/1ynXY85EZxoiSmAzm9cJSymFrC8IUvmYh5mTmx6V6oKU/edit).

## Fixed ratios (grams per 1g maltodextrin)

| Ingredient | Ratio | Notes |
|---|---|---|
| Maltodextrin | 1.000 | Primary carb (complex), the reference unit |
| Fructose | 0.650 | Second carb transporter (glucose/fructose co-transport) |
| Flavoring | varies | Free slot — see `data/flavorings.js`. Strawberry freeze-dried powder (ratio 0.2) is the only ratio that's been tested in a real batch |
| Salt (sodium citrate dihydrate) | 0.046 / 0.065 / 0.085 | moderate / endurance / hot profile |

`src/calculator.js` finds whichever ingredient runs out first (scaled by
these ratios), and builds the largest batch possible from what's on hand —
optionally capped by a max batch size.

## Nutrition math

- **Carbs (g)** = maltodextrin + fructose + (flavoring × flavor carb fraction)
- **Sugars (g)** = fructose + (flavoring × flavor sugar fraction)
- **Sodium (mg)** = salt (g) × 235 mg Na/g — the sodium content of *sodium
  citrate dihydrate*, not table salt (NaCl, ~393 mg Na/g). An earlier version
  of the source spreadsheet used the NaCl figure and overstated sodium by
  ~40%.
- **Calories** = carbs (g) × 4

Flavor carb/sugar fractions default to the tested strawberry powder (100%
carbohydrate by mass, ~60% of that as sugar, the rest fiber/acid) but are
inputs, not constants — see `data/flavorings.js` for other flavoring options
and how to add more.

## Hourly targets

- Carbs: 60–90 g/hr, the range where the maltodextrin:fructose dual-transporter
  ratio pays off over glucose-only fueling (~60 g/hr ceiling).
- Sodium: 500–1000 mg/hr for an average sweater (sweat rate 0.75–1.5 L/hr ×
  sweat sodium 500–1300 mg/L), up to ~1500 mg/hr hot/heavy-sweat.

Full citations in `data/research.js` / the References section of the site.
