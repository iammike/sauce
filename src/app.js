import { computeRecipe } from './calculator.js';
import { CARB_BASES, DEFAULT_CARB_BASE, findCarbBase } from '../data/carb-bases.js';
import { planForCarbTarget, ratioStatus, FRUCTOSE_RATIO_OPTIMAL,
  FRUCTOSE_RATIO_MEASURED_BEST, FRUCTOSE_RATIO_SOURCE_ID,
  DEFAULT_TARGET_CARBS, sodiumStatus } from './hourly.js';
import { formatGrams, formatMg, formatCalories, formatCount } from './format.js';
import { FLAVORINGS, findFlavoring, DEFAULT_FLAVORING_ID } from '../data/flavorings.js';
import { TUNING } from '../data/tuning.js';
import { PRODUCTS } from '../data/products.js';
import { RESEARCH, findResearch } from '../data/research.js';
import { batchCost, costPerGramCarb, compareAtCarbTarget } from './cost.js';
import { PRICED_AS_OF, INGREDIENT_COSTS, HOMEMADE_LIMITATION, OSMOLALITY_NOTE,
  OSMOLALITY_SOURCE_ID } from '../data/costs.js';
import { SALT_PROFILES, DEFAULT_SALT_PROFILE } from './calculator.js';
import { initDisclosureAnimation } from './disclosure.js';
import { initRidePlanner, updateRidePlanner } from './ride-app.js';
import { LABEL_SIZES, findLabelSize } from '../data/label-sizes.js';
import { saveCalcFormState, restoreCalcFormState } from './persist.js';
import { exportLabelPng, labelFileName } from './label-export.js';

const $ = (id) => document.getElementById(id);

// Takes the resolved base rather than re-reading the select, the same rule
// #16/#19/#20 established for the flavouring and scoop size.
function readInputs(flavor, scoopGrams, base) {
  const capRaw = $('in-cap').value;
  // Sucrose is glucose and fructose bonded 1:1 — the molecule fixes the
  // ratio, so the control's value is ignored rather than trusted here.
  const carbRatio = base.adjustableRatio
    ? Number($('in-carb-ratio').value) || 0
    : base.fixedCarbRatio;
  const saltProfileValue = $('in-salt-profile').value;
  return {
    onHand: {
      maltodextrin: Number($('in-malto').value) || 0,
      fructose: Number($('in-fructose').value) || 0,
      sucrose: Number($('in-sucrose').value) || 0,
      flavoring: Number($('in-flavoring').value) || 0,
      salt: Number($('in-salt').value) || 0,
    },
    carbBase: base.id,
    // ratiosFor() throws on a name SALT_PROFILES doesn't define, which would
    // otherwise abort init() and blank the whole page. initSaltProfiles()
    // below builds this select's options from SALT_PROFILES directly, so
    // that can no longer happen through markup drift — this fallback is for
    // a value that reaches the select some other way: an in-flight tab from
    // before a profile was renamed, or persist.js restoring a stale record.
    // hasOwnProperty, not `in` — `in` walks the prototype chain, so
    // 'constructor' would resolve to Object.prototype.constructor and slip
    // through with an undefined .ratio instead of being rejected.
    saltProfile: Object.prototype.hasOwnProperty.call(SALT_PROFILES, saltProfileValue)
      ? saltProfileValue
      : DEFAULT_SALT_PROFILE,
    scoopGrams,
    carbRatio,
    maxBatchGrams: capRaw === '' ? undefined : Number(capRaw),
    flavorName: flavor.name,
    flavorRatio: flavor.ratio,
    flavorCarbFraction: flavor.carbFraction,
    flavorSugarFraction: flavor.sugarFraction,
  };
}

const LIMITING_LABELS = {
  maltodextrin: 'Maltodextrin',
  fructose: 'Fructose',
  sucrose: 'Table sugar',
  flavoring: 'Flavoring',
  salt: 'Sodium citrate',
  cap: 'your batch-size cap',
};

