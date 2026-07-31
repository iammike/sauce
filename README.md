# The Sauce

Homemade endurance hydration mix calculator, hourly fueling guide, and
printable nutrition label.

**Live:** [sauce.iammike.org](https://sauce.iammike.org/) (once DNS/Pages are cut over — see #issues)

A static site, no backend. Enter what you have on hand (any flavoring, not
just strawberry — see `data/flavorings.js`), and the calculator finds the
limiting ingredient, scales the rest of the batch, and fills out a live
Supplement Facts panel. From there:

- **Per hour** — pick a carb target and get the scoops/hr it takes, checked
  against research sodium/carb targets.
- **Label** — print the live Supplement Facts panel as a batch label.
- **Where to buy** — Amazon Associate links for the ingredients (placeholder
  tag/products until real ones are picked — see open issues).
- **References** — the research behind the ratios and hourly targets.

## How it works

- `src/calculator.js` — batch/recipe math, ported from the source spreadsheet
  (see `docs/recipe-source.md` for the full derivation)
- `src/hourly.js` — per-hour fueling recommendation
- `data/flavorings.js` — flavoring presets (ratio, carb/sugar fraction); the
  recipe isn't tied to strawberry, any flavoring type plugs in here
- `data/products.js` / `data/research.js` — Where to Buy / References content
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
