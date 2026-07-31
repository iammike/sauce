// Amazon Associates product links.
//
// TODO_TAG is a placeholder — swap in the real Associates tracking ID
// (tag=xxxx-20) before launch. Until specific products are picked, `url`
// points at an Amazon search rather than a guessed ASIN/product page, so the
// link is honest (if generic) in the meantime. Replace each with the exact
// product page once it's decided, keeping the same tag param.

export const TODO_TAG = 'TODO-ASSOCIATE-TAG-20';

function searchUrl(query) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${TODO_TAG}`;
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