// A serving is one hour of fueling, not one scoop. A commercial product can
// define a scoop because it ships you one; a jar of homemade mix can't, and
// an hour is both universal and the unit people actually plan rides in.
function servingFor(recipe, targetCarbs, scoopGrams) {
  const plan = planForCarbTarget(recipe.perGram, scoopGrams, targetCarbs);
  const grams = plan.mixGramsPerHour;
  return {
    grams,
    scoops: plan.scoopsPerHour,
    perServing: {
      carbsG: recipe.perGram.carbsG * grams,
      sugarsG: recipe.perGram.sugarsG * grams,
      sodiumMg: recipe.perGram.sodiumMg * grams,
      calories: recipe.perGram.calories * grams,
    },
    // How many hours of fueling the batch holds — the number you want when
    // deciding whether you've made enough for the weekend.
    servingsPerBatch: grams > 0 ? recipe.actualBatch / grams : 0,
  };
}

function renderFactsPanel(recipe, serving, targetCarbs) {
  $('fp-batch').textContent = formatGrams(recipe.actualBatch);
  $('fp-serving-size').textContent = formatGrams(serving.grams);
  $('fp-servings').textContent = formatCount(serving.servingsPerBatch, 1);
  $('fp-calories').textContent = formatCalories(serving.perServing.calories);
  $('fp-carbs').textContent = formatGrams(serving.perServing.carbsG);
  $('fp-sugars').textContent = formatGrams(serving.perServing.sugarsG);
  $('fp-sodium').textContent = formatMg(serving.perServing.sodiumMg);
  $('fp-flavor-name').textContent = recipe.flavorName;
  $('fp-target').textContent = `${targetCarbs} g carbs/hr`;
}

const money = (v) => `$${v.toFixed(2)}`;

function renderCost(recipe, flavor, targetCarbs, base) {
  const cost = batchCost(recipe.recipeGrams, flavor.pricePerGram);
  // A per-bottle flavouring adds nothing to the batch but isn't free to use.
  // Assume roughly a bottle an hour, which is what the planner assumes too.
  const perBottleCostPerHour = flavor.perBottle
    ? flavor.perBottleMl * flavor.pricePerMl
    : 0;
  const perGramCarb = costPerGramCarb(cost.total, recipe.totals.carbsG)
    + (targetCarbs > 0 ? perBottleCostPerHour / targetCarbs : 0);
  const { mine, commercial } = compareAtCarbTarget(perGramCarb, targetCarbs);

  const mineSodium = recipe.perGram.carbsG > 0
    ? (recipe.perGram.sodiumMg / recipe.perGram.carbsG) * targetCarbs : 0;

  const rows = [
    {
      // Only as confident as its least confident ingredient — the sugar base
      // is priced 'estimated', and claiming 'actual' over it would be the
      // same overstatement the rest of this panel is careful to avoid.
      name: 'The Sauce',
      perHour: mine,
      mine: true,
      confidence: base.parts.every((p) => INGREDIENT_COSTS[p.key]?.confidence === 'actual')
        ? 'actual'
        : 'estimated',
      note: `Your mix, at ${money(cost.total)} for the whole ${formatGrams(recipe.actualBatch)} batch.`,
      sodiumMgPerHour: mineSodium,
      litresPerHour: null,
      limitation: HOMEMADE_LIMITATION,
    },
    ...commercial,
  ].sort((a, b) => a.perHour - b.perHour);

  // State the intake the hourly figures assume, and stop there — the per-100 g
  // line on each card already handles portability without commentary.
  $('cost-basis').innerHTML = `Hourly costs are at your planned intake of <strong>${targetCarbs} g carbs/hr</strong>.`;

  $('cost-grid').innerHTML = rows.map((r) => `
    <div class="card${r.mine ? ' card--active' : ''}">
      <p class="card__eyebrow">${r.name}${r.confidence === 'estimated' ? ' · estimated' : ''}</p>
      <p class="card__value data">${money(r.perHour)}<span class="card__unit"> / hour</span></p>
      <p class="field-hint">${money((r.perGramCarb ?? perGramCarb) * 100)} per 100 g of carbohydrate</p>
      <p class="field-hint">${formatMg(r.sodiumMgPerHour)} sodium/hr <span class="${statusPillClass(sodiumStatus(r.sodiumMgPerHour))}">${sodiumStatus(r.sodiumMgPerHour)}</span></p>
      <p class="cost-card__note">${r.note ?? ''}</p>
      <p class="field-hint cost-card__limitation"><strong>Catch:</strong> ${r.limitation}</p>
    </div>
  `).join('');

  // Share of spend rarely matches share of weight — that contrast is the
  // actually useful thing here.
  const labels = {
    ...Object.fromEntries(base.parts.map((p) => [p.key, p.name])),
    flavoring: flavor.name, salt: 'Sodium citrate',
  };
  $('cost-breakdown').innerHTML = Object.entries(cost.perIngredient)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => {
      const weightShare = recipe.actualBatch > 0 ? recipe.recipeGrams[key] / recipe.actualBatch : 0;
      const costShare = cost.share[key];
      const skew = weightShare > 0 ? costShare / weightShare : 0;
      return `
        <div class="card">
          <p class="card__eyebrow">${labels[key]}</p>
          <p class="card__value data">${(costShare * 100).toFixed(0)}%<span class="card__unit"> of cost</span></p>
          <p class="field-hint">${(weightShare * 100).toFixed(0)}% of the weight${skew >= 1.5 ? ` — <span class="warn">${skew.toFixed(1)}× its share</span>` : ''}</p>
          <p class="field-hint">${money(value)} per batch</p>
        </div>
      `;
    }).join('');

  // Bases are listed from the base itself, not named literally — a sugar
  // batch quoting maltodextrin and fructose prices would be quoting the cost
  // of ingredients that aren't in it.
  const priceBases = base.parts
    .map((p) => INGREDIENT_COSTS[p.key]?.basis)
    .filter(Boolean)
    .join(', ');
  $('cost-note').textContent = `Ingredient prices as of ${PRICED_AS_OF} (${priceBases}, ${INGREDIENT_COSTS.salt.basis}, flavoring ${flavor.priceBasis}). Prices move — treat these as ballpark, not quotes.`;
}

