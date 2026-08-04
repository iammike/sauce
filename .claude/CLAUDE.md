# The Sauce Project

## Architecture
- Static site, no backend, no build-time framework — `src/app.js` wires the DOM directly
- `src/calculator.js` and `src/hourly.js` are pure functions (no DOM) — keep them that way so they stay unit-testable
- `dist/` is built by CI (`npm run build`), not committed — run `npm run build` locally if you need `index.html` to reflect `src/*.js`/`shared.css` changes, but don't commit the result

## Flavoring is generic, not strawberry-specific
- The recipe's flavoring slot takes a name, a ratio (g per 1g maltodextrin), a carb fraction, and a sugar fraction — see `data/flavorings.js`
- Only the strawberry preset is `confidence: 'tested'` (measured in a real batch); everything else is `'estimated'` — don't upgrade a preset's confidence without an actual measured batch behind it
- When adding a flavoring preset, add it to `data/flavorings.js` and the existing `tests/flavorings.test.js` loop picks it up automatically — no new test needed unless the preset needs special-case behavior

## Health claims need a citation on the page
- Every intake tier in `src/hourly.js` carries a `sourceId` into `data/research.js`, rendered as a "Source" anchor link on the card. Don't add a tier or change a number without a source that backs it
- Cite in the page, not in a code comment — an earlier version claimed "ACSM/ISSN" in a comment when the actual body is ACSM + Academy of Nutrition and Dietetics + Dietitians of Canada, and nothing on the site said so
- Prefer anchored links over tooltips: mouseover doesn't exist on touch and is awkward for screen readers
- Current tier guidance is Morton et al. 2026 (J Nutr), which revised the 2016 ≤90 g/hr cap to 90–120 g/hr for trained athletes. The 2016 statement and Jeukendrup 2014 are kept for context, marked as superseded on the upper end
- Verify citations before publishing them. These were checked against the literature, not recalled
- Intake targets are absolute g/hr and must NOT be turned into per-kg inputs. Absorption is the limiter, not muscle mass, and transporter capacity barely varies with body size — this is the one sports-nutrition number that isn't per-kilogram. Reasoning is in `docs/recipe-source.md`; it deliberately isn't on the site, which just needs the numbers to be right

## Two pages, two jobs
- `ride.html` (+ `src/ride.js`, `src/ride-app.js`) is the day-of bottle planner: duration, intensity, weather, one answer. It deliberately assumes the **base recipe** and **average sweat** — it must not grow a sweat profile or read the batch calculator's formulation. Precision lives on the other page
- Duration, not distance: the carb guidance is duration-based, and deriving duration from distance needs a speed guess that adds more error than it removes
- Salt advice is rounded to 50 mg and expressed in countable capsules. Don't make it look precise
- `index.html` (+ `src/app.js`) is the batch calculator. Both pages share `shared.css`; `build.js` emits a bundle per page

## Disclosure animation is JS, deliberately
- `src/disclosure.js` drives the height directly. The pure-CSS route (transitioning `::details-content` with `interpolate-size`) reports as supported in Chrome here but leaves the element at `block-size: 0` while `[open]` matches — panels stop opening entirely. Verify expansion still works before touching this
- Bails out under `prefers-reduced-motion`, and `openTargetedPanel()` sets `.open` directly so anchors bypass the animation rather than fighting it

## Section responsibilities
- **Calculator** owns every input that changes the batch — including planned carb intake and sweat conditions, because the salt solve reads them. **Per hour** is a pure readout with no inputs at all; if you find yourself adding a control there, it belongs above
- A collapsible panel's `panel__blurb` stays visible when it's open, so the body must not restate it. Three of them opened with a paraphrase of their own summary, which reads like a stutter
- Per hour is collapsed reference: the bottle planner answers "how much today" directly, and the only thing this adds is what *your* batch delivers rather than the standard mix
- Label, Cost, What to buy and References are collapsed `<details>` — they're read once, and the page should land on the tool. They stay in the DOM so anchors keep working, and `openTargetedPanel()` opens a section when something links into it
- `tests/dom-contract.test.js` asserts every id `src/app.js` reaches for exists in `index.html`. Moving markup between sections once deleted an element app.js still wrote to, which threw mid-render and left every later panel blank with no visible error

