import { computeRecipe } from './calculator.js';
import { planForCarbTarget, CARB_INTAKE_TIERS, absorptionCeiling, tierFor, ratioStatus,
  GLUCOSE_ONLY_CEILING, DUAL_TRANSPORT_TYPICAL, DUAL_TRANSPORT_TRAINED,
  FRUCTOSE_RATIO_OPTIMAL, DEFAULT_TARGET_CARBS, sodiumStatus } from './hourly.js';
import { formatGrams, formatMg, formatCalories, formatCount } from './format.js';
import { FLAVORINGS, findFlavoring } from '../data/flavorings.js';
import { TUNING } from '../data/tuning.js';
import { PRODUCTS } from '../data/products.js';
import { RESEARCH, findResearch } from '../data/research.js';
import { batchCost, costPerGramCarb, compareAtCarbTarget } from './cost.js';
import {
  SWEAT_RATES, SWEAT_SODIUM_LEVELS, MAX_PRACTICAL_SALT_RATIO,
  estimateSodiumNeed, solveSaltRatio, findSweatSodium,
} from './sodium.js';
import { PRICED_AS_OF, INGREDIENT_COSTS, HOMEMADE_LIMITATION } from '../data/costs.js';

const $ = (id) => document.getElementById(id);

// The formulation follows from the targets, not the other way round: when the
// salt level is "solved", the salt ratio is whatever delivers the estimated
// sodium need at the carb intake actually being fuelled at.
function resolveSalt(carbRatio, flavor) {
  const mode = $('in-salt-profile').value;
  const targetCarbs = Number($('in-target-carbs').value) || DEFAULT_TARGET_CARBS;
  const estimate = estimateSodiumNeed({
    sweatRateId: $('in-sweat-rate').value,
    sweatSodiumId: $('in-sweat-sodium').value,
  });

  if (mode !== 'solved') {
    return { mode, estimate, saltRatio: undefined, saltProfile: mode, solved: null };
  }

  const solved = solveSaltRatio({
    targetSodiumPerHour: estimate.targetMgPerHour,
    targetCarbsPerHour: targetCarbs,
    carbRatio,
    flavorRatio: flavor.ratio,
    flavorCarbFraction: flavor.carbFraction,
  });

  // Cap at the drinkable limit rather than emitting a mix nobody would
  // finish; the shortfall is reported instead.
  const saltRatio = solved
    ? Math.min(solved.ratio, MAX_PRACTICAL_SALT_RATIO)
    : undefined;

  return { mode, estimate, saltRatio, saltProfile: 'endurance', solved };
}

