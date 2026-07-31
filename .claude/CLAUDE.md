# The Sauce Project

## Architecture
- Static site, no backend, no build-time framework — `src/app.js` wires the DOM directly
- `src/calculator.js` and `src/hourly.js` are pure functions (no DOM) — keep them that way so they stay unit-testable
- `dist/` is built by CI (`npm run build`), not committed — run `npm run build` locally if you need `index.html` to reflect `src/*.js`/`shared.css` changes, but don't commit the result

## Flavoring is generic, not strawberry-specific
- The recipe's flavoring slot takes a name, a ratio (g per 1g maltodextrin), a carb fraction, and a sugar fraction — see `data/flavorings.js`
- Only the strawberry preset is `confidence: 'tested'` (measured in a real batch); everything else is `'estimated'` — don't upgrade a preset's confidence without an actual measured batch behind it
- When adding a flavoring preset, add it to `data/flavorings.js` and the existing `tests/flavorings.test.js` loop picks it up automatically — no new test needed unless the preset needs special-case behavior

## Grams are the unit, scoops are a conversion
- There is no standard scoop, so anything a user acts on is expressed in grams first. Scoop counts appear only as a labelled convenience ("of your 46 g scoops")
- Per-hour fueling math must be built on `recipe.perGram`, never `recipe.perScoop` — how much mix an hour takes is a property of the formulation and must not change because someone owns a bigger scoop. There are regression tests for this in `tests/hourly.test.js`
- Recipe presets deliberately don't set scoop size or pantry amounts

## Share links come in three forms
- `?p=<slug>` a preset (preferred, readable), `?c=<token>` a packed custom formulation, and the original `?r=&s=&f=&t=` long form which is still parsed so links already shared keep working
- The packed token's field order and slot sizes in `src/share.js` are FROZEN. Changing them silently changes what existing tokens mean — bump `TOKEN_VERSION` instead. `tests/share.test.js` pins a known token/value pair to catch this
- Flavorings carry an explicit append-only `shareId`; never derive the packing from array position

## Nutrition math
- Sodium is always sodium citrate dihydrate at 235 mg Na/g — never table salt's ~393 mg Na/g. An earlier version of the source spreadsheet used the NaCl figure and overstated sodium by ~40%; don't reintroduce that
- See `docs/recipe-source.md` for the full ratio derivation and the source spreadsheet link

## Share links are untrusted input
- `src/share.js` decodes recipe formulations from the query string. Anyone can hand-edit a link, so every value is validated against a known set (`hasOwnProperty`, not `in` — otherwise `constructor`/`__proto__` pass) or clamped to a range, with per-field fallback
- Decoded values are assigned to form inputs only, never interpolated into `innerHTML`
- Note `Number(null)` is `0`, not `NaN` — a missing param must be rejected before conversion or it silently clamps to the minimum instead of falling back. There's a regression test for this

## Label artwork stays client-side
- Artwork is read with `FileReader` into a data URL and never uploaded — there is no server to upload to. Keep it that way
- The `accept` attribute is a hint, not a control: MIME type and size are re-checked in `loadArtwork()`. Don't add SVG to the allowlist (it can carry script)

## Amazon Associate links
- `ASSOCIATES_TAG` in `data/products.js` is `sauce-calc-20`, a site-specific tracking ID under store `mikeylikesit-20`. Don't reuse it on other sites — the point is per-site attribution
- Product `url`s still point at Amazon search results, not guessed ASINs. Replace with the exact product page once picked, keep the `tag` param, and drop that entry's `placeholder: true`
- The Operating Agreement disclosure ("As an Amazon Associate I earn from qualifying purchases") must stay on any page with affiliate links

## GitHub Issues
- When creating an issue, add a size label (`size:small` < 1hr, `size:medium` 1-4hr, `size:large` 4+hr) and a priority label (`priority:low/medium/high/critical`)
- Add a category label when applicable: `ui`, `content`, `feature`, `infrastructure`, `refactor`, `bug`
- Prefer consolidating related work into one issue with a task checklist over many small sub-issues
