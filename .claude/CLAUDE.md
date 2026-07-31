# The Sauce Project

## Architecture
- Static site, no backend, no build-time framework — `src/app.js` wires the DOM directly
- `src/calculator.js` and `src/hourly.js` are pure functions (no DOM) — keep them that way so they stay unit-testable
- `dist/` is built by CI (`npm run build`), not committed — run `npm run build` locally if you need `index.html` to reflect `src/*.js`/`shared.css` changes, but don't commit the result

## Flavoring is generic, not strawberry-specific
- The recipe's flavoring slot takes a name, a ratio (g per 1g maltodextrin), a carb fraction, and a sugar fraction — see `data/flavorings.js`
- Only the strawberry preset is `confidence: 'tested'` (measured in a real batch); everything else is `'estimated'` — don't upgrade a preset's confidence without an actual measured batch behind it
- When adding a flavoring preset, add it to `data/flavorings.js` and the existing `tests/flavorings.test.js` loop picks it up automatically — no new test needed unless the preset needs special-case behavior

## Nutrition math
- Sodium is always sodium citrate dihydrate at 235 mg Na/g — never table salt's ~393 mg Na/g. An earlier version of the source spreadsheet used the NaCl figure and overstated sodium by ~40%; don't reintroduce that
- See `docs/recipe-source.md` for the full ratio derivation and the source spreadsheet link

## Amazon Associate links
- `data/products.js` — `TODO_TAG` is a placeholder; links point at Amazon search results, not guessed ASINs, until real products are picked. Replace `url` with the exact product page once decided, keeping the same `tag` param

## GitHub Issues
- When creating an issue, add a size label (`size:small` < 1hr, `size:medium` 1-4hr, `size:large` 4+hr) and a priority label (`priority:low/medium/high/critical`)
- Add a category label when applicable: `ui`, `content`, `feature`, `infrastructure`, `refactor`, `bug`
- Prefer consolidating related work into one issue with a task checklist over many small sub-issues