## Grams are the unit, scoops are a conversion
- There is no standard scoop, so anything a user acts on is expressed in grams first. Scoop counts appear only as a labelled convenience ("of your 46 g scoops")
- Per-hour fueling math must be built on `recipe.perGram`, never `recipe.perScoop` — how much mix an hour takes is a property of the formulation and must not change because someone owns a bigger scoop. There are regression tests for this in `tests/hourly.test.js`
- Recipe presets deliberately don't set scoop size or pantry amounts
- "Serving basis" (planned intake) doesn't change the batch either — it only defines one serving as an hour at that rate, for the label and facts panel. It sits last, and the hint says so, because it read as a composition input when it isn't
- Links inside a `<summary>` must be allowed through in `src/disclosure.js` — `preventDefault()` on the summary click otherwise swallows them and just toggles the panel
- A note cell and the field it describes live in a `.field-pair` so an auto-fit grid can't split them across rows. Without that the arrow could point at nothing even on a wide screen; because they're paired, the direction is knowable and flips to ↓ when they stack
- The fructose ratio is preceded by a `.field--note` cell labelled ADVANCED. It's the one input that meaningfully alters a tested formula, so it's captioned rather than bare — but it's a normal cell in the grid, not a box. A bordered disclosure interrupted the row rhythm
- Scoop size affects no calculation — it's purely a grams-to-scoops display conversion, so it lives in the panel that shows that conversion, not among the batch inputs. The Supplement Facts panel stays pure grams
- **A serving is one hour of fueling, not one scoop.** Both the hero Supplement Facts panel and the printed label size their serving from the per-hour carb target, so "servings per container" reads as hours of fueling — the number you actually want when packing for a ride. A commercial product can define a scoop because it ships you one; a homemade jar can't. `recipe.perScoop` still exists but nothing in the UI uses it

## Parked features — don't re-wire without a reason
- `data/recipes.js` and `src/share.js` are complete and tested but deliberately NOT imported by `src/app.js`. Only `classic` and `bare-bones` were ever actually made; the rest are research-backed extrapolations, and shipping them as a recipe collection (plus a way to share untested variants) claimed more authority than the evidence supports
- The calculator's ratio/salt/flavouring controls already cover everything a preset did, in one field edit
- Re-wire when there are several genuinely tested variants. Until then, leave them out of the bundle

## Share links come in three forms (parked — see above)
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

## Conditions are day-of, not batch
- The batch calculator must NOT ask about weather, sweat or effort. A jar is mixed in advance and can't know Saturday's conditions; salt level there is a general-purpose choice from three presets
- Everything conditional lives on `ride.html`, which reads conditions and advises adding salt on the day. `src/sodium.js` (sweat profiling, salt solving) is parked for this reason
- The bottle planner asks bottle size for **concentration**, not division — concentration is the usual cause of a drink that won't go down, and fluid volume is derived from the existing sweat estimate rather than a fourth question
- Say that the numbers assume you finish what you carry. That's the most common silent failure of a fuelling plan

## Sodium drives the formulation, not a preset (parked)
- `src/sodium.js` estimates a sodium target from sweat rate + sweat sodium, then solves the salt ratio that delivers it at the user's carb intake. Closed form — batch size cancels; see the derivation comment on `solveSaltRatio`
- The reason this exists: carb need scales with duration/intensity, sodium need with sweat rate/heat. A fixed salt percentage welds them together, which is the exact criticism levelled at Gatorade Endurance on the cost panel. Don't reintroduce that coupling
- `MAX_PRACTICAL_SALT_RATIO` is a taste limit, not a math one. Past it the tool must refuse and say "take salt separately" rather than emit an undrinkable formulation. There are tests on the refusal
- The sodium estimate is genuinely uncertain (sweat sodium varies 500–1300 mg/L). Present it as a range to adjust from, never as a prescription
- **A batch that's already mixed is fixed.** Conditions change ride to ride; the jar doesn't. So when sodium falls short, the advice is how much to add *today* — a salt tab alongside — not how to reformulate. Solving the salt level is for a batch about to be made, and the fixed presets exist so someone can describe a batch they already have
- Say it in numbers the reader can act on ("carries 438 mg/hr, add 829") rather than explaining the mechanism. Don't warn about trivial gaps; `MEANINGFUL_GAP` is 10% of target

