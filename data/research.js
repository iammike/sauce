// Research links backing the ratios and hourly targets used by the calculator.
// Sourced from the recipe notes; see docs/recipe-source.md for the full derivation.

export const RESEARCH = [
  {
    name: 'Sweat rate & sodium loss overview',
    source: 'mysportscience',
    url: 'https://www.mysportscience.com/post/how-much-do-you-sweat',
    note: 'Typical sweat rate (0.75–1.5 L/hr) and sweat sodium concentration (500–1300 mg/L) used to derive the sodium target range.',
  },
  {
    name: 'Sodium for athletes',
    source: 'Precision Hydration',
    url: 'https://www.precisionhydration.com/performance-advice/hydration/sodium-for-athletes/',
    note: 'Replacement guidance of ~50–80% of hourly sodium loss.',
  },
  {
    name: 'Normative sweat data across sports',
    source: 'International Journal of Sports Science & Coaching (Taylor & Francis)',
    url: 'https://www.tandfonline.com/doi/full/10.1080/02640414.2019.1633159',
    note: 'Pooled sweat-rate and sweat-sodium data used to sanity-check the 500–1000 mg/hr sodium target.',
  },
  {
    name: 'Multiple transportable carbohydrates and exercise performance',
    source: 'Jeukendrup, 2010 (review)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20601741/',
    note: 'The basis for the maltodextrin:fructose ratio — glucose and fructose absorb via separate intestinal transporters (SGLT1/GLUT5), raising the achievable carb-oxidation ceiling from ~60 g/hr to ~90 g/hr.',
  },
];
