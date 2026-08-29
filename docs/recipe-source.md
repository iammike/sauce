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
delivering many. A DE 10 maltodextrin averages ~10 glucose units (~1639
g/mol), so 9% contributes about **55 mOsm/L**; the same carbohydrate as
glucose (180 g/mol) contributes about **500**. Plasma is ~290.

That is what makes a carb-dense drink possible at all. A sugar-based sports
drink can't simply be concentrated into a fuel: raising its carb content
raises osmolality proportionally, which slows gastric emptying and provokes GI
distress. It's the mechanism behind the whole product category, and the reason
maltodextrin is ~48% of this mix rather than more fructose.

> Both figures above were wrong until 2026-08-29, and both errors flattered
> this recipe: glucose was given as "nearer 1000" (it is ~500, and
> [D10W's documented 505 mOsm/L](https://www.dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=7790c2ce-2f46-7c4d-e053-2991aa0a7eda&type=display)
> agrees — that is 10% dextrose *monohydrate*, so 9.1% anhydrous glucose at
> 100 g/L over 198.17 g/mol, not 100/180),
> and maltodextrin as "roughly isotonic at ~290" when it is strongly
> hypotonic. Corrected under #27.

### Where the maltodextrin advantage actually goes

The headroom is real but the fructose slot spends most of it, because free
fructose is a single molecule and counts once per 180 g/mol just as glucose
does. At 75 g of carbohydrate in 750 ml, with the strawberry slot and
endurance salt:

Two columns, because the salt matters and only one of these formulations
comes with any. "Carbohydrate only" is what each contributes on its own;
"with endurance salt" adds 2.44 g of sodium citrate dihydrate — what the 0.8
batch carries, and what you would have to add to the sugar to make it a fuel
rather than a syrup. Compare down a column, never across.

| formulation | carbohydrate only | with endurance salt |
|---|---|---|
| house mix, 0.5 (classic 2:1) | 238 | 290 |
| house mix, 0.65 | 264 | 312 |
| **house mix, 0.8 (default)** | **286** | **330** |
| house mix, 1.0 | 310 | 350 |
| **table sugar (1:1)** | **292** | **336** |

Either column gives the same answer: at the shipped ratio the mix and plain
sucrose are within 2% of each other, with sucrose fractionally the higher.
The maltodextrin advantage is decisive only at low fructose ratios, where the
mix drops to 238 and sucrose cannot follow.

At 0.8 the osmoles break down as maltodextrin 9%, fructose 67%, flavouring
10%, salt 13% — the whole point being that the polymer contributes almost
nothing to the count while carrying nearly half the carbohydrate.

Assumptions: DE 10, ideal solutions, sodium citrate dihydrate fully
dissociating to four particles, strawberry powder ~60% mono/disaccharide by
mass. DE 10 is the maltodextrin-favouring end of the ordinary 10–20 range: at
DE 20 the same 9% maltodextrin contributes ~109 mOsm/L rather than ~55, and
its share of the mix's osmoles roughly doubles. Nutricost doesn't publish a DE
for the linked product.

These are mOsm/**L** of solution. Plasma's ~290 is mOsm/**kg of water**, and
at this solute load the mix works out near 355 mOsm/kg — so the drink is more
hypertonic than the litre figures suggest. The comparison between formulations
is unaffected, since sucrose lands at ~359 the same way.

### Any reason not to use table sugar? (#27)

Sucrose is glucose and fructose bonded 1:1, so it lands at a fructose:glucose
ratio of 1.0 — inside Morton's 0.6–1.0 band, though above the 0.8 that won
O'Brien's head-to-head. It is the cheapest carbohydrate available, needs no
weighing of two powders, and travelling as a disaccharide it is osmotically
better than the loose glucose in a regular sports drink.

The real objections are narrower than "wrong ratio":

1. **No sodium at all.** A salt source alongside it is mandatory, not optional.
2. **The ratio is fixed at 1.0**, which fixes the sweetness with it. You cannot
   move either; with separate powders you can put the ratio at 0.8 or drop it
   for a cool day.
3. **Concentration is the ceiling.** Sucrose can't go below ~292 mOsm/L from
   the carbohydrate alone at 100 g/L, so a low-osmolality, high-carb drink
   isn't reachable with it — that is the one thing maltodextrin buys, and it
   only pays off at low fructose ratios (see the table above).

### Sweetness

Maltodextrin is close to flavourless (relative sweetness ~0.15 against sucrose
= 1.0) and fructose is the sweetest common sugar, so the fructose ratio is the
sweetness dial as much as the absorption one. Per gram of carbohydrate the mix
at 0.8 lands near 0.74 against sucrose's 1.0 — table sugar is roughly a third
sweeter.

Treat that as a range, not a figure. Fructose's own relative sweetness is
quoted between 1.2 and 1.8 depending on temperature and concentration, and
because this mix is fructose-heavy the assumption swings the answer a long
way: at 1.2 sugar is 63% sweeter, at 1.5 it is 36%, at 1.8 only 17%. A sixth
to two thirds is the honest claim. The direction is counterintuitive — the sweeter
you believe fructose is, the *smaller* the gap, because the mix is carrying so
much of it.

For the same reason 0.65 → 0.8 was itself about 10% sweeter at constant
carbohydrate. Sweetness and osmolality move together here: both track the
fraction of the carbohydrate that is loose monosaccharide.

At moderate intakes, table sugar plus salt is a defensible fuel and the page
should not pretend otherwise.

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
