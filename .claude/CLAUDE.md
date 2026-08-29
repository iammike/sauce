# The Sauce Project

## Architecture
- Static site, no backend, no build-time framework — `src/app.js` wires the DOM directly
- `src/calculator.js` and `src/hourly.js` are pure functions (no DOM) — keep them that way so they stay unit-testable
- `dist/` is built by CI (`npm run build`), not committed — run `npm run build` locally if you need `index.html` to reflect `src/*.js`/`shared.css` changes, but don't commit the result

## Flavoring is generic, not strawberry-specific
- The recipe's flavoring slot takes a name, a ratio (g per 1g maltodextrin), a carb fraction, and a sugar fraction — see `data/flavorings.js`
- Only the strawberry preset is `confidence: 'tested'` (measured in a real batch); everything else is `'estimated'` — don't upgrade a preset's confidence without an actual measured batch behind it
- `data/tuning.js` is ordered deliberately — batch, bottle, taste, body — so new entries go in the group they belong to rather than on the end
- When adding a flavoring preset, add it to `data/flavorings.js` and the existing `tests/flavorings.test.js` loop picks it up automatically — no new test needed unless the preset needs special-case behavior. One exception: `priceBasis` must be unique across all entries (`tests/flavorings.test.js` checks this) — a copy-pasted basis string (e.g. reusing `other-freeze-dried-fruit`'s "as for strawberry" wording) will fail, because `tests/app-dom.test.js` identifies which flavoring `renderCost()` used by matching its `priceBasis` against `#cost-note`

## Health claims need a citation on the page
- Every intake tier in `src/hourly.js` carries a `sourceId` into `data/research.js`, rendered as a "Source" anchor link on the card. Don't add a tier or change a number without a source that backs it
- Cite in the page, not in a code comment — an earlier version claimed "ACSM/ISSN" in a comment when the actual body is ACSM + Academy of Nutrition and Dietetics + Dietitians of Canada, and nothing on the site said so
- Prefer anchored links over tooltips: mouseover doesn't exist on touch and is awkward for screen readers
- Current tier guidance is Morton et al. 2026 (J Nutr), which revised the 2016 ≤90 g/hr cap to 90–120 g/hr for trained athletes. The 2016 statement and Jeukendrup 2014 are kept for context, marked as superseded on the upper end
- Verify citations before publishing them. These were checked against the literature, not recalled
- Intake targets are absolute g/hr and must NOT be turned into per-kg inputs. Absorption is the limiter, not muscle mass, and transporter capacity barely varies with body size — this is the one sports-nutrition number that isn't per-kilogram. Reasoning is in `docs/recipe-source.md`; it deliberately isn't on the site, which just needs the numbers to be right

## One page, two jobs
- The day-of planner (`src/ride.js`, `src/ride-app.js`) sits first on `index.html` as `#planner`, above the batch calculator, because it's the weekly-use tool and a separate page made it hard to find. `ride.html` is a redirect stub
- It reads the batch on screen via `updateRidePlanner(recipe.perGram)`, so it follows any change to ratio or salt level. `baseRecipeProfile()` is the fallback when nothing is passed. (It used to assume the standard mix — that made sense when it was a separate page with no access to the batch, and stopped making sense once both were on one page)
- It still estimates sodium from **conditions only** — no sweat profile, no salt solving. That part stays coarse on purpose
- Duration, not distance: the carb guidance is duration-based, and deriving duration from distance needs a speed guess that adds more error than it removes
- Salt advice is rounded to 50 mg and expressed in countable capsules. Don't make it look precise
- **Sweat rate and drinking rate are different numbers.** Sodium comes off sweat (what you lose); bottles come off `drinkingRateFor()` (what you actually drink — about 75% of losses, capped at 1.2 L/hr by gastric emptying). Using sweat rate for both overstated bottles by roughly a third and once predicted 2 L/hr, past what a stomach can pass
- `src/ride-app.js` exports `initRidePlanner()` rather than self-starting, and `src/app.js` calls it. One page, one bundle

## Disclosure animation is JS, deliberately
- `src/disclosure.js` drives the height directly. The pure-CSS route (transitioning `::details-content` with `interpolate-size`) reports as supported in Chrome here but leaves the element at `block-size: 0` while `[open]` matches — panels stop opening entirely. Verify expansion still works before touching this
- Bails out under `prefers-reduced-motion`, and `openTargetedPanel()` sets `.open` directly so anchors bypass the animation rather than fighting it

## Write it flat
- State the fact and stop. No "three questions, one answer", no "from a batch that won't mix to a stomach that won't settle", no explaining why a sentence is about to be useful
- Counts in copy go stale — "three questions" survived a fourth input being added. Prefer no count to a wrong one
- Trim, don't gut: the substance in the cost catches and troubleshooting entries is the point; it's the framing around it that goes

## Label sizes
- `data/label-sizes.js` drives the sheet dimensions; `wide: true` switches to a two-column layout with brand and artwork on the left, facts on the right. That's the wrap-a-tub format, printed landscape on one sheet
- `@page { size: auto }` so a landscape sheet isn't clipped by a portrait page

## Label PNG export doesn't use SVG foreignObject
- `src/label-export.js` renders `#label-sheet` to a PNG by walking its DOM and redrawing with Canvas 2D — not the more obvious `<foreignObject>`-in-SVG-in-`<img>` technique. Verified directly in Chrome: a canvas that has ever drawn an SVG image containing a `foreignObject` is permanently tainted and refuses `toBlob()`/`toDataURL()`, even with zero external resources and a trivial one-`<div>` SVG. Deliberate Chrome restriction (Firefox allows it); not fixable by inlining fonts/CSS more carefully
- The walker deliberately doesn't reimplement flexbox/grid — it reads `getBoundingClientRect()`/`getComputedStyle()` off the *already-rendered* live element and replays text/rects/images at those coordinates, scaled up to export DPI. That means it keeps working if the label's CSS layout changes shape, with no matching edit needed here — it never reads a classname, only geometry
- An inline text run (`<strong>Ingredients:</strong> <span>…</span>`) has to be drawn as one leaf, not two independent elements — `<strong>`'s own `getBoundingClientRect()` doesn't reflect where it visually sits relative to a *wrapping* sibling, and drawing both independently overlapped them at the same coordinates. `getComputedStyle(el).display` is what distinguishes true inline flow from a flex/grid item that merely looks inline in the markup: a flex item is blockified and reports `'block'`, even with no `display` set in its own CSS
- `fitLabelPreview()`'s `zoom` (shrinks the wide format for a narrow viewport) has to be reset to `''` before measuring for export and restored right after `walk()` returns — not after the async `canvas.toBlob()` later, since `walk()` is synchronous and a `resize` (which `fitLabelPreview()` is also bound to) landing in that gap would compute a fresh correct zoom only for a late restore to clobber it back
- A label with the note, a maker name and artwork all filled in at once can outgrow its own declared physical size — a pre-existing content-density limit of the design, also visible on the live, un-exported page. The export canvas is exactly `widthIn x heightIn`, so that overflow is clipped in the PNG. That is *not* the same as what print or the on-screen preview do with it — neither sets `overflow: hidden` on `.label-sheet`, so both show the overflow, just outside the drawn border. A canvas has no "outside" to show it in, so this is a genuine narrow gap between the export and the other two, not a match for either
- Text wrapping is Canvas's own `measureText()` greedy-fit, a deliberate approximation of the browser's real line-breaking — good enough to read, not pixel-exact. The Print button already covers the case that needs to be exact. It does still break an unbreakable word (a long product name with no spaces) character-by-character rather than letting it run off the edge — every free-text field on the label sets `overflow-wrap: anywhere` precisely because that happens, and a first version of the wrapper didn't handle it, silently dropping the overrun from the export while the on-screen preview showed it fine
- `isTextLeaf()` excludes `<img>`/`<br>`/`<svg>`/`<canvas>`/`<video>` explicitly, even though they're `display: inline` by default the same as `<strong>` — folding one into a leaf's merged `textContent` would silently drop it (img) or splice it into the surrounding words (br). The artwork `<img>` only ever avoided this by accident, because its wrapping `<figure>` is `display: flex` and blockifies it. `tagName` is only upper-cased for HTML-namespace elements — an `<svg>` reports `'svg'`, not `'SVG'` — so the exclusion set is checked against `child.tagName.toUpperCase()`, not the raw value, or the `<svg>` entry would silently never match
- Artwork isn't necessarily done decoding by the time `walk()` reaches it — `drawImage()` on an `<img>` mid-decode is a spec no-op, not a wait, so clicking Download right after picking a file could export a PNG with the artwork silently missing. Awaited the same way `document.fonts.ready` already is, via `HTMLImageElement.decode()`
- `tests/label-export.test.js` covers `labelFileName()` and `wrapText()` — jsdom has no canvas support at all (`getContext('2d')` returns `null`) without the separate native `canvas` npm package, which pulls in a system Cairo dependency and, being a different rendering engine, wouldn't prove anything about real browser output regardless. `wrapText()` is the exception: it's exported and only ever calls `ctx.measureText()`, so a plain fake `{ measureText }` object under plain Node is enough to pin its line-breaking — including the character-split fallback, which is the one place this file had a real regression before. The rest of the rendering was verified by hand: pixel dimensions at all four label sizes, visual comparison against the on-screen sheet, the wide-format zoom correction, and (via pixel inspection of the exported PNG, not screenshots) the word-wrap and image-decode-await fixes. `tests/app-dom.test.js`'s "downloading the label as a PNG" block covers what jsdom *can* test — the button/status wiring — by mocking `exportLabelPng()` the same way #16 mocks `data/flavorings.js`

## Horizontal space
- Input grids all run the full content width and let `auto-fit` pick the columns. Per-panel caps made identical controls different sizes in different sections
- `--measure` (40rem) applies only to **sustained** prose — troubleshooting bodies. Short intros and blurbs read fine running wider; capping them just wraps them early with dead space alongside
- If a blurb or intro wraps, shorten the copy rather than widening the container

## Careful with string replace on CSS selectors
- A bare `.panel__title {` matched twice and spliced a new rule into the middle of the `:target` selector, leaving every collapsible heading permanently strawberry. Match on enough context to be unique, and check the occurrence count

## Slicing HTML by index: anchor the end search
- `s.index('</footer>')` found the *label's* closing tag hundreds of lines before the site footer, so `s[:start] + s[end:]` ran backwards and duplicated four panels. Always pass the start offset: `s.index(close, start)`. Same trap with `</main>`, `</section>`, `</details>`
- The duplicate-id check in `tests/dom-contract.test.js` is what caught it

## Don't use :last-of-type on panels
- Panels are a mix of `<section>` and `<details>`, so `:last-of-type` matches the last of *each* type — it silently hit the calculator (the only remaining section) and ate its bottom padding, running the rule into the Weigh Out cells. Use `main > .panel:last-child`

## Page order: do it, then look it up
- **Do:** make a batch (open) &rarr; label the jar &rarr; bottle planner for a given ride
- **Look up:** what to buy &rarr; cost &rarr; troubleshooting &rarr; the science
- The nav must mirror this order exactly — it teaches the shape of the page, and a stale nav says the opposite of what the page does

## Section responsibilities
- **Calculator** owns every input that changes the batch. Conditions are not among them — they're a day-of reading and live in the bottle planner
- A collapsible panel's `panel__blurb` stays visible when it's open, so the body must not restate it. Three of them opened with a paraphrase of their own summary, which reads like a stutter
- There is no Per hour section any more — the bottle planner answers "how much today" directly, and a tier table on the batch page only restated it. `CARB_INTAKE_TIERS` still drives `src/ride.js`
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
- Scoop size affects no calculation — it's purely a grams-to-scoops conversion, and its only consumer is the label's directions line, so it lives in the Label panel. The Supplement Facts panel stays pure grams
- **A serving is one hour of fueling, not one scoop.** Both the hero Supplement Facts panel and the printed label size their serving from the per-hour carb target, so "servings per container" reads as hours of fueling — the number you actually want when packing for a ride. A commercial product can define a scoop because it ships you one; a homemade jar can't. `recipe.perScoop` still exists but nothing in the UI uses it

## Parked features — don't re-wire without a reason
- `data/recipes.js` and `src/share.js` are complete and tested but deliberately NOT imported by `src/app.js`. Only `classic` and `bare-bones` were ever actually made; the rest are research-backed extrapolations, and shipping them as a recipe collection (plus a way to share untested variants) claimed more authority than the evidence supports
- The calculator's ratio/salt/flavouring controls already cover everything a preset did, in one field edit
- Re-wire when there are several genuinely tested variants. Until then, leave them out of the bundle

## Share links come in three forms (parked — see above)
- `?p=<slug>` a preset (preferred, readable), `?c=<token>` a packed custom formulation, and the original `?r=&s=&f=&t=` long form which is still parsed so links already shared keep working
- The packed token's field order and slot sizes in `src/share.js` are FROZEN. Changing them silently changes what existing tokens mean — bump `TOKEN_VERSION` instead. `tests/share.test.js` pins a known token/value pair to catch this
- Flavorings carry an explicit append-only `shareId`; never derive the packing from array position

## The carb base is data, not hardcoded ingredients (#30)
- `data/carb-bases.js` owns which carbohydrates a batch is built from. Each part carries `key`, `ratio` (or the string `'carbRatio'` for the one the user sets), `carbFraction` and `sugarFraction`. **Nothing may assume maltodextrin and fructose are the carbs** — `INGREDIENTS`, the recipe grid, the label's ingredient list, the cost breakdown and the price-basis line are all derived from the chosen base. Each of those was a hardcoded list first, and each rendered something wrong (`Maltodextrin —` on a sugar batch, `undefined` in the printed ingredients)
- Sugars are summed from the parts' own `sugarFraction`, never keyed to `fructose`. Sucrose is entirely sugar; getting this wrong is a nutrition-label error, not a cosmetic one
- `DEFAULT_CARB_BASE` is a named export, and `findCarbBase()` uses `hasOwnProperty` — same reasons as `DEFAULT_SALT_PROFILE` and `DEFAULT_FLAVORING_ID`. Resolve the base once in `recalculate()` and thread it through, per #16/#19/#20
- A base with `adjustableRatio: false` **fixes** the ratio and `readInputs()` ignores the control's value rather than trusting it — a stale 0.3 from `persist.js` must not build a sugar batch at 0.3. The control is disabled and left visible rather than hidden, because "why can't I change this" is the obvious question

## Salt is per gram of carbohydrate, not per gram of the reference carb (#30)
- `SALT_PROFILES` entries carry `saltPerCarb`. You dose by carbohydrate, so that's the only definition under which "Endurance" means the same mg/hr whatever else moves. The values are back-derived at the 0.8 default with a fully-carbohydrate flavouring at ratio 0.2 (where `carbSum` is exactly 2.0), so **that** batch is unchanged to the milligram — but every other combination moved, by up to 25%. Don't describe the change as a no-op
- The old per-reference-carb definition drifted silently: 0.65 → 0.8 took endurance from 619 to 573 mg/hr, and a single-carb base would have jumped it to **955** — same label on the select, 66% more salt. There are tests holding every profile steady across base and ratio
- An explicit `saltRatio` (the parked `src/sodium.js` solver) is still a raw per-reference-carb ratio and bypasses this. `tests/calculator.test.js`'s reference-sheet check passes one, because the source spreadsheet's salt was a flat 0.065 per gram of maltodextrin
- Consequence worth knowing: with a 100%-carbohydrate flavouring, carbohydrate per gram of mix is now **constant** — salt rises and falls with the carbs, so the fraction can't move. The ratio is therefore useless as a probe that the bottle planner is following the batch; use a flavouring with `carbFraction < 1`

## A new control needs a change listener, not just the form's input listener
- `#calc-form`'s `'input'` listener covers typing, but a `<select>` driven programmatically (or by keyboard in some browsers) fires only `'change'`. New selects must be added to the explicit `['in-flavor-preset', 'in-salt-profile', 'in-carb-base']` list in `init()`. A browser check with Playwright will **not** catch this — `selectOption()` fires both events

## `[hidden]` loses to `.field { display: flex }`
- The UA sheet's `[hidden] { display: none }` is less specific than a class rule, so setting `el.hidden = true` on a `.field` does nothing visible. `.field[hidden] { display: none; }` fixes it. The DOM test didn't catch it either — it read back the `hidden` property it had just set. `e2e/carb-source.spec.js` checks computed `display`, which is the only kind of test that can

## Don't write a value into a control the user owns
- `renderCarbBase()` used to write the base's fixed ratio into `#in-carb-ratio`. `handleCalcFormChange()` runs `recalculate()` and then `saveCalcFormState()` on the same event, so the overwrite reached `localStorage` immediately: merely *looking* at the table-sugar option reset a 0.5 batch to 1.0, permanently. A fixed value goes in a separate element (`#carb-ratio-fixed`, shown in the input's place) and the input keeps whatever the user typed
- That element is a `<span>`, not an `<output>` — `<output>` is form-associated, so `tests/app-dom.test.js`'s "persists every control `#calc-form` actually has" counted it as a control
- Testing a guard whose value isn't rendered anywhere: assert on what `computeRecipe()` receives, via `vi.doMock` on `src/calculator.js`. The first version of the locked-ratio test asserted the field's value — which the renderer had just set — and passed with the guard deleted