function readInputs() {
  const flavor = findFlavoring($('in-flavor-preset').value) ?? FLAVORINGS[0];
  const capRaw = $('in-cap').value;
  const carbRatio = Number($('in-carb-ratio').value) || 0;
  const salt = resolveSalt(carbRatio, flavor);
  return {
    salt,
    onHand: {
      maltodextrin: Number($('in-malto').value) || 0,
      fructose: Number($('in-fructose').value) || 0,
      flavoring: Number($('in-flavoring').value) || 0,
      salt: Number($('in-salt').value) || 0,
    },
    saltProfile: salt.saltProfile,
    saltRatio: salt.saltRatio,
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
  $('fp-scoop-note').textContent = serving.scoops !== null
    ? `≈ ${formatCount(serving.scoops, 1)} of your scoops`
    : '';
}

const money = (v) => `$${v.toFixed(2)}`;

function renderCost(recipe, flavor, targetCarbs) {
  const cost = batchCost(recipe.recipeGrams, flavor.pricePerGram);
  const perGramCarb = costPerGramCarb(cost.total, recipe.totals.carbsG);
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

  $('cost-grid').innerHTML = rows.map((r) => `
    <div class="card${r.mine ? ' card--active' : ''}">
      <p class="card__eyebrow">${r.name}${r.confidence === 'estimated' ? ' · estimated' : ''}</p>
      <p class="card__value data">${money(r.perHour)}<span class="card__unit"> / hour</span></p>
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

  const carbRatio = Number($('in-carb-ratio').value) || 0;
  const ceiling = absorptionCeiling(carbRatio);
  const activeTier = tierFor(targetCarbs);

  // Only cite per-tier when the tiers actually come from different papers.
  // They don't today, and repeating one link four times is just noise — the
  // section intro already links it.
  const showTierSources =
    new Set(CARB_INTAKE_TIERS.map((t) => t.sourceId)).size > 1;

  grid.innerHTML = CARB_INTAKE_TIERS.map((tier) => {
    const plan = planForCarbTarget(recipe.perGram, scoopGrams, tier.gramsPerHour);
    const isActive = tier === activeTier;
    // Flag tiers this formulation can't actually deliver — with glucose only,
    // drinking more doesn't get you past the transporter limit.
    const unreachable = tier.gramsPerHour > ceiling;

    const scoopNote = plan.scoopsPerHour !== null
      ? `≈ ${formatCount(plan.scoopsPerHour, 1)} of your ${formatCount(scoopGrams, 0)} g scoops`
      : 'Enter your scoop size for a scoop count';

    return `
      <div class="card${isActive ? ' card--active' : ''}${unreachable ? ' card--muted' : ''}">
        <p class="card__eyebrow">${tier.duration}${isActive ? ' · your target' : ''}</p>
        <p class="card__value data">${tier.range[0]}–${tier.range[1]}<span class="card__unit"> g carbs/hr</span></p>
        <p class="field-hint"><strong>${formatGrams(plan.mixGramsPerHour)} of mix</strong> — ${scoopNote}</p>
        <p class="field-hint">${formatMg(plan.sodiumMg)} sodium/hr <span class="${statusPillClass(plan.sodiumStatus)}">${plan.sodiumStatus}</span> · ${formatCalories(plan.calories)} cal/hr</p>
        <p class="field-hint">${!unreachable ? tier.note
          : carbRatio > 0.05
            // Has fructose, but this tier is past what most people absorb.
            ? `<span class="warn">Above the ~${DUAL_TRANSPORT_TYPICAL} g/hr most people manage — needs gut training.</span>`
            // No fructose at all: a hard transporter limit, not a training one.
            : `<span class="warn">Not reachable without fructose — glucose alone tops out near ${GLUCOSE_ONLY_CEILING} g/hr.</span>`}</p>
        ${showTierSources && tier.sourceId
          ? `<p class="card__cite"><a href="#ref-${tier.sourceId}">${findResearch(tier.sourceId)?.role ?? 'Source'}</a></p>`
          : ''}
      </div>
    `;
  }).join('');

  const warning = $('hourly-warning');
  if (targetCarbs > ceiling) {
    warning.hidden = false;
    warning.textContent = carbRatio > 0.05
      ? `You're targeting ${targetCarbs} g/hr. Above ${DUAL_TRANSPORT_TRAINED} g/hr is experimental territory — people do fuel that high, but the efficacy evidence doesn't back it yet.`
      : `You're targeting ${targetCarbs} g/hr with no fructose in the mix. Glucose alone saturates its transporter near ${GLUCOSE_ONLY_CEILING} g/hr, so drinking more won't deliver more — raise the fructose ratio to go higher.`;
  } else {
    warning.hidden = true;
  }
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

// Only speak up when there's something to act on, and say it in numbers the
// reader can use. The solved salt percentage is already in the calculator and
// the sodium figure in the facts panel — restating the arithmetic is noise.
const MEANINGFUL_GAP = 0.1; // fraction of target worth mentioning

function renderSodiumSolve(inputs, recipe, targetCarbs) {
  const { estimate, mode } = inputs.salt;
  const advice = $('sodium-solve-detail');

  // What the mix actually delivers, whatever the reason — a capped solve and
  // a preset that doesn't suit the conditions leave you short the same way.
  const delivered = recipe.perGram.carbsG > 0
    ? (recipe.perGram.sodiumMg / recipe.perGram.carbsG) * targetCarbs
    : 0;
  const need = estimate.targetMgPerHour;
  const gap = need - delivered;

  $('sodium-estimate').textContent = mode === 'solved'
    ? `These conditions suggest about ${formatMg(need)} of sodium per hour, which the salt level above is set to deliver.`
    : `These conditions suggest about ${formatMg(need)} of sodium per hour.`;

  // A batch you've already mixed is fixed — conditions change ride to ride,
  // the jar doesn't. So the advice is what to add today, not how to
  // reformulate. Reformulating is only useful for the *next* batch.
  if (gap > need * MEANINGFUL_GAP) {
    advice.hidden = false;
    advice.innerHTML = `This mix carries <strong>${formatMg(delivered)}/hr</strong> of sodium. For these conditions, add roughly <strong>${formatMg(gap)}/hr</strong> on top — a salt tab or electrolyte capsule alongside your bottle.`;
    return;
  }

  if (delivered > need * (1 + MEANINGFUL_GAP)) {
    advice.hidden = false;
    advice.innerHTML = `This mix carries <strong>${formatMg(delivered)}/hr</strong> of sodium, more than these conditions call for. No harm in it, but nothing to add.`;
    return;
  }

  advice.hidden = true;
}

function renderSweatCue() {
  const level = findSweatSodium($('in-sweat-sodium').value);
  $('sweat-sodium-cue').textContent = level ? level.cue : '';
  const rate = SWEAT_RATES.find((r) => r.id === $('in-sweat-rate').value);
  $('sweat-rate-hint').textContent = rate ? `≈ ${rate.litresPerHour} L/hr of sweat` : '';
  $('salt-profile-note').textContent = $('in-salt-profile').value === 'solved'
    ? 'Solved from your conditions above.'
    : 'A fixed percentage. Set this to match a batch you already made.';
}

function initConditions() {
  $('in-sweat-rate').innerHTML = SWEAT_RATES
    .map((r) => `<option value="${r.id}">${r.label}</option>`).join('');
  $('in-sweat-rate').value = 'moderate';

  $('in-sweat-sodium').innerHTML = SWEAT_SODIUM_LEVELS
    .map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
  $('in-sweat-sodium').value = 'average';

  ['in-sweat-rate', 'in-sweat-sodium'].forEach((id) =>
    $(id).addEventListener('change', recalculate));
}

function recalculate() {
  const inputs = readInputs();
  const recipe = computeRecipe(inputs);
  const targetCarbs = Number($('in-target-carbs').value) || DEFAULT_TARGET_CARBS;
  const scoopGrams = Number($('in-scoop').value) || 0;
  const serving = servingFor(recipe, targetCarbs, scoopGrams);

  renderRatioReadout();
  renderSweatCue();
  renderSodiumSolve(inputs, recipe, targetCarbs);
  renderFactsPanel(recipe, serving, targetCarbs);
  renderRecipeGrid(recipe);
  renderHourlyGrid(recipe);
  renderLabel(recipe, serving, targetCarbs);
  renderCost(recipe, findFlavoring($('in-flavor-preset').value) ?? FLAVORINGS[0], targetCarbs);
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
  select.innerHTML = FLAVORINGS.map((f) => `<option value="${f.id}">${f.shortName ?? f.name}</option>`).join('');
  select.value = 'strawberry';
}

function initProducts() {
  $('products-grid').innerHTML = PRODUCTS.map((p) => `
    <div class="card product-card">
      <p class="product-card__name">${p.name}</p>
      <p class="product-card__note">${p.note}</p>
      <a class="btn btn--outline" href="${p.url}" target="_blank" rel="noopener sponsored">View on Amazon</a>
    </div>
  `).join('');
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
    ? `One serving is one hour of fueling at ${targetCarbs} g carbs/hr — about ${formatCount(serving.scoops, 1)} scoops. Add to water, not water to powder.`
    : `One serving is one hour of fueling at ${targetCarbs} g carbs/hr. Add to water, not water to powder.`;
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
  initConditions();
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
