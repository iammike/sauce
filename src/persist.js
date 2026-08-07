// Calculator inputs, persisted across visits.
//
// This is a personal pantry tool — the same person opens it repeatedly with
// roughly the same jars on the shelf — so resetting to the hardcoded markup
// defaults on every visit is pure friction. localStorage remembers the last
// values; there's no account and nothing leaves the browser.
//
// A saved record is untrusted input, the same way share.js treats a query
// string: it can be stale (a flavoring since retired), corrupted, or
// hand-edited in devtools. Every field is validated independently and a bad
// one is skipped rather than discarding the rest of the record or falling
// through to 0 — Number('') and Number(null) are both 0, not "unset".
//
// Every bound below — a number field's min/max, a select's valid values — is
// read from the live element rather than duplicated into a model here.
// Deliberate: a duplicated bound can silently drift from the markup (raise a
// max in index.html and forget this file, and a legitimate value starts
// getting dropped with no error). Both selects' <option>s are themselves
// built from a data model at init (initFlavorPresets()/initSaltProfiles() in
// app.js), so this file's job is only to check a saved value against
// whatever the page actually offers right now — never against a second copy
// of the same list kept here.

const STORAGE_KEY = 'sauce.calcForm.v1';

const $ = (id) => document.getElementById(id);

const NUMBER_FIELDS = [
  'in-malto',
  'in-fructose',
  'in-flavoring',
  'in-salt',
  // The only field markup lets sit empty ("no limit"); everything else
  // treats an empty string as absent, not as a valid zero. Not derivable
  // from the DOM — it's a meaning this file assigns to the field, not an
  // HTML attribute — so it stays as an explicit annotation.
  { id: 'in-cap', allowEmpty: true },
  'in-target-carbs',
  'in-carb-ratio',
].map((f) => (typeof f === 'string' ? { id: f, allowEmpty: false } : f));

const SELECT_FIELDS = ['in-flavor-preset', 'in-salt-profile'];

function selectOptionValues(id) {
  return [...$(id).options].map((o) => o.value);
}

/** min/max off the element itself. An absent attribute reads back as ''. */
function numberBounds(id) {
  const el = $(id);
  return {
    min: el.min === '' ? undefined : Number(el.min),
    max: el.max === '' ? undefined : Number(el.max),
  };
}

/** Read every persisted field straight from the DOM. */
function readCalcFormState() {
  const state = {};
  for (const { id } of NUMBER_FIELDS) state[id] = $(id).value;
  for (const id of SELECT_FIELDS) state[id] = $(id).value;
  return state;
}

/**
 * Save the current form. Only the write is guarded — readCalcFormState()
 * failing would mean a persisted field's id no longer exists on the page,
 * which should surface as an error rather than silently disable persistence.
 */
export function saveCalcFormState() {
  const state = readCalcFormState();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage can throw rather than just being absent — Safari private
    // browsing and a full quota both do this. Losing the memory feature is
    // not worth losing the calculator.
  }
}

// Save is intentionally unvalidated: it writes whatever's on screen, even a
// value outside a field's own min/max — typing past a number input's max
// doesn't clamp it, the browser only enforces that at form submission, and
// this form is never submitted. Validation lives entirely in restore, so an
// out-of-range value saved on one visit just reverts to the markup default
// on the next rather than being remembered. Deliberate, not a gap: rejecting
// it at save time would mean telling the user their edit won't be kept while
// they're still making it, and clamping it would silently substitute a
// number they never typed. Losing an in-progress out-of-range edit on
// reload is the version of this with no lie in either direction.

/**
 * Apply a saved form state to the DOM, one field at a time. Called once,
 * before the first render, so a value it skips just leaves that field at
 * whatever the markup already set — never at 0 or blank.
 */
export function restoreCalcFormState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    return;
  }
  if (!saved || typeof saved !== 'object') return;

  for (const { id, allowEmpty } of NUMBER_FIELDS) {
    const value = saved[id];

    if (allowEmpty && value === '') {
      $(id).value = '';
      continue;
    }

    // Covers a missing field too — typeof undefined is neither 'string' nor
    // 'number'. A missing/blank field decodes to 0 via Number(), which would
    // silently pass a min:0 bound as if it were a real saved zero, so this
    // has to reject non-numeric values outright rather than coercing them.
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const n = Number(value);
    if (!Number.isFinite(n) || String(value).trim() === '') continue;
    const { min, max } = numberBounds(id);
    if (min !== undefined && n < min) continue;
    if (max !== undefined && n > max) continue;

    // The normalised number, not the raw saved string. A type="number" input
    // silently blanks itself if assigned a string its sanitizer rejects —
    // leading/trailing whitespace, a leading "+", hex/octal/binary notation,
    // a bare trailing "." — even though Number() parses every one of those
    // fine. Number() and the HTML number-input sanitizer disagree on what
    // "a number" looks like; assigning what Number() actually parsed sides
    // with the sanitizer and can never trigger it.
    $(id).value = String(n);
  }

  for (const id of SELECT_FIELDS) {
    const value = saved[id];
    if (typeof value !== 'string' || !selectOptionValues(id).includes(value)) continue;
    $(id).value = value;
  }
}