// Takes the resolved base for the same reason it takes the resolved flavour:
// the carbs listed here must be the carbs the batch was computed from. A
// hardcoded list rendered "Maltodextrin —" next to a sugar batch and left the
// sugar itself off the card grid entirely.
function renderRecipeGrid(recipe, flavor, base) {
  const grid = $('recipe-grid');
  const rows = [
    ...base.parts.map((p) => [p.key, p.name]),
    ['flavoring', recipe.flavorName],
    ['salt', 'Sodium citrate'],
  ];
  grid.innerHTML = rows.map(([key, label]) => {
    const pct = recipe.sumRatio > 0 ? (recipe.ratios[key] / recipe.sumRatio) * 100 : 0;
    const active = recipe.limiting === key;
    return `
      <div class="card${active ? ' card--active' : ''}">
        <p class="card__eyebrow">${label}${active ? ' — limiting' : ''}</p>
        <p class="card__value data">${formatGrams(recipe.recipeGrams[key])}</p>
        <p class="field-hint">${pct.toFixed(1)}% of batch</p>
      </div>
    `;
  }).join('');

  const perBottleNote = $('flavor-per-bottle');
  if (flavor.perBottle) {
    perBottleNote.hidden = false;
    perBottleNote.innerHTML = `<strong>${flavor.name} goes in the bottle, not the jar.</strong> Mix the batch unflavoured and add about ${flavor.perBottleMl} ml per bottle — which means you can change the flavour, or skip it, without committing the whole batch.`;
  } else {
    perBottleNote.hidden = true;
  }

  const limitLabel = LIMITING_LABELS[recipe.limiting] ?? recipe.limiting;
  $('calc-limiting').textContent = recipe.limiting === 'cap'
    ? `Sized to your ${formatGrams(recipe.actualBatch)} container. You have enough of every ingredient for more than one batch.`
    : `${limitLabel} is the limiting ingredient — everything else is scaled to match it.`;
}

function statusPillClass(status) {
  return `status-pill status-pill--${status}`;
}

