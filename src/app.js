import { computeRecipe } from './calculator.js';
import { planForCarbTarget, CARB_TARGET_RANGE } from './hourly.js';
import { formatGrams, formatMg, formatCalories, formatCount } from './format.js';
import { FLAVORINGS, findFlavoring } from '../data/flavorings.js';
import { RECIPES, findRecipe } from '../data/recipes.js';
import { TUNING } from '../data/tuning.js';
import { PRODUCTS } from '../data/products.js';
import { RESEARCH } from '../data/research.js';
import { encodeFormulation, decodeFormulation, hasFormulation, DEFAULT_TARGET_CARBS } from './share.js';

const $ = (id) => document.getElementById(id);

function readInputs() {
  const flavor = findFlavoring($('in-flavor-preset').value) ?? FLAVORINGS[0];
  const capRaw = $('in-cap').value;
  return {
    onHand: {
      maltodextrin: Number($('in-malto').value) || 0,
      fructose: Number($('in-fructose').value) || 0,
      flavoring: Number($('in-flavoring').value) || 0,
      salt: Number($('in-salt').value) || 0,
    },
    saltProfile: $('in-salt-profile').value,
    scoopGrams: Number($('in-scoop').value) || 1,
    carbRatio: Number($('in-carb-ratio').value) || 0,
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

function renderFactsPanel(recipe) {
  $('fp-batch').textContent = formatGrams(recipe.actualBatch);
  $('fp-servings').textContent = formatCount(recipe.totalScoops, 1);
  $('fp-calories').textContent = formatCalories(recipe.perScoop.calories);
  $('fp-carbs').textContent = formatGrams(recipe.perScoop.carbsG);
  $('fp-sugars').textContent = formatGrams(recipe.perScoop.sugarsG);
  $('fp-sodium').textContent = formatMg(recipe.perScoop.sodiumMg);
  $('fp-flavor-name').textContent = recipe.flavorName;
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

  const limitLabel = LIMITING_LABELS[recipe.limiting] ?? recipe.limiting;
  $('calc-limiting').textContent = recipe.limiting === 'cap'
    ? `Batch capped at ${formatGrams(recipe.actualBatch)} by your max batch size — you have more of every ingredient than this batch needs.`
    : `${limitLabel} is the limiting ingredient — everything else is scaled to match it.`;
}

function statusPillClass(status) {
  return `status-pill status-pill--${status}`;
}

// Grams of mix per hour is the headline number — it's the same for everyone.
// The scoop equivalent is shown underneath as a convenience, clearly tied to
// the scoop size the user measured rather than an assumed one.
function renderHourlyGrid(recipe) {
  const grid = $('hourly-grid');
  const scoopGrams = Number($('in-scoop').value) || 0;
  const targetCarbs = Number($('in-target-carbs').value) || DEFAULT_TARGET_CARBS;

  // The user's target, bracketed by the research range so they can see where
  // it sits rather than just being told "in-range".
  const targets = [...new Set([CARB_TARGET_RANGE.min, targetCarbs, CARB_TARGET_RANGE.max])]
    .sort((a, b) => a - b);

  grid.innerHTML = targets.map((t) => {
    const plan = planForCarbTarget(recipe.perGram, scoopGrams, t);
    const isTarget = t === targetCarbs;
    const scoopNote = plan.scoopsPerHour !== null
      ? `≈ ${formatCount(plan.scoopsPerHour, 1)} of your ${formatCount(scoopGrams, 0)} g scoops`
      : 'Enter your scoop size for a scoop count';

    return `
      <div class="card${isTarget ? ' card--active' : ''}">
        <p class="card__eyebrow">${isTarget ? 'Your target' : 'Reference'} · ${t} g carbs/hr</p>
        <p class="card__value data">${formatGrams(plan.mixGramsPerHour)}<span class="card__unit"> of mix/hr</span></p>
        <p class="field-hint">${scoopNote}</p>
        <p class="field-hint">${formatMg(plan.sodiumMg)} sodium/hr <span class="${statusPillClass(plan.sodiumStatus)}">${plan.sodiumStatus}</span></p>
        <p class="field-hint">${formatCalories(plan.calories)} cal/hr</p>
      </div>
    `;
  }).join('');
}

// Express the fructose ratio the way the research talks about it, as
// glucose:fructose — maltodextrin digests to glucose, so 0.5 is the classic
// 2:1 and 0.8 is the ~1.25:1 used by modern high-carb products.
function renderRatioReadout() {
  const ratio = Number($('in-carb-ratio').value) || 0;
  const readout = $('ratio-readout');
  if (ratio <= 0) {
    readout.textContent = 'Glucose only — no fructose';
    return;
  }
  readout.textContent = `${(1 / ratio).toFixed(2)}:1 glucose:fructose`;
}

function recalculate() {
  const recipe = computeRecipe(readInputs());
  renderRatioReadout();
  renderFactsPanel(recipe);
  renderRecipeGrid(recipe);
  renderHourlyGrid(recipe);
  renderLabel(recipe);
}

// Applying a recipe sets the formulation only. Pantry amounts and scoop size
// are the user's kitchen, not the recipe's business, so they survive.
function applyRecipe(id) {
  const preset = findRecipe(id);
  if (!preset) return;
  applyFormulation(preset);
  document.querySelectorAll('.recipe-card').forEach((el) => {
    el.classList.toggle('card--active', el.dataset.recipeId === id);
  });
  recalculate();
}

function currentFormulation() {
  return {
    carbRatio: Number($('in-carb-ratio').value) || 0,
    saltProfile: $('in-salt-profile').value,
    flavoringId: $('in-flavor-preset').value,
    targetCarbsPerHour: Number($('in-target-carbs').value) || DEFAULT_TARGET_CARBS,
  };
}

// Apply a formulation to the form. Used by both recipe presets and inbound
// share links; the values are already validated by the time they arrive here.
function applyFormulation({ carbRatio, saltProfile, flavoringId, targetCarbsPerHour }) {
  $('in-carb-ratio').value = carbRatio;
  $('in-salt-profile').value = saltProfile;
  $('in-flavor-preset').value = flavoringId;
  $('in-target-carbs').value = targetCarbsPerHour;
}

function initShare() {
  $('share-btn').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?${encodeFormulation(currentFormulation(), RECIPES)}`;
    const status = $('share-status');
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = 'Link copied.';
    } catch {
      // Clipboard access can be denied or unavailable; put the URL in the bar
      // so it is still copyable by hand rather than failing silently.
      history.replaceState(null, '', url);
      status.textContent = 'Copy the URL from your address bar.';
    }
  });
}

// A shared link should land on the recipe it describes, not the default one.
function applyIncomingShareLink() {
  if (!hasFormulation(location.search)) return;
  applyFormulation(decodeFormulation(location.search, RECIPES));
  $('share-status').textContent = 'Loaded from a shared link.';
}

function initRecipes() {
  $('recipes-grid').innerHTML = RECIPES.map((r) => `
    <button type="button" class="card recipe-card" data-recipe-id="${r.id}">
      <span class="card__eyebrow">${r.tagline}${r.confidence === 'tested' ? ' · tested' : ''}</span>
      <span class="recipe-card__name">${r.name}</span>
      <span class="recipe-card__specs data">${r.carbRatio > 0 ? `${(1 / r.carbRatio).toFixed(2)}:1` : 'glucose only'} · ${r.saltProfile} salt · ${r.targetCarbsPerHour} g/hr</span>
      <span class="recipe-card__best">${r.bestFor}</span>
      <span class="recipe-card__why">${r.why}</span>
    </button>
  `).join('');

  $('recipes-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.recipe-card');
    if (card) applyRecipe(card.dataset.recipeId);
  });
}

function initTuning() {
  $('tuning-list').innerHTML = TUNING.map((t) => `
    <details class="tuning-item" id="tune-${t.id}">
      <summary>
        ${t.tag ? `<span class="tuning-item__tag">${t.tag}</span>` : ''}
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
  select.innerHTML = FLAVORINGS.map((f) => `<option value="${f.id}">${f.name}</option>`).join('');
  select.value = 'strawberry';
}

function initProducts() {
  $('products-grid').innerHTML = PRODUCTS.map((p) => `
    <div class="card product-card">
      ${p.placeholder ? '<span class="todo-badge">Placeholder link</span>' : ''}
      <p class="product-card__name">${p.name}</p>
      <p class="product-card__note">${p.note}</p>
      <a class="btn btn--outline" href="${p.url}" target="_blank" rel="noopener sponsored">Shop on Amazon</a>
    </div>
  `).join('');
}

function initResearch() {
  $('research-grid').innerHTML = RESEARCH.map((r) => `
    <div class="card research-card">
      <p class="research-card__name">${r.name}</p>
      <p class="field-hint">${r.source}</p>
      <p class="research-card__note">${r.note}</p>
      <a href="${r.url}" target="_blank" rel="noopener">Read more →</a>
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

function renderLabel(recipe) {
  const scoopGrams = Number($('in-scoop').value) || 0;
  $('lb-name').textContent = $('in-label-name').value || 'The Sauce';
  $('lb-flavor').textContent = $('in-label-flavor').value;
  $('lb-maker').textContent = $('in-label-maker').value;
  $('lb-serving').textContent = `${formatCount(scoopGrams, 0)} g (1 scoop)`;
  $('lb-servings').textContent = formatCount(recipe.totalScoops, 0);
  $('lb-calories').textContent = formatCalories(recipe.perScoop.calories);
  $('lb-carbs').textContent = formatGrams(recipe.perScoop.carbsG);
  $('lb-sugars').textContent = formatGrams(recipe.perScoop.sugarsG);
  $('lb-sodium').textContent = formatMg(recipe.perScoop.sodiumMg);
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

function initLabel() {
  const dateInput = $('in-label-date');
  if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);

  ['in-label-name', 'in-label-flavor', 'in-label-maker', 'in-label-date', 'in-label-note']
    .forEach((id) => $(id).addEventListener('input', recalculate));

  $('in-label-art').addEventListener('change', (e) => loadArtwork(e.target.files[0]));

  $('print-label-btn').addEventListener('click', () => {
    const title = document.title;
    document.title = `${$('in-label-name').value || 'The Sauce'} label`;
    window.print();
    document.title = title;
  });
}

function init() {
  initFlavorPresets();
  initRecipes();
  initShare();
  initTuning();
  initProducts();
  initResearch();
  initLabel();
  applyIncomingShareLink();

  document.getElementById('calc-form').addEventListener('input', recalculate);
  $('in-flavor-preset').addEventListener('change', recalculate);
  $('in-target-carbs').addEventListener('input', recalculate);

  recalculate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
