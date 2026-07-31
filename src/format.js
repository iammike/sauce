export function formatGrams(value) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(value < 10 ? 1 : 0)} g`;
}

export function formatMg(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value)} mg`;
}

export function formatCalories(value) {
  if (!Number.isFinite(value)) return '—';
  return Math.round(value).toString();
}

export function formatCount(value, decimals = 1) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(decimals);
}
