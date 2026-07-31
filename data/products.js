// Amazon Associates product links.
//
// Real product pages, canonical /dp/<ASIN> form with our tag; the ref_=/th=
// cruft a browser session appends is stripped. These are the specific
// products the cost figures in data/costs.js are priced from, so changing one
// means re-checking the corresponding price there.
//
// `searchUrl` remains for any ingredient added later that doesn't yet have a
// chosen product — a search link is honest where a guessed ASIN wouldn't be.

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
    name: 'Nutricost Maltodextrin Powder, 4 lb',
    note: 'Primary carb — complex, low sweetness. This is the one the recipe costs are based on.',
    // Canonical /dp/ form with our tag; the referrer cruft from a browser
    // session (ref_=, th=) is deliberately stripped.
    url: `https://www.amazon.com/dp/B079V9KD8T?tag=${ASSOCIATES_TAG}`,
  },
  {
    id: 'fructose',
    name: 'Now Foods Fructose Fruit Sugar, 3 lb (2-pack)',
    note: 'Second carb transporter (glucose/fructose co-transport). Plain crystalline fructose, not high-fructose corn syrup.',
    url: `https://www.amazon.com/dp/B00HTO3ZKM?tag=${ASSOCIATES_TAG}`,
  },
  {
    id: 'flavoring',
    name: 'Gya Tea Co Organic Freeze-Dried Strawberry Powder, 1.1 lb',
    note: 'The tested default, and the biggest cost lever in the mix — swap it or drop it to cut the price per hour.',
    url: `https://www.amazon.com/dp/B0DZX5QTJ4?tag=${ASSOCIATES_TAG}`,
  },
  {
    id: 'sodium-citrate',
    name: 'Sodium Citrate Powder, 14 oz',
    note: 'Electrolyte source — ~235 mg Na/g. Food grade, and not the same thing as table salt.',
    url: `https://www.amazon.com/dp/B07NF4B3Y7?tag=${ASSOCIATES_TAG}`,
  },
];