## Select labels must fit the control
- A native `<select>` does not ellipsize — a long option label just renders underneath the dropdown arrow. `padding-right` reserves room for the arrow but does nothing about the text, so labels have to be genuinely short
- Flavourings carry a `shortName` for the dropdown; `name` stays the full descriptive form used on recipe cards and the printed ingredients list. Detail belongs in the hint under the control, not in the option text
- Measure rather than eyeball: compare the widest option's rendered text width against the select's content box

## Cost data is dated and approximate
- `data/costs.js` carries `PRICED_AS_OF` and a `basis` string per ingredient; flavoring prices live on the flavorings themselves since that slot varies hugely. Every price is labelled `actual` or `estimated` and the page says so
- Comparisons are normalised per gram of **carbohydrate**, never per gram of powder — otherwise the most diluted product looks cheapest
- An hourly cost is meaningless without stating the intake it assumes. The panel says which, and carries a per-100 g figure that doesn't move so the comparison is portable. Per *gram* rounds to a cent or two and can't be compared — use per 100 g
- Don't rig the comparison. Regular Gatorade is genuinely cheaper per carb than making it yourself, and the page says so; there's a test asserting it (`tests/cost.test.js`)
- Prices drift. Re-check and bump `PRICED_AS_OF` rather than silently leaving stale numbers behind a confident-looking table
- **Cost alone is misleading, so never show it alone.** Every product carries a `limitation`, including the homemade mix (`HOMEMADE_LIMITATION`) — a comparison that only lists the competition's drawbacks is advertising. Tests assert both
- Fluid volume per hour at label dilution is what separates a fuel from a hydration drink: regular Gatorade needs ~1.8 L/hr to reach 75 g carbs, Maurten ~0.5 L/hr. Keep that visible. `mlPerServing` is null where the dilution isn't verified — don't guess it
- Sodium gets a status pill against `SODIUM_TARGET_RANGE`, not just a number. Maurten reads `low` and Gatorade Endurance `high`; that judgement is the useful part and there are tests pinning both
- The real reason a sugar drink can't be concentrated into a fuel is osmolality, not ratios — see `OSMOLALITY_NOTE` in `data/costs.js` and the section in `docs/recipe-source.md`. Don't reduce that back to "wrong ratio"

## A flavouring can be a per-bottle addition
- `perBottle: true` flavourings (citrus juice) have `ratio: 0` — they never enter the dry batch, because a liquid would spoil it. The calculator shows a note instead of listing 0 g, and their cost is added per hour rather than per batch
- Lemon juice *powder* is the version that does go in the jar; both are offered because they solve the same craving differently

## Amazon Associate links
- `ASSOCIATES_TAG` in `data/products.js` is `sauce-calc-20`, a site-specific tracking ID under store `mikeylikesit-20`. Don't reuse it on other sites — the point is per-site attribution
- Product `url`s still point at Amazon search results, not guessed ASINs. Replace with the exact product page once picked, keep the `tag` param, and drop that entry's `placeholder: true`
- The Operating Agreement disclosure ("As an Amazon Associate I earn from qualifying purchases") must stay on any page with affiliate links

## GitHub Issues
- When creating an issue, add a size label (`size:small` < 1hr, `size:medium` 1-4hr, `size:large` 4+hr) and a priority label (`priority:low/medium/high/critical`)
- Add a category label when applicable: `ui`, `content`, `feature`, `infrastructure`, `refactor`, `bug`
- Prefer consolidating related work into one issue with a task checklist over many small sub-issues
