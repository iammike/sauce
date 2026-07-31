// Shareable recipe links.
//
// A formulation encodes into a query string so people can trade recipes on
// forums, Strava, wherever — no accounts, no backend, nothing stored.
//
// Everything here treats the URL as untrusted input, because it is: anyone
// can hand-edit a link before sending it on. Every value is validated against
// a known set or clamped to a sane range, and unknown/malformed values fall
// back to the default rather than propagating. Nothing decoded here is ever
// interpolated into HTML — callers assign it to form values only.

import { SALT_PROFILES, DEFAULT_CARB_RATIO } from './calculator.js';
import { FLAVORINGS } from '../data/flavorings.js';

export const CARB_RATIO_BOUNDS = { min: 0, max: 1.5 };
export const TARGET_CARB_BOUNDS = { min: 10, max: 200 };
export const DEFAULT_TARGET_CARBS = 75;
export const DEFAULT_FLAVORING_ID = 'strawberry';
export const DEFAULT_SALT_PROFILE = 'endurance';

function clampNumber(raw, { min, max }, fallback) {
  // A missing param is null and an empty one is '', both of which Number()
  // happily turns into 0 — which would silently clamp to the minimum instead
  // of falling back. Reject them before converting.
  if (raw === null || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Build a query string (no leading "?") describing a formulation. */
export function encodeFormulation({ carbRatio, saltProfile, flavoringId, targetCarbsPerHour }) {
  const params = new URLSearchParams();
  params.set('r', String(carbRatio));
  params.set('s', saltProfile);
  params.set('f', flavoringId);
  params.set('t', String(targetCarbsPerHour));
  return params.toString();
}

/**
 * Parse a formulation out of a query string. Always returns a complete,
 * valid formulation — invalid pieces fall back to defaults individually, so
 * one bad param doesn't discard the rest of an otherwise good link.
 */
export function decodeFormulation(search) {
  const params = new URLSearchParams(search);

  const rawSalt = params.get('s');
  const rawFlavor = params.get('f');

  return {
    carbRatio: clampNumber(params.get('r'), CARB_RATIO_BOUNDS, DEFAULT_CARB_RATIO),
    saltProfile: Object.prototype.hasOwnProperty.call(SALT_PROFILES, rawSalt ?? '')
      ? rawSalt
      : DEFAULT_SALT_PROFILE,
    flavoringId: FLAVORINGS.some((f) => f.id === rawFlavor)
      ? rawFlavor
      : DEFAULT_FLAVORING_ID,
    targetCarbsPerHour: clampNumber(params.get('t'), TARGET_CARB_BOUNDS, DEFAULT_TARGET_CARBS),
  };
}

/** True when the query string carries at least one recognised recipe param. */
export function hasFormulation(search) {
  const params = new URLSearchParams(search);
  return ['r', 's', 'f', 't'].some((k) => params.has(k));
}