## Osmolality figures are measured, not remembered (#27)
- 9% glucose is **~500 mOsm/L** (90 g/L over 180 g/mol; [D10W's documented 505 mOsm/L agrees — 10% dextrose *monohydrate* is 9.1% anhydrous glucose, 100 g/L over 198.17, not 100/180](https://www.dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=7790c2ce-2f46-7c4d-e053-2991aa0a7eda&type=display)) and 9% maltodextrin is **~55** at DE 10 (avg ~10 glucose units, ~1639 g/mol) — strongly hypotonic, not isotonic. Plasma is ~290. The page carried ~1000 and "roughly isotonic at ~290" until #27; both were wrong and both flattered the recipe, which is the direction to be most suspicious of
- **Maltodextrin's headroom is mostly spent by the fructose slot.** Free fructose is one particle per 180 g/mol exactly as glucose is, so at the 0.8 default two thirds of the mix's osmoles are fructose and under a tenth is maltodextrin. At 75 g carbs in 750 ml the mix is ~330 mOsm/L and plain table sugar is ~336 — within 2%. The advantage is decisive only at low fructose ratios (0.5 → 290). Don't write copy implying maltodextrin makes this mix categorically unlike a sugar drink at the shipped ratio; it doesn't
- **Sweetness and osmolality move together**, because both track how much of the carbohydrate is loose monosaccharide. Table sugar is roughly a third sweeter per gram of carbohydrate than the mix at 0.8 — but state it as a range (a sixth to two thirds): fructose's relative sweetness is quoted 1.2–1.8, and since the mix is fructose-heavy that assumption swings the gap from 17% to 63%. Counterintuitively, the sweeter you take fructose to be, the *smaller* the gap
- Table sugar is in `COMMERCIAL_PRODUCTS` deliberately even though it isn't commercial — it's the honest floor of the comparison (~7x cheaper per carb than the homemade mix) and the answer to "why not just sugar" in the panel's own idiom. Its real objections are no sodium, a ratio fixed at 1.0, and the concentration ceiling — not "wrong ratio"
- `OSMOLALITY_NOTE` is rendered into `#osmolality-note` in the cost panel. It spent its whole life exported and unit-tested while nothing imported it — `tests/cost.test.js` asserted its wording and couldn't tell it was off-screen. `tests/app-dom.test.js` now pins that it renders

## The carb ratio reads fructose-first (#26)

- `carbRatio` is **grams of fructose per 1 g of maltodextrin** — the fructose-first form the literature uses, glucose held at 1. The control is labelled that way (`Fructose : glucose`, `0.8` `: 1`) and `#ratio-readout` carries the translation. Don't flip the stored number to an `X:1` glucose-first form: it would need a persistence and share-token migration, and `1:0` — glucose only — has no `X:1` equivalent
- `DEFAULT_CARB_RATIO` is **0.8**, not the 0.65 originally mixed. O'Brien et al. 2013 (`obrien-2013`) rode 0.5 / 0.8 / 1.25 head to head at 90 g/hr and 0.8 won. **1.25 placed between the other two, so 0.8 is a peak, not a floor** — `tests/app-dom.test.js` asserts the default never ships above `FRUCTOSE_RATIO_MEASURED_BEST`. Morton's 0.6–1.0 is a band; 0.8 is the only point in it with a head-to-head result, which is why the readout names it separately
- `renderRatioReadout()` must read `in-carb-ratio` with the *same* `Number(...) || 0` `readInputs()` uses — see "Calculator inputs persist across visits" for why that parity is what makes the second read harmless. A version rounded to 2dp there so the measured-best equality would tolerate a long float, and that classified 1.004 and 0.596 as in-band and 0.054 as glucose-only: the readout described a different number than the batch beside it. Rounding for display is fine; rounding before `ratioStatus()` is not
- The number lives in three places — `index.html`'s markup default, `DEFAULT_CARB_RATIO`, `FRUCTOSE_RATIO_MEASURED_BEST`. A test ties the first two together; keep it that way
- **Don't compute a market label for the ratio.** There is no single glucose-first convention: 0.5 is sold as 2:1 and never as 1:0.5, while 0.8 is sold as 1:0.8. `RATIO_MARKET_NAMES` in `src/app.js` names only the ratios something is actually sold at and stays silent between them. A first version derived `1:${ratio}` for every value and printed ratios nobody uses
- `tests/calculator.test.js`'s reference-sheet comparison passes `carbRatio: 0.65` explicitly — the source spreadsheet is a 0.65 sheet, and that test is about the port agreeing with it, not about what ships. Same reason `data/recipes.js`'s parked `classic` preset stays at 0.65: it's the batch actually made
- Moving the ratio moves the taste and the osmolality, not just absorption: fructose is the sweetest common sugar and maltodextrin near-flavourless, so 0.65 → 0.8 is roughly 10% sweeter, and about five points of the carb load shift from polymer to monomer

## Nutrition math
- Sodium is always sodium citrate dihydrate at 235 mg Na/g — never table salt's ~393 mg Na/g. An earlier version of the source spreadsheet used the NaCl figure and overstated sodium by ~40%; don't reintroduce that
- See `docs/recipe-source.md` for the full ratio derivation and the source spreadsheet link

## Share links are untrusted input
- `src/share.js` decodes recipe formulations from the query string. Anyone can hand-edit a link, so every value is validated against a known set (`hasOwnProperty`, not `in` — otherwise `constructor`/`__proto__` pass) or clamped to a range, with per-field fallback
- Decoded values are assigned to form inputs only, never interpolated into `innerHTML`
- Note `Number(null)` is `0`, not `NaN` — a missing param must be rejected before conversion or it silently clamps to the minimum instead of falling back. There's a regression test for this

## Calculator inputs persist across visits
- `src/persist.js` saves `#calc-form`'s fields to `localStorage` on every change and restores them once, before the first render. The field list is a hand-maintained match to the form, not derived from it — a control added to `#calc-form` needs a matching entry in `persist.js`'s `NUMBER_FIELDS`/`SELECT_FIELDS` or it won't persist. `tests/app-dom.test.js`'s `persists every control #calc-form actually has, and nothing extra` catches the mismatch either direction, so this fails loudly rather than silently. `in-scoop` is deliberately excluded — it lives in the Label panel, outside `#calc-form`, and has no calculation effect (see "Grams are the unit" above)
- A saved record is untrusted input, the same as a share link: every field is validated independently, and a bad one is skipped rather than discarding the rest of the record or propagating `Number('')`/`Number(null)`, which are both `0`, not "unset"
- Bounds are read from the live DOM element (`el.min`/`el.max`, a select's own `<option>`s), never duplicated into a model in `persist.js`. A duplicated bound drifts from the markup silently — for the salt-profile select specifically, a value that's a real `<option>` but isn't a key in `SALT_PROFILES` used to throw inside `ratiosFor()` and blank the whole page
- `in-salt-profile`'s `<option>`s are built by `initSaltProfiles()` from `SALT_PROFILES`, the same way `initFlavorPresets()` builds `in-flavor-preset` from `FLAVORINGS` — not hand-written in `index.html`. That removes the markup/model drift at its root rather than only detecting it. `readInputs()` still falls back to `SALT_PROFILES`'s `DEFAULT_SALT_PROFILE` (`hasOwnProperty`, not `in` — see "Share links are untrusted input" above for why) for a value that reaches the select some other way — an in-flight tab from before a profile was renamed, or `persist.js` restoring a stale record. `DEFAULT_SALT_PROFILE` is a named export, not `Object.keys(SALT_PROFILES)[0]` — `SALT_PROFILES` is ordered by salt concentration (moderate → endurance → hot), not by which entry is the default, so a positional fallback would silently pick `moderate`. `FLAVORINGS` has the identical named-default pattern now: `DEFAULT_FLAVORING_ID` lives in `data/flavorings.js` next to it (#20) — `FLAVORINGS[0]` being `'strawberry'` today is a fact about the data (the tested baseline for an actual flavoring — `'unflavored'` further down is also `confidence: 'tested'`, trivially, since skipping the slot leaves nothing to measure), not something either `initFlavorPresets()`'s initial select value or `recalculate()`'s unrecognised-value fallback are allowed to depend on anymore. Note the tradeoff this introduces: `findFlavoring(...) ?? findFlavoring(DEFAULT_FLAVORING_ID)` can itself resolve to `undefined` if `DEFAULT_FLAVORING_ID` were ever wrong, where the old positional fallback couldn't — `tests/flavorings.test.js` pins that it names a real entry specifically to close that door
- Resolve a select (or, since #19, a plain field the render chain depends on more than once) exactly once, in `recalculate()`, and thread the resolved value through every function that needs it — don't re-read `$(id).value` a second time for the same control elsewhere in the render chain. `readInputs(flavor, scoopGrams)` and `renderRecipeGrid(recipe, flavor)` take their resolved values as parameters for this reason. `in-scoop` isn't a `#calc-form` select (see "Grams are the unit" above) and has no unrecognised-value case — its bug was a plainer one, `readInputs()` and `recalculate()` each reading `$('in-scoop').value` with a different blank-field fallback (`|| 1` vs `|| 0`) — but the fix is the same shape: resolve once, thread the result. `in-salt-profile` is the one select handled differently: it's still resolved inside `readInputs()` itself, since that fallback needs `DEFAULT_SALT_PROFILE` from `calculator.js` regardless of caller and there's currently only one caller to thread it to. (Non-select fields still get read more than once by design — `renderRatioReadout()` re-reads `in-carb-ratio` after `readInputs()` already has it, harmlessly, since both apply the same `Number(...) || 0`; this rule is about a value with a *fallback that can disagree* across independent reads, not about touching an input's `.value` more than once)
- Three real instances of the same bug, all from an unrecognised or blank value reaching a control some other way (a stale `persist.js` record, an in-flight tab from before a rename, a field simply left empty): `renderSaltNote()` used to re-resolve `in-salt-profile` independently and could disagree with `readInputs()`'s fallback — the batch rendered at the endurance numbers while the note quietly went blank. `in-flavor-preset` had the identical shape (#16): `renderRecipeGrid()`'s internal re-resolution had no `?? FLAVORINGS[0]` fallback at all, invisible under the real data order because the fallback flavoring isn't `perBottle`, so the bug and the fix looked identical — reachable only if a `perBottle` entry ever led the array. `in-scoop` (#19) is the same shape once more, on a value that isn't even a select. A regression test for any of these can't just assert against real data if the divergence only shows up under an arrangement production doesn't currently have — the flavoring one mocks `data/flavorings.js` to force a `perBottle` entry first; the scoop one spies on `computeRecipe()`'s own received `inputs.scoopGrams`, since `recipe.perScoop` — its only consumer — isn't rendered anywhere to assert against directly
- `restoreCalcFormState()` must run after `initFlavorPresets()`/`initSaltProfiles()` build both selects' options (both for the value to land, and for DOM-based validation to have something to check against) and before the first `recalculate()` reads the form
- Restoring a `type="number"` input assigns the *normalised* number (`String(n)`), not the original saved string. The HTML number-input value-sanitizer and `Number()` disagree on valid syntax — whitespace, a leading `+`, hex notation all parse fine via `Number()` but silently blank the field on assignment
- Save is intentionally unvalidated (it writes whatever's on screen, including a value typed past a field's `max`); validation lives entirely in restore, so an out-of-range edit reverts to the markup default on the next visit rather than surviving unvalidated. Deliberate — see the comment on `saveCalcFormState()`
- Testing a listener's thrown exception: `dispatchEvent()` does not rethrow synchronously (browsers and jsdom both report it as an uncaught exception on `window` instead), so `expect(() => el.dispatchEvent(...)).not.toThrow()` is a guaranteed-pass that proves nothing. Listen for `window`'s own `'error'` event instead

## Label artwork stays client-side
- Artwork is read with `FileReader` into a data URL and never uploaded — there is no server to upload to. Keep it that way
- The `accept` attribute is a hint, not a control: MIME type and size are re-checked in `loadArtwork()`. Don't add SVG to the allowlist (it can carry script)

## Conditions are day-of, not batch
- The batch calculator must NOT ask about weather, sweat or effort. A jar is mixed in advance and can't know Saturday's conditions; salt level there is a general-purpose choice from three presets
- Everything conditional lives in the bottle planner, which reads conditions and advises adding salt on the day. `src/sodium.js` (sweat profiling, salt solving) is parked for this reason
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

## Flavouring ratios: show the arithmetic
- Only strawberry is tested. The concentrated options are calculated from the product's own dosing (a 3.9 g Kool-Aid packet flavours 2 quarts &rarr; ~2% of the mix) and each note states that it's a calculation rather than a tasted result
- They look low next to strawberry's 10.4% because freeze-dried fruit *is* the fruit, while a drink-mix packet is citric acid and flavour. That gap is real, not an error — but the exact numbers are soft

## A flavouring can be a per-bottle addition
- `perBottle: true` flavourings (citrus juice) have `ratio: 0` — they never enter the dry batch, because a liquid would spoil it. The calculator shows a note instead of listing 0 g, and their cost is added per hour rather than per batch
- Lemon juice *powder* is the version that does go in the jar; both are offered because they solve the same craving differently

## Amazon Associate links
- `ASSOCIATES_TAG` in `data/products.js` is `sauce-calc-20`, a site-specific tracking ID under store `mikeylikesit-20`. Don't reuse it on other sites — the point is per-site attribution
- Product `url`s still point at Amazon search results, not guessed ASINs. Replace with the exact product page once picked, keep the `tag` param, and drop that entry's `placeholder: true`
- The Operating Agreement disclosure sits **inside** the What to buy panel, beside the links. It briefly lived in the footer, where it read "these are affiliate links" with no links anywhere near it. Keep it beside the links

## Browser checks live in e2e/, not tests/
- `tests/**/*.test.js` is Vitest + jsdom, which never renders layout — it's why `tests/app-dom.test.js` would still pass with `shared.css` deleted. Anything that needs real layout (overflow, computed geometry, font metrics) goes in `e2e/` instead, run by Playwright (`npm run test:e2e`), and is excluded from `vitest.config.js`'s `include` by living outside `tests/`
- `playwright.config.js`'s `webServer` only runs `npm run serve` — the build is NOT there, deliberately, because `reuseExistingServer` (on by default outside CI) means that command may not run at all locally. `npm run test:e2e` runs `npm run build` unconditionally before invoking Playwright, so a stale `dist/` can't report a false green
- `e2e/mobile-overflow.spec.js` (#24, split out of #13 — full visual-regression scope was closed as not-now for the baseline-churn cost on a site still being restyled) asserts no horizontal overflow at 320/375/390/430px against the built page. It first asserts `#calculator` is visible, so a blank page (failed build, a JS throw mid-render) fails loudly instead of trivially passing with zero content. It also awaits `document.fonts.ready` before measuring — Google Fonts is loaded via `@import` with `display: swap` (`shared.css:8`), and measuring mid-swap or against fallback metrics is exactly what caught the bug below
- That bug: `.panel--collapsible > summary`'s grid used a bare `1fr` first column. A bare `1fr` track's minimum is `auto` (min-content), so an unbreakable title word ("Troubleshooting") can force the track past the viewport instead of wrapping — invisible with the real webfont at every width tried, but the fallback sans-serif is wide enough to overflow at exactly 320px, the one width with zero layout headroom. Fixed with `minmax(0, 1fr)`. Worth remembering for any other grid title column: a bare `1fr` doesn't actually cap content at the track width the way it looks like it should

## GitHub Issues
- When creating an issue, add a size label (`size:small` < 1hr, `size:medium` 1-4hr, `size:large` 4+hr) and a priority label (`priority:low/medium/high/critical`)
- Add a category label when applicable: `ui`, `content`, `feature`, `infrastructure`, `refactor`, `bug`
- Prefer consolidating related work into one issue with a task checklist over many small sub-issues
