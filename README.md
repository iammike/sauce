# The Sauce

Homemade endurance hydration mix calculator, hourly fueling guide, and
printable nutrition label.

**Live:** [sauce.iammike.org](https://sauce.iammike.org/)

A static site, no backend. Enter what you have on hand (any flavoring, not
just strawberry — see `data/flavorings.js`), and the calculator finds the
limiting ingredient, scales the rest of the batch, and fills out a live
Supplement Facts panel. From there:

- **Per hour** — the established duration-based carb tiers (30/60/90/120 g/hr),
  showing how much mix each takes. Tiers your formulation can't actually
  absorb are greyed out, since glucose alone saturates near 60 g/hr.
- **Dial it in** — symptom-driven tuning guidance (`data/tuning.js`): what to
  change when it's too sweet, too salty, or sitting in your stomach.
- **Label** — a real 3x4in label with a derived ingredients list (ordered by
  descending weight, as food labels require), optional artwork, and print
  rules that isolate it at true size. Artwork never leaves the browser.
- **Where to buy** — Amazon Associate links for the ingredients. The tracking
  tag is live; specific products are still to be picked (see open issues).
- **References** — the research behind the ratios and hourly targets.

## How it works

- `src/calculator.js` — batch/recipe math, ported from the source spreadsheet
  (see `docs/recipe-source.md` for the full derivation)
- `src/hourly.js` — per-hour fueling recommendation
- `data/flavorings.js` — flavoring presets (ratio, carb/sugar fraction); the
  recipe isn't tied to strawberry, any flavoring type plugs in here
- `data/products.js` / `data/research.js` — Where to Buy / References content
- `data/tuning.js` — symptom-driven tuning guidance
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
