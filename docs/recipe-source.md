# Recipe source & derivation

The calculator's nutrition math is ported from a tested batch, originally
worked out in a
[Google Sheet](https://docs.google.com/spreadsheets/d/1ynXY85EZxoiSmAzm9cJSymFrC8IUvmYh5mTmx6V6oKU/edit).
The fructose ratio has since moved off that batch to 0.800 on the evidence
below; everything else still comes from it.

## Fixed ratios (grams per 1g maltodextrin)

| Ingredient | Ratio | Notes |
|---|---|---|
| Maltodextrin | 1.000 | Primary carb (complex), the reference unit |
| Fructose | 0.800 | Second carb transporter (glucose/fructose co-transport). Was 0.650 in the batch originally mixed |
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

## Why maltodextrin, not just sugar

Osmolality depends on the *number* of dissolved particles, not their mass.
Maltodextrin is a chain of glucose units, so it counts once osmotically while
delivering many glucose units — a 9% maltodextrin solution is roughly isotonic
(~290 mOsm/kg), where the same carbohydrate as glucose would run nearer 1000.

That is what makes a carb-dense drink possible at all. A sugar-based sports
drink can't simply be concentrated into a fuel: raising its carb content
raises osmolality proportionally, which slows gastric emptying and provokes GI
distress. It's the mechanism behind the whole product category, and the reason
maltodextrin is ~48% of this mix rather than more fructose.

## Hourly targets

Carbohydrate intake is tiered by effort duration, per Morton et al. 2026
(*J Nutr*), which revisits the 2016 ACSM/AND/DC position statement:

| Duration | Carbs |
|---|---|
| Under 1 hour | 0–30 g/hr (often unnecessary) |
| 1–2.5 hours | 30–60 g/hr |
| 2.5–4 hours | 60–90 g/hr |
| 4+ hours, trained | 90–120 g/hr |

The headline change from the older guidance: 90 g/hr is no longer the ceiling.
90–120 g/hr is the contemporary upper range for trained athletes on a
glucose/fructose blend. Above 120 g/hr is experimental — field intakes go
higher, but the efficacy evidence doesn't support it yet.

Anything past ~60 g/hr requires both glucose and fructose; glucose alone
saturates SGLT1 there regardless of how much you drink.

The same review puts the optimal fructose-to-glucose ratio at **0.6–1.0**,
which maps directly onto this calculator's `carbRatio`. The classic 2:1 (0.5)
sits just below it.

Within that band, 0.8 is the only point tried against its neighbours directly.
O'Brien, Stannard, Clarke & Rowlands
([*Med Sci Sports Exerc* 2013;45(9):1814–24](https://pubmed.ncbi.nlm.nih.gov/23949097/))
rode 12 cyclists on equiosmotic drinks at fructose:maltodextrin ratios of 0.5,
0.8 and 1.25, all delivering 90 g/hr. The 0.8 drink oxidised 18% more exogenous
carbohydrate than 0.5 and 5.2% more than 1.25, with sprint power about 3%
higher than either. 1.25 placing between the other two is the other half of the
result: 0.8 is a peak, not a floor.

0.65 → 0.800 moves about five percentage points of the carb load from polymer
to monomer, so the finished drink goes from roughly 310 to roughly 330 mOsm/L
at 75 g carbs in 750 ml — near-isotonic to mildly hypertonic. Small, but it is
the same axis the bottle planner warns about, so dilute rather than concentrate
if it stops going down.

### Why the targets aren't per-kilogram

Unlike daily carbohydrate intake, intake *during* exercise is prescribed in
absolute g/hr rather than g/kg. The limiting step is absorption across the
intestinal wall, not delivery to muscle, and transporter capacity doesn't
scale meaningfully with body size — so a 60 kg and a 90 kg athlete reach a
similar ceiling. Jeukendrup states there is no rationale for expressing
during-exercise carbohydrate recommendations per kilogram of body weight.

Exercise intensity does modulate the target somewhat: easier efforts shift
fuel use toward fat, so a long easy ride sits at the low end of its duration
band and race pace at the high end. The effect is real but secondary to
duration, which is why the guidance is organised by time.

Sodium: 500–1000 mg/hr for an average sweater (sweat rate 0.75–1.5 L/hr ×
sweat sodium 500–1300 mg/L), up to ~1500 mg/hr hot/heavy-sweat.

Full citations in `data/research.js` / the References section of the site.
