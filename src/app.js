import { computeRecipe } from './calculator.js';
import { hourlyTotals, recommendScoopsPerHour } from './hourly.js';
import { formatGrams, formatMg, formatCalories, formatCount } from './format.js';
import { FLAVORINGS, findFlavoring } from '../data/flavorings.js';
import { PRODUCTS } from '../data/products.js';
import { RESEARCH } from '../data/research.js';

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

function renderHourlyGrid(recipe) {
  const grid = $('hourly-grid');
  const targetCarbs = Number($('in-target-carbs').value) || 75;
  const recommended = recommendScoopsPerHour(recipe.perScoop, targetCarbs);

  const cards = [
    {
      eyebrow: 'Recommended',
      value: `${formatCount(recommended.scoopsPerHour, 1)} scoops/hr`,
      lines: [
        `${formatGrams(recommended.carbsG)} carbs/hr <span class="${statusPillClass(recommended.carbStatus)}">${recommended.carbStatus}</span>`,
        `${formatMg(recommended.sodiumMg)} sodium/hr <span class="${statusPillClass(recommended.sodiumStatus)}">${recommended.sodiumStatus}</span>`,
      ],
      active: true,
    },
    ...[2, 3].map((n) => {
      const t = hourlyTotals(recipe.perScoop, n);
      return {
        eyebrow: `${n} scoops/hr`,
        value: `${formatGrams(t.carbsG)} carbs`,
        lines: [`${formatMg(t.sodiumMg)} sodium/hr`, `${formatCalories(t.calories)} cal/hr`],
      };
    }),
  ];

  grid.innerHTML = cards.map((c) => `
    <div class="card${c.active ? ' card--active' : ''}">
      <p class="card__eyebrow">${c.eyebrow}</p>
      <p class="card__value data">${c.value}</p>
      ${c.lines.map((l) => `<p class="field-hint">${l}</p>`).join('')}
    </div>
  `).join('');
}

function recalculate() {
  const recipe = computeRecipe(readInputs());
  renderFactsPanel(recipe);
  renderRecipeGrid(recipe);
  renderHourlyGrid(recipe);
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

function initLabelPrint() {
  $('print-label-btn').addEventListener('click', () => {
    const title = document.title;
    document.title = `${$('in-label-name').value || 'The Sauce'} — Nutrition Label`;
    window.print();
    document.title = title;
  });
  const dateInput = $('in-label-date');
  if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
}

function init() {
  initFlavorPresets();
  initProducts();
  initResearch();
  initLabelPrint();

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
