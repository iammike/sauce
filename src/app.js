import { computeRecipe } from './calculator.js';
import { planForCarbTarget, ratioStatus, FRUCTOSE_RATIO_OPTIMAL,
  DEFAULT_TARGET_CARBS, sodiumStatus } from './hourly.js';
import { formatGrams, formatMg, formatCalories, formatCount } from './format.js';
import { FLAVORINGS, findFlavoring } from '../data/flavorings.js';
import { TUNING } from '../data/tuning.js';
import { PRODUCTS } from '../data/products.js';
import { RESEARCH, findResearch } from '../data/research.js';
import { batchCost, costPerGramCarb, compareAtCarbTarget } from './cost.js';
import { PRICED_AS_OF, INGREDIENT_COSTS, HOMEMADE_LIMITATION } from '../data/costs.js';
import { SALT_PROFILES } from './calculator.js';
import { initDisclosureAnimation } from './disclosure.js';
import { initRidePlanner, updateRidePlanner } from './ride-app.js';
import { LABEL_SIZES, findLabelSize } from '../data/label-sizes.js';

const $ = (id) => document.getElementById(id);

function readInputs() {
  const flavor = findFlavoring($('in-flavor-preset').value) ?? FLAVORINGS[0];
  const capRaw = $('in-cap').value;
  const carbRatio = Number($('in-carb-ratio').value) || 0;
  return {
    onHand: {
      maltodextrin: Number($('in-malto').value) || 0,
      fructose: Number($('in-fructose').value) || 0,
      flavoring: Number($('in-flavoring').value) || 0,
      salt: Number($('in-salt').value) || 0,
    },
    saltProfile: $('in-salt-profile').value,
    scoopGrams: Number($('in-scoop').value) || 1,
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

function renderCost(recipe, flavor, targetCarbs) {
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
      name: 'The Sauce', perHour: mine, mine: true, confidence: 'actual',
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
    maltodextrin: 'Maltodextrin', fructose: 'Fructose',
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

  $('cost-note').textContent = `Ingredient prices as of ${PRICED_AS_OF} (${INGREDIENT_COSTS.maltodextrin.basis}, ${INGREDIENT_COSTS.fructose.basis}, ${INGREDIENT_COSTS.salt.basis}, flavoring ${flavor.priceBasis}). Prices move — treat these as ballpark, not quotes.`;
}

function renderRecipeGrid(recipe) {
  const grid = $('recipe-grid');
  const rows = [
    ['maltodextrin', 'Maltodextrin'],
    ['fructose', 'Fructose'],
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

  const flavor = findFlavoring($('in-flavor-preset').value);
  const perBottleNote = $('flavor-per-bottle');
  if (flavor?.perBottle) {
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

// Express the fructose ratio the way the research talks about it, as
// glucose:fructose — maltodextrin digests to glucose, so 0.5 is the classic
// 2:1 and 0.8 is the ~1.25:1 used by modern high-carb products.
function renderRatioReadout() {
  const ratio = Number($('in-carb-ratio').value) || 0;
  const readout = $('ratio-readout');
  const status = ratioStatus(ratio);

  if (status === 'none') {
    readout.innerHTML = '<span class="warn">Glucose only — caps you near 60 g/hr</span>';
    return;
  }

  const shape = `${(1 / ratio).toFixed(2)}:1 glucose:fructose`;
  const verdict = {
    optimal: '<span class="ok">in the optimal band</span>',
    below: `below the optimal ${FRUCTOSE_RATIO_OPTIMAL.min}–${FRUCTOSE_RATIO_OPTIMAL.max}`,
    above: `above the optimal ${FRUCTOSE_RATIO_OPTIMAL.min}–${FRUCTOSE_RATIO_OPTIMAL.max}`,
  }[status];
  readout.innerHTML = `${shape} — ${verdict}`;
}

// A batch is mixed in advance and can't know Saturday's weather. Salt level is
// a general choice here; reading conditions on the day — including whether to
// take extra salt — is what the bottle planner is for.
function renderSaltNote() {
  const profile = SALT_PROFILES[$('in-salt-profile').value];
  $('salt-profile-note').textContent = profile
    ? `${profile.note} Adjust for conditions on the day, not in the jar.`
    : '';
}

function recalculate() {
  const inputs = readInputs();
  const recipe = computeRecipe(inputs);
  const targetCarbs = Number($('in-target-carbs').value) || DEFAULT_TARGET_CARBS;
  const scoopGrams = Number($('in-scoop').value) || 0;
  const serving = servingFor(recipe, targetCarbs, scoopGrams);

  renderRatioReadout();
  renderSaltNote();
  renderFactsPanel(recipe, serving, targetCarbs);
  renderRecipeGrid(recipe);
  renderLabel(recipe, serving, targetCarbs);
  renderCost(recipe, findFlavoring($('in-flavor-preset').value) ?? FLAVORINGS[0], targetCarbs);
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
  select.value = 'strawberry';
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
function ingredientList(recipe) {
  const names = {
    maltodextrin: 'Maltodextrin',
    fructose: 'Fructose',
    flavoring: recipe.flavorName,
    salt: 'Sodium citrate',
  };
  return Object.entries(recipe.recipeGrams)
    .filter(([, grams]) => grams > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => names[key])
    .join(', ');
}

function renderLabel(recipe, serving, targetCarbs) {
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
  $('lb-ingredients').textContent = ingredientList(recipe);

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

function initLabel() {
  $('in-label-size').innerHTML = LABEL_SIZES
    .map((x) => `<option value="${x.id}">${x.label}</option>`).join('');
  $('in-label-size').value = '3x4';
  $('in-label-size').addEventListener('change', () => { applyLabelSize(); recalculate(); });
  applyLabelSize();

  const dateInput = $('in-label-date');
  if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);

  ['in-label-name', 'in-label-flavor', 'in-label-maker', 'in-label-date', 'in-label-note']
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

function init() {
  initFlavorPresets();
  initTuning();
  initProducts();
  initResearch();
  initLabel();

  document.getElementById('calc-form').addEventListener('input', recalculate);
  // Selects need an explicit change listener. The form's 'input' listener
  // happens to cover them in current browsers, but relying on that made the
  // salt level silently not recalculate when driven programmatically.
  ['in-flavor-preset', 'in-salt-profile'].forEach((id) =>
    $(id).addEventListener('change', recalculate));
  $('in-target-carbs').addEventListener('input', recalculate);

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
