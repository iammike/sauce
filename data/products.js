// Amazon Associates product links.
//
// Specific products haven't been picked yet, so `url` points at an Amazon
// search rather than a guessed ASIN/product page — the link is honest (if
// generic) in the meantime. Replace each with the exact product page once
// it's decided, keeping the same tag param, and drop that entry's
// `placeholder` flag.

// Store ID is `mikeylikesit-20`; `sauce-calc-20` is a tracking ID under it,
// created specifically for this site so its earnings stay segmented in
// Associates reporting. Don't reuse this tag anywhere else — that's the whole
// point of it being site-specific.
export const ASSOCIATES_TAG = 'sauce-calc-20';

function searchUrl(query) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${ASSOCIATES_TAG}`;
}

export const PRODUCTS = [
  {
    id: 'maltodextrin',
    name: 'Maltodextrin powder',
    note: 'Primary carb — complex, low sweetness. Look for a plain, unflavored food-grade powder.',
    url: searchUrl('maltodextrin powder food grade'),
    placeholder: true,
  },
  {
    id: 'fructose',
    name: 'Fructose powder',
    note: 'Second carb transporter (glucose/fructose co-transport). Plain crystalline fructose, not high-fructose corn syrup.',
    url: searchUrl('fructose powder'),
    placeholder: true,
  },
  {
    id: 'flavoring',
    name: 'Flavoring (freeze-dried strawberry powder)',
    note: 'The tested default — swap for anything in the flavorings table.',
    url: searchUrl('freeze dried strawberry powder'),
    placeholder: true,
  },
  {
    id: 'sodium-citrate',
    name: 'Sodium citrate (dihydrate)',
    note: 'Electrolyte source — ~235 mg Na/g. Not table salt.',
    url: searchUrl('sodium citrate dihydrate food grade'),
    placeholder: true,
  },
];