// How the market writes each ratio, but only where it actually writes one.
// There is no single mechanical glucose-first form to compute: a 0.5 mix is
// sold as 2:1 and never as 1:0.5, while a 0.8 mix is sold as 1:0.8. Deriving
// one label for every value printed ratios nobody uses, so the readout names
// the landmarks and stays quiet between them.
// Only where the market's name differs from what the control already shows.
// The control reads glucose-first (1 : 0.8), which IS how a 0.8 or a 1:1 mix
// is printed on a packet — repeating it back would be noise. 0.5 is the one
// that disagrees: it is universally sold as 2:1, never as 1:0.5.
const RATIO_MARKET_NAMES = {
  0.5: 'the classic 2:1',
};

// The control asks for the ratio the way the research writes it — fructose
// first, glucose held at 1 — so the readout carries what the control can't:
// where the number sits against the evidence, and what it's called on a
// product label if it's called anything. 0.8 is named separately from
// Morton's band because it's the only ratio in that band with a head-to-head
// result behind it.
// Shows only the on-hand boxes the chosen base actually uses, and locks the
// ratio control when the base fixes it. Locked rather than hidden: "why can't
// I change this" is the obvious question, and a disabled field with a reason
// beside it answers it where a missing field wouldn't.
function renderCarbBase(base) {
  const used = new Set(base.parts.map((p) => p.key));
  for (const el of document.querySelectorAll('[data-carb-part]')) {
    el.hidden = !used.has(el.dataset.carbPart);
  }
  $('carb-base-note').textContent = base.note;

  // The input keeps the user's own number whatever the base — writing the
  // fixed value into it destroyed that number, and because
  // handleCalcFormChange() saves right after recalculating, the overwrite
  // reached localStorage on the same event. Merely looking at the sugar
  // option permanently reset a 0.5 batch to 1.0. The fixed value is shown
  // in a separate element instead, and the input is swapped out for it.
  const ratio = $('in-carb-ratio');
  const fixed = $('carb-ratio-fixed');
  ratio.hidden = !base.adjustableRatio;
  ratio.disabled = !base.adjustableRatio;
  fixed.hidden = base.adjustableRatio;
  fixed.textContent = base.adjustableRatio ? '' : String(base.fixedCarbRatio);
}

function renderRatioReadout(base) {
  // Read exactly the way readInputs() reads it — same Number(...) || 0, no
  // rounding. A version of this rounded to 2dp to make the equality below
  // tolerant of a long float, and that quietly classified 1.004 as in-band,
  // 0.596 as in-band and 0.054 as glucose-only: the readout described a
  // different number than the batch beside it was computed from. The
  // equality is worth less than that parity. A long float can now only
  // arrive from a hand-edited long-form share link (the packed token already
  // rounds, src/share.js), and all it costs there is the parenthetical.
  const ratio = base.adjustableRatio
    ? Number($('in-carb-ratio').value) || 0
    : base.fixedCarbRatio;
  const readout = $('ratio-readout');
  const status = ratioStatus(ratio);

  if (status === 'none') {
    readout.innerHTML = '<span class="warn">Glucose only — caps you near 60 g/hr</span>';
    return;
  }

  // A base that fixes the ratio gets a statement, not advice: nudging toward
  // 0.8 is useless when the molecule decides and the control is disabled.
  if (!base.adjustableRatio) {
    readout.textContent = base.fixedRatioNote;
    return;
  }

  const source = `<a href="#ref-${FRUCTOSE_RATIO_SOURCE_ID}">measured best</a>`;
  const band = `${FRUCTOSE_RATIO_OPTIMAL.min.toFixed(1)}–${FRUCTOSE_RATIO_OPTIMAL.max.toFixed(1)}`;
  const verdict = ratio === FRUCTOSE_RATIO_MEASURED_BEST
    ? `<span class="ok">The ${source}</span>`
    : {
      optimal: `<span class="ok">In the optimal ${band}</span>. ${FRUCTOSE_RATIO_MEASURED_BEST} is the ${source}`,
      below: `Below the optimal ${band}`,
      above: `Above the optimal ${band}`,
    }[status];
  const market = RATIO_MARKET_NAMES[ratio];
  readout.innerHTML = market ? `${verdict} (${market})` : verdict;
}

