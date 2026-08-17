# The Sauce

Homemade endurance hydration mix calculator, hourly fueling guide, and
printable/downloadable nutrition label.

**Live:** [sauce.iammike.org](https://sauce.iammike.org/)

One page. The batch calculator is the tool, open at the top; everything else
is a collapsed panel below it, split into what you *do* — **label** the jar
you just made, then the **bottle planner** for a given ride — and what you
*look up*: **what to buy**, **cost**, **troubleshooting**, **the science**.

`ride.html` is a redirect to `#planner`, kept so the old URL still works.

A static site, no backend. Enter what you have on hand (any flavoring, not
just strawberry — see `data/flavorings.js`), and the calculator finds the
limiting ingredient, scales the rest of the batch, and fills out a live
Supplement Facts panel. From there:

- **Troubleshooting** — symptom-driven guidance (`data/tuning.js`), ordered by
  when you'd hit each problem: making the batch, mixing a bottle, taste, then
  how it feels on the bike.
- **Label** — a printable *or downloadable-PNG* label, sized for a jar or to
  wrap the tub, whose serving is *one hour of fueling* at your carb target,
  so "servings per container" tells you how many hours the jar holds.
  Ingredients are derived from the batch and ordered by descending weight, as
  food labels require. Optional artwork never leaves the browser, print rules
  isolate the label at true size, and the PNG export (rendered client-side to
  a `<canvas>`, no server involved) matches that same true size at 300 DPI —
  good for a phone, a text message, or a sticker printer. A label packed with
  a note, a maker name, and artwork all at once can outgrow its own declared
  size; print and the on-screen preview both let that spill past the border,
  but the PNG has no "outside" to spill into and clips it at the edge.
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
- `src/hourly.js` — intake tiers and the per-hour fueling maths
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

Needs **Node 22.12–22.x, or 24+** — 23 is rejected, not just old. `.npmrc` sets
`engine-strict`, so an unsupported Node stops at `npm install` naming the
version required, rather than failing later inside the test run. The floor is
jsdom's: it needs `require(esm)`.

```bash
npm install
npm run build     # bundle src/app.js + shared.css into dist/
npm run serve     # http://localhost:8000
npm test          # vitest
npx playwright install chromium   # one-time, for the next line
npm run test:e2e  # real-browser checks (e2e/) — builds dist/ first, then Playwright
```

## Deploy

GitHub Pages serves `index.html` + `dist/` from `main`. `.github/workflows/deploy.yml`
runs tests, builds, and publishes on every push. `CNAME` points at
`sauce.iammike.org`.
