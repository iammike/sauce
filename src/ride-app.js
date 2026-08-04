// Wiring for the day-of planner. Exported rather than self-starting so it can
// live alongside the batch calculator on the same page.
import { INTENSITIES, WEATHER, BOTTLE_SIZES, findIntensity, findWeather, findBottle, planRide } from './ride.js';
import { formatGrams, formatMg, formatCount } from './format.js';

const $ = (id) => document.getElementById(id);

function readInputs() {
  return {
    durationHours: Number($('in-duration').value) || 0,
    intensityId: $('in-intensity').value,
    weatherId: $('in-weather').value,
    bottleMl: findBottle($('in-bottle').value)?.ml ?? 750,
  };
}

// Half-capsule counts read badly as decimals ("1.0 an electrolyte capsule").
function capsulePhrase(count) {
  if (count <= 0.5) return 'half an electrolyte capsule';
  if (count === 1) return 'one electrolyte capsule';
  if (count === 1.5) return 'a capsule and a half';
  return `${formatCount(count, count % 1 === 0 ? 0 : 1)} electrolyte capsules`;
}

function render() {
  const inputs = readInputs();
  const answer = $('ride-answer');

  $('intensity-note').textContent = findIntensity(inputs.intensityId)?.note ?? '';
  $('weather-note').textContent = findWeather(inputs.weatherId)?.note ?? '';

  if (!(inputs.durationHours > 0)) {
    answer.innerHTML = '<p class="field-hint">Enter how long you\'ll be out.</p>';
    $('ride-caveat').textContent = '';
    return;
  }

  const plan = planRide(inputs);

  if (plan.nothingNeeded) {
    answer.innerHTML = `
      <div class="ride-answer__headline">
        <p class="ride-answer__value data">Water</p>
        <p class="ride-answer__label">is fine for this one</p>
      </div>
      <p class="ride-answer__detail">Under an hour at an easy pace, there's little to gain from fuelling. Take a bottle of water and don't think about it.</p>`;
    $('ride-caveat').textContent = '';
    return;
  }

  const salt = plan.extraSodiumPerHour > 0
    ? `<p class="ride-answer__detail"><strong>Add salt.</strong> These conditions call for roughly ${formatMg(plan.extraSodiumPerHour)}/hr more sodium than the mix carries — about ${capsulePhrase(plan.capsulesPerHour)} an hour, or a pinch of salt in the bottle.</p>`
    : `<p class="ride-answer__detail"><strong>No extra salt needed.</strong> The mix carries enough sodium for these conditions on its own.</p>`;

  // Concentration is the usual reason a drink won't go down, so it gets said
  // out loud rather than left as an exercise in division.
  const bottles = `<p class="ride-answer__detail"><strong>Per bottle:</strong> about ${formatGrams(plan.gramsPerBottle)} in each ${plan.bottleMl} ml bottle — roughly ${formatCount(plan.bottlesNeeded, 1)} bottles across the ride, assuming you drink enough to keep up with sweat.</p>`;

  const strength = plan.concentration.id === 'dilute' || plan.concentration.id === 'typical'
    ? `<p class="ride-answer__detail"><strong>${plan.concentration.label}</strong> at ${plan.concentrationPercent.toFixed(0)}%. ${plan.concentration.note}</p>`
    : `<p class="ride-answer__detail"><span class="warn">${plan.concentration.label}</span> at ${plan.concentrationPercent.toFixed(0)}%. ${plan.concentration.note}</p>`;

  const gut = plan.needsTrainedGut
    ? `<p class="ride-answer__detail"><span class="warn">That's a high carb rate.</span> Fine if you've practised it, but don't try ${plan.carbsPerHour} g/hr for the first time on a ride that matters.</p>`
    : '';

  answer.innerHTML = `
    <div class="ride-answer__headline">
      <p class="ride-answer__value data">${formatGrams(plan.totalMixGrams)}</p>
      <p class="ride-answer__label">of mix, total</p>
    </div>
    <p class="ride-answer__detail">That's <strong>${formatGrams(plan.mixGramsPerHour)} an hour</strong>, giving you ${plan.carbsPerHour} g of carbs per hour and ${plan.totalCarbs} g across the ride.</p>
    ${bottles}
    ${strength}
    ${salt}
    ${gut}`;

  $('ride-caveat').textContent = 'Rough numbers, on purpose, and they only hold if you actually finish what you carry — an unfinished bottle is the most common reason a fuelling plan quietly does not work. Assumes the standard mix and average sweat.';
}

export function initRidePlanner() {
  if (!$('ride-form')) return;
  $('in-intensity').innerHTML = INTENSITIES
    .map((i) => `<option value="${i.id}">${i.label}</option>`).join('');
  $('in-intensity').value = 'moderate';

  $('in-weather').innerHTML = WEATHER
    .map((w) => `<option value="${w.id}">${w.label}</option>`).join('');
  $('in-weather').value = 'mild';

  $('in-bottle').innerHTML = BOTTLE_SIZES
    .map((b) => `<option value="${b.id}">${b.label}</option>`).join('');
  $('in-bottle').value = '750';

  $('ride-form').addEventListener('input', render);
  ['in-intensity', 'in-weather', 'in-bottle'].forEach((id) =>
    $(id).addEventListener('change', render));

  render();
}
