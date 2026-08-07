// Shareable recipe links.
//
// NOT CURRENTLY WIRED INTO THE UI. Sharing formulations only makes sense once
// there is more than one genuinely tested recipe to share; until then the
// calculator's own ratio/salt/flavouring controls cover the same ground. Kept
// here, with its tests, so re-enabling is a matter of calling it again rather
// than rebuilding it.
//
// A formulation encodes into a query string so people can trade recipes on
// forums, Strava, wherever — no accounts, no backend, nothing stored.
//
// Everything here treats the URL as untrusted input, because it is: anyone
// can hand-edit a link before sending it on. Every value is validated against
// a known set or clamped to a sane range, and unknown/malformed values fall
// back to the default rather than propagating. Nothing decoded here is ever
// interpolated into HTML — callers assign it to form values only.

import { SALT_PROFILES, DEFAULT_CARB_RATIO, DEFAULT_SALT_PROFILE } from './calculator.js';
import { FLAVORINGS } from '../data/flavorings.js';
import { DEFAULT_TARGET_CARBS } from './hourly.js';

export const CARB_RATIO_BOUNDS = { min: 0, max: 1.5 };
export const TARGET_CARB_BOUNDS = { min: 10, max: 200 };
export { DEFAULT_TARGET_CARBS, DEFAULT_SALT_PROFILE };
export const DEFAULT_FLAVORING_ID = 'strawberry';

function clampNumber(raw, { min, max }, fallback) {
  // A missing param is null and an empty one is '', both of which Number()
  // happily turns into 0 — which would silently clamp to the minimum instead
  // of falling back. Reject them before converting.
  if (raw === null || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// ---------------------------------------------------------------------------
// Compact encoding
//
// Three link forms, in order of preference:
//   ?p=big-day   a named preset — readable, and covers the common case
//   ?c=1k3v      a packed token for custom formulations
//   ?r=&s=&f=&t= the original long form, still accepted so links already in
//                the wild keep working
//
// The packed form quantises each field to its step size and folds them into
// one base36 integer. Field ORDER and SLOT SIZES below are frozen: changing
// either silently changes what existing tokens decode to, which is worse than
// a link that fails loudly. FLAVOR_SLOTS is deliberately oversized so new
// flavorings can be appended without disturbing the arithmetic.

const TOKEN_VERSION = '1';
const RATIO_STEP = 0.05;
const RATIO_SLOTS = 31;   // 0 .. 1.5 in 0.05 steps
const SALT_ORDER = ['moderate', 'endurance', 'hot']; // append-only
const SALT_SLOTS = 8;
const FLAVOR_SLOTS = 32;  // room to append flavorings without reflowing
const TARGET_STEP = 5;
const TARGET_MIN = 10;
const TARGET_SLOTS = 39;  // 10 .. 200 in 5g steps

function quantise(value, step, min, slots) {
  const idx = Math.round((value - min) / step);
  return Math.min(slots - 1, Math.max(0, idx));
}

/** Pack a formulation into a short base36 token (no leading "?"). */
export function encodeToken({ carbRatio, saltProfile, flavoringId, targetCarbsPerHour }) {
  const flavor = FLAVORINGS.find((f) => f.id === flavoringId);
  const r = quantise(carbRatio, RATIO_STEP, 0, RATIO_SLOTS);
  const s = Math.max(0, SALT_ORDER.indexOf(saltProfile));
  const f = flavor ? flavor.shareId : 0;
  const t = quantise(targetCarbsPerHour, TARGET_STEP, TARGET_MIN, TARGET_SLOTS);

  const packed = r + RATIO_SLOTS * (s + SALT_SLOTS * (f + FLAVOR_SLOTS * t));
  return TOKEN_VERSION + packed.toString(36);
}

/** Unpack a token. Returns null if it is malformed or an unknown version. */
export function decodeToken(token) {
  if (typeof token !== 'string' || token[0] !== TOKEN_VERSION) return null;

  const packed = parseInt(token.slice(1), 36);
  if (!Number.isInteger(packed) || packed < 0) return null;

  let rest = packed;
  const r = rest % RATIO_SLOTS; rest = Math.floor(rest / RATIO_SLOTS);
  const s = rest % SALT_SLOTS;  rest = Math.floor(rest / SALT_SLOTS);
  const f = rest % FLAVOR_SLOTS; rest = Math.floor(rest / FLAVOR_SLOTS);
  const t = rest;

  if (t >= TARGET_SLOTS) return null;

  const flavor = FLAVORINGS.find((x) => x.shareId === f);
  const saltProfile = SALT_ORDER[s];
  if (!flavor || !saltProfile) return null;

  return {
    carbRatio: Number((r * RATIO_STEP).toFixed(2)),
    saltProfile,
    flavoringId: flavor.id,
    targetCarbsPerHour: TARGET_MIN + t * TARGET_STEP,
  };
}

/**
 * Best available query string for a formulation: a preset slug when it
 * matches one exactly, otherwise a packed token.
 */
export function encodeFormulation(formulation, presets = []) {
  const preset = presets.find((p) =>
    p.carbRatio === formulation.carbRatio
    && p.saltProfile === formulation.saltProfile
    && p.flavoringId === formulation.flavoringId
    && p.targetCarbsPerHour === formulation.targetCarbsPerHour);

  return preset ? `p=${preset.id}` : `c=${encodeToken(formulation)}`;
}

/** The original long form. Kept for hand-editing and older links. */
export function encodeLongForm({ carbRatio, saltProfile, flavoringId, targetCarbsPerHour }) {
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
export function decodeFormulation(search, presets = []) {
  const params = new URLSearchParams(search);

  // Preset slug wins — shortest and most explicit. An unknown slug falls
  // through to the other forms rather than erroring.
  const slug = params.get('p');
  if (slug) {
    const preset = presets.find((x) => x.id === slug);
    if (preset) {
      return {
        carbRatio: preset.carbRatio,
        saltProfile: preset.saltProfile,
        flavoringId: preset.flavoringId,
        targetCarbsPerHour: preset.targetCarbsPerHour,
      };
    }
  }

  const token = params.get('c');
  if (token) {
    const unpacked = decodeToken(token);
    if (unpacked) return unpacked;
  }

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
  return ['p', 'c', 'r', 's', 'f', 't'].some((k) => params.has(k));
}