// A batch is mixed in advance and can't know Saturday's weather. Salt level is
// a general choice here; reading conditions on the day — including whether to
// take extra salt — is what the bottle planner is for.
//
// Takes the already-resolved profile name rather than reading and resolving
// $('in-salt-profile').value again itself. A second independent resolution
// of the same select can disagree with the first: readInputs() falls back to
// DEFAULT_SALT_PROFILE for a value SALT_PROFILES doesn't define (a bad
// persisted record, or an in-flight tab from before a profile was renamed),
// but a second direct read here saw the raw unresolved value, found no
// profile, and blanked the note — while the batch below it was computed at
// the fallback's numbers. The note said nothing was wrong; the sodium figure
// was quietly for a different salt level than the one the select displayed.
function renderSaltNote(saltProfile) {
  const profile = SALT_PROFILES[saltProfile];
  $('salt-profile-note').textContent = profile
    ? `${profile.note} Adjust for conditions on the day, not in the jar.`
    : '';
}

function recalculate() {
  // Resolved once here rather than separately in readInputs(),
  // renderRecipeGrid() and renderCost() — three independent reads of the
  // same select used to disagree on the fallback for an unrecognised value
  // (renderRecipeGrid() had none at all), the same failure shape already
  // fixed for the salt-profile select. See #16.
  const flavor = findFlavoring($('in-flavor-preset').value) ?? findFlavoring(DEFAULT_FLAVORING_ID);
  // Same reasoning for in-scoop: readInputs() and this function used to read
  // it separately with different fallbacks (1 vs. 0). Harmless today only
  // because recipe.perScoop (readInputs()'s consumer) isn't rendered
  // anywhere — see #19 — but resolving it once, the same way flavor is
  // above, means the two can't quietly disagree if that ever changes.
  const scoopGrams = Number($('in-scoop').value) || 0;
  // Resolved once for the same reason as the flavouring above.
  const base = findCarbBase($('in-carb-base').value) ?? findCarbBase(DEFAULT_CARB_BASE);
  const inputs = readInputs(flavor, scoopGrams, base);
  const recipe = computeRecipe(inputs);
  const targetCarbs = Number($('in-target-carbs').value) || DEFAULT_TARGET_CARBS;
  const serving = servingFor(recipe, targetCarbs, scoopGrams);

  renderCarbBase(base);
  renderRatioReadout(base);
  renderSaltNote(inputs.saltProfile);
  renderFactsPanel(recipe, serving, targetCarbs);
  renderRecipeGrid(recipe, flavor, base);
  renderLabel(recipe, serving, targetCarbs, base);
  renderCost(recipe, flavor, targetCarbs, base);
  updateRidePlanner(recipe.perGram);
}

function initTuning() {
  $('tuning-list').innerHTML = TUNING.map((t) => `
    <details class="tuning-item" id="tune-${t.id}">
      <summary>
        <span class="tuning-item__symptom">${t.symptom}</span>
      </summary>
      <div class="tuning-item__body">
        <p class="tuning-item__fix"><strong>Do this:</strong> ${t.fix}</p>
        <p class="tuning-item__why">${t.why}</p>
      </div>
    </details>
  `).join('');
}

function initFlavorPresets() {
  const select = $('in-flavor-preset');
  select.innerHTML = FLAVORINGS.map((f) => `<option value="${f.id}">${f.shortName ?? f.name}</option>`).join('');
  select.value = DEFAULT_FLAVORING_ID;
}

// Built from SALT_PROFILES rather than left as hand-written <option>s in
// index.html, the same reason initFlavorPresets() builds from FLAVORINGS: a
// hand-maintained option list can name a value SALT_PROFILES doesn't define,
// which used to throw inside ratiosFor() and blank the page, and — after that
// was given a fallback in readInputs() — could instead render silently at the
// wrong salt level with no error. Building the options here removes the
// drift entirely rather than only detecting it.
// Built from CARB_BASES rather than hand-written <option>s, the same way the
// flavouring and salt-profile selects are — markup that names a value the
// model doesn't define is a drift bug waiting to happen.
function initCarbBases() {
  $('in-carb-base').innerHTML = Object.values(CARB_BASES)
    .map((b) => `<option value="${b.id}">${b.shortName}</option>`)
    .join('');
  $('in-carb-base').value = DEFAULT_CARB_BASE;
}

