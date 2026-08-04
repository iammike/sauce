# The Sauce

Homemade endurance hydration mix calculator, hourly fueling guide, and
printable nutrition label.

**Live:** [sauce.iammike.org](https://sauce.iammike.org/)

Two pages, each doing one job:

- **[Bottle planner](ride.html)** — day-of. How long, how hard, how hot; get
  grams of mix to pack and rough salt advice. Assumes the base recipe and
  average sweat, on purpose.
- **Batch calculator** (`index.html`) — everything below. Occasional, precise,
  and aware of what you actually mixed.

A static site, no backend. Enter what you have on hand (any flavoring, not
just strawberry — see `data/flavorings.js`), and the calculator finds the
limiting ingredient, scales the rest of the batch, and fills out a live
Supplement Facts panel. From there:

- **Troubleshooting** — symptom-driven guidance (`data/tuning.js`), ordered by
  when you'd hit each problem: making the batch, mixing a bottle, taste, then
  how it feels on the bike.
- **Label** — a real 3x4in label whose serving size is *one hour of fueling*
  at your carb target, so "servings per container" tells you how many hours
  the jar holds. Ingredients are derived from the batch and ordered by
  descending weight, as food labels require. Optional artwork never leaves the
  browser, and print rules isolate the label at true size.
- **Cost** — what an hour of fueling costs to make, against Gatorade
  Endurance, Maurten 320, and regular Gatorade, normalised per gram of
  carbohydrate. Plus where the money actually goes: flavoring is ~10% of the
  weight but ~32% of the spend.
- **Where to buy** — Amazon Associate links for the exact products the costs
  are based on.
- **References** — the research behind the ratios and hourly targets.

## How it works

- `src/calculator.js` — batch/recipe math, ported from the source spreadsheet
  (see `docs/recipe-source.md` for the full derivation)
- `src/hourly.js` — per-hour fueling recommendation
- `data/flavorings.js` — flavoring presets (ratio, carb/sugar fraction); the
  recipe isn't tied to strawberry, any flavoring type plugs in here
- `data/products.js` / `data/research.js` — Where to Buy / References content
- `data/tuning.js` — symptom-driven tuning guidance
- `src/cost.js` / `data/costs.js` — batch cost and commercial comparison
- `src/share.js` / `data/recipes.js` — **not wired into the UI.** Recipe
  presets and shareable formulation links, built then parked: only one recipe
  has genuinely been made and tested, so a curated collection and a way to
  trade variants both get ahead of the evidence. Kept with their tests so
  re-enabling is a matter of calling them again
- `src/app.js` — DOM wiring, no framework

## Develop

```bash
npm install
npm run build   # bundle src/app.js + shared.css into dist/
npm run serve   # http://localhost:8000
npm test        # vitest
```

## Deploy

GitHub Pages serves `index.html` + `dist/` from `main`. `.github/workflows/deploy.yml`
runs tests, builds, and publishes on every push. `CNAME` points at
`sauce.iammike.org`.