function initSaltProfiles() {
  const select = $('in-salt-profile');
  select.innerHTML = Object.entries(SALT_PROFILES)
    .map(([id, profile]) => `<option value="${id}">${profile.label}</option>`).join('');
  select.value = DEFAULT_SALT_PROFILE;
}

function renderProductCards(list) {
  return list.map((p) => `
    <div class="card product-card">
      <p class="product-card__name">${p.name}</p>
      <p class="product-card__note">${p.note}</p>
      <a class="btn btn--outline" href="${p.url}" target="_blank" rel="noopener sponsored">View on Amazon</a>
    </div>
  `).join('');
}

function initProducts() {
  const ingredients = PRODUCTS.filter((p) => p.kind !== 'equipment');
  const equipment = PRODUCTS.filter((p) => p.kind === 'equipment');
  $('products-grid').innerHTML = renderProductCards(ingredients);
  $('equipment-grid').innerHTML = renderProductCards(equipment);
}

// OSMOLALITY_NOTE was written, exported and unit-tested but never rendered —
// nothing imported it, so tests/cost.test.js was asserting the wording of a
// string that was never on screen. It's the mechanism behind half the
// limitations in the cost grid (and the answer to "why not just table
// sugar"), so it belongs under them. It states figures on the page, so it
// carries a Source anchor like every other numeric claim here.
//
// Built as nodes rather than innerHTML, and the id is used directly rather
// than read back off findResearch() — a missing entry would otherwise throw
// mid-init and leave every panel below it blank, which is the failure this
// repo already has a dom-contract test for. A bad id now degrades to a dead
// anchor, which the test catches loudly instead.
function initOsmolalityNote() {
  const el = $('osmolality-note');
  const link = document.createElement('a');
  link.href = `#ref-${OSMOLALITY_SOURCE_ID}`;
  link.textContent = 'Source';
  el.replaceChildren(`${OSMOLALITY_NOTE} `, link);
}

function initResearch() {
  // A bibliography, not a card grid — the title is the link, so there's no
  // separate call-to-action line, and the role reads as the heading.
  $('research-grid').innerHTML = RESEARCH.map((r) => `
    <div class="reference" id="ref-${r.id}">
      <p class="reference__role">${r.role}</p>
      <p class="reference__title">
        <a href="${r.url}" target="_blank" rel="noopener">${r.name}</a>
        <span class="reference__cite">${r.source}</span>
      </p>
      <p class="reference__note">${r.note}</p>
    </div>
  `).join('');
}

// Food labels list ingredients in descending order by weight, so derive the
// order from the batch rather than hardcoding it — changing the flavoring
// ratio or salt profile can genuinely reorder them.
// Names come from the base's own parts rather than a fixed map — a map keyed
// to maltodextrin and fructose renders `undefined` in the ingredients list for
// any other base, which on a printed nutrition label is not a cosmetic bug.
function ingredientList(recipe, base) {
  const names = {
    ...Object.fromEntries(base.parts.map((p) => [p.key, p.name])),
    flavoring: recipe.flavorName,
    salt: 'Sodium citrate',
  };
  return Object.entries(recipe.recipeGrams)
    .filter(([, grams]) => grams > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => names[key])
    .join(', ');
}

function renderLabel(recipe, serving, targetCarbs, base) {
  $('lb-name').textContent = $('in-label-name').value || 'The Sauce';
  $('lb-flavor').textContent = $('in-label-flavor').value;
  $('lb-maker').textContent = $('in-label-maker').value;
  $('lb-serving').textContent = `${formatGrams(serving.grams)} (1 hr)`;
  $('lb-servings').textContent = `${formatCount(serving.servingsPerBatch, 0)} hr`;
  $('lb-calories').textContent = formatCalories(serving.perServing.calories);
  $('lb-carbs').textContent = formatGrams(serving.perServing.carbsG);
  $('lb-sugars').textContent = formatGrams(serving.perServing.sugarsG);
  $('lb-sodium').textContent = formatMg(serving.perServing.sodiumMg);
  $('lb-directions').textContent = serving.scoops !== null
    ? `One serving = one hour at ${targetCarbs} g carbs/hr, about ${formatCount(serving.scoops, 1)} scoops. Add powder to water.`
    : `One serving = one hour at ${targetCarbs} g carbs/hr. Add powder to water.`;
  $('lb-ingredients').textContent = ingredientList(recipe, base);

  const note = $('in-label-note').value.trim();
  const noteEl = $('lb-note');
  noteEl.textContent = note;
  noteEl.hidden = note === '';

  const date = $('in-label-date').value;
  $('lb-batch').textContent = date ? `BATCH ${date.replace(/-/g, '')}` : '';
}

// Artwork is read with FileReader and rendered from a data URL, so the image
// never leaves the browser — there is no upload and no server to upload to.
// Still worth bounding: a huge file turns into a huge base64 string and makes
// the page sluggish, and the accept="" attribute alone is trivially bypassed.
const MAX_ART_BYTES = 2 * 1024 * 1024;
const ALLOWED_ART_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function loadArtwork(file) {
  const status = $('art-status');
  const wrap = $('lb-art-wrap');

  if (!file) {
    wrap.hidden = true;
    $('lb-art').removeAttribute('src');
    status.textContent = 'Stays in your browser — never uploaded.';
    return;
  }

  if (!ALLOWED_ART_TYPES.includes(file.type)) {
    status.textContent = 'That file type is not supported — use PNG, JPEG, WebP, or GIF.';
    wrap.hidden = true;
    return;
  }

  if (file.size > MAX_ART_BYTES) {
    status.textContent = `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — keep it under 2 MB.`;
    wrap.hidden = true;
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    $('lb-art').src = reader.result;
    wrap.hidden = false;
    status.textContent = `${file.name} — stays in your browser.`;
  };
  reader.onerror = () => {
    status.textContent = 'Could not read that file.';
    wrap.hidden = true;
  };
  reader.readAsDataURL(file);
}

// The sheet is sized in inches so the preview matches the printer; the wide
// format also rearranges into two columns.
function applyLabelSize() {
  const size = findLabelSize($('in-label-size').value);
  const sheet = $('label-sheet');
  sheet.style.width = `${size.widthIn}in`;
  sheet.style.height = `${size.heightIn}in`;
  sheet.classList.toggle('label-sheet--wide', size.wide);
  $('label-size-note').textContent = size.wide
    ? 'Prints landscape on one sheet. Brand on the left, facts on the right.'
    : `Prints at ${size.widthIn} × ${size.heightIn} in.`;
  fitLabelPreview();
}

// A wrap-the-tub sheet is 11in wide — on a phone the 1:1 preview shows a
// sliver and a tall column of blank stage. Scale it down to fit instead.
// `zoom` rather than `transform` because it shrinks the layout box too, so
// the stage doesn't keep the full-size height. Print is unaffected: the print
// stylesheet resets it, so the sheet still comes out at true size.
function fitLabelPreview() {
  const stage = document.querySelector('.label-stage');
  const sheet = $('label-sheet');
  if (!stage) return;
  sheet.style.zoom = '';
  const room = stage.clientWidth - 2 * parseFloat(getComputedStyle(stage).paddingLeft);
  const natural = sheet.getBoundingClientRect().width;
  if (natural > room && room > 0) sheet.style.zoom = room / natural;
}

// Captured once, before any click can overwrite #download-label-status with
// "Rendering…" or an error — reading it fresh inside downloadLabelPng()
// itself would, on a second attempt after a failure, capture the leftover
// error text as if it were the default and never recover from it.
let downloadStatusDefault = '';

function initLabel() {
  $('in-label-size').innerHTML = LABEL_SIZES
    .map((x) => `<option value="${x.id}">${x.label}</option>`).join('');
  $('in-label-size').value = '3x4';
  $('in-label-size').addEventListener('change', () => { applyLabelSize(); recalculate(); });
  applyLabelSize();
  downloadStatusDefault = $('download-label-status').textContent;

  const dateInput = $('in-label-date');
  if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);

  // in-scoop belongs here too. It sits in this panel rather than the
  // calculator because the directions line is its only consumer, which also
  // puts it outside #calc-form and so outside that form's input listener —
  // without this, changing your scoop size left the printed directions
  // quoting the old one until some unrelated input forced a re-render.
  ['in-label-name', 'in-label-flavor', 'in-label-maker', 'in-label-date',
    'in-label-note', 'in-scoop']
    .forEach((id) => $(id).addEventListener('input', recalculate));

  $('in-label-art').addEventListener('change', (e) => loadArtwork(e.target.files[0]));

  // A collapsed <details> gives its children zero width, so the fit can only
  // be measured once the panel is actually open — and again if the viewport
  // changes underneath it.
  document.getElementById('label').addEventListener('toggle', fitLabelPreview);
  window.addEventListener('resize', fitLabelPreview);

  $('print-label-btn').addEventListener('click', () => {
    const title = document.title;
    document.title = `${$('in-label-name').value || 'The Sauce'} label`;
    window.print();
    document.title = title;
  });

  $('download-label-btn').addEventListener('click', downloadLabelPng);
}

async function downloadLabelPng() {
  const btn = $('download-label-btn');
  const status = $('download-label-status');
  btn.disabled = true;
  status.textContent = 'Rendering…';
  try {
    const blob = await exportLabelPng();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = labelFileName($('in-label-name').value);
    // Historically, Firefox only honored the download attribute on an
    // anchor that's actually in the document — Chrome never required it,
    // but appending (and removing right after) costs nothing here.
    document.body.appendChild(a);
    try {
      a.click();
    } finally {
      // In finally, not just after click(): a throwing click() (unlikely,
      // but nothing stops a browser extension or a test double from doing
      // it) would otherwise leave the anchor stuck in the document and the
      // object URL never revoked.
      a.remove();
      // Deferred rather than revoked synchronously: a download triggered by
      // an object URL isn't guaranteed to have actually started reading the
      // blob by the time click() returns in every browser.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    status.textContent = downloadStatusDefault;
  } catch (err) {
    // Nothing here touches the network — rendering is canvas-only, off the
    // already-loaded page — so a failure here is a real bug, not an
    // offline/blocked-request case. Say so rather than leaving "Rendering…"
    // stuck, and surface the actual message for a bug report. err is
    // whatever exportLabelPng() rejected with, not necessarily an Error.
    status.textContent = `Couldn't render the PNG — ${err && err.message ? err.message : err}`;
  } finally {
    btn.disabled = false;
  }
}

// A link into a collapsed section has to open it, or it scrolls to a closed
// summary and looks broken. Covers both in-page clicks and inbound URLs.
function openTargetedPanel() {
  const id = location.hash.slice(1);
  if (!id) return;
  const el = document.getElementById(id);
  const panel = el && el.closest('details');
  if (panel && !panel.open) {
    panel.open = true;
    el.scrollIntoView({ block: 'start' });
  }
}

// Recalculate and persist together, so every listener that changes the
// batch keeps the saved copy in sync rather than needing its own hook.
function handleCalcFormChange() {
  recalculate();
  saveCalcFormState();
}

function init() {
  initFlavorPresets();
  initSaltProfiles();
  initCarbBases();
  initTuning();
  initProducts();
  initResearch();
  initOsmolalityNote();
  initLabel();

  // Must run after initFlavorPresets()/initSaltProfiles()/initCarbBases()
  // set every select's options, and before the first recalculate() reads the
  // form — otherwise a saved flavoring, salt profile or carb base would be
  // overwritten by the select's own default.
  restoreCalcFormState();

  // in-target-carbs needs no listener of its own: it's a plain number input
  // inside #calc-form, already covered by the form-level 'input' listener
  // below via bubbling.
  document.getElementById('calc-form').addEventListener('input', handleCalcFormChange);
  // Selects need an explicit change listener. The form's 'input' listener
  // happens to cover them in current browsers, but relying on that made the
  // salt level silently not recalculate when driven programmatically.
  ['in-flavor-preset', 'in-salt-profile', 'in-carb-base'].forEach((id) =>
    $(id).addEventListener('change', handleCalcFormChange));

  recalculate();
  initRidePlanner();
  initDisclosureAnimation();
  openTargetedPanel();
  window.addEventListener('hashchange', openTargetedPanel);
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (link) setTimeout(openTargetedPanel, 0);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
