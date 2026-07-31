// Research links backing the ratios, intake tiers, and hourly targets.
//
// `id` is referenced by CARB_INTAKE_TIERS in src/hourly.js so each tier can
// link to the source its number comes from. Keep ids stable — they're anchor
// targets (#ref-<id>) in the page.
//
// `role` is the entry's heading: what this particular source contributes,
// specifically. Avoid generic labels — a column of cards all saying the same
// thing is noise, and tells a reader nothing about which one to open.
//
// Derivation notes in docs/recipe-source.md.

export const RESEARCH = [
  {
    id: 'morton-2026',
    role: 'Current intake guidance',
    name: 'From Metabolism to Medals',
    source: 'Morton et al. · The Journal of Nutrition, 2026',
    url: 'https://doi.org/10.1016/j.tjnut.2026.101442',
    note: 'The current guidance, and the source of the intake tiers on this page. Explicitly revisits the 2016 position statement and argues 90 g/hr should no longer be treated as the ceiling — 90–120 g/hr is the contemporary upper range for trained athletes using a glucose/fructose blend. Also puts the optimal fructose-to-glucose ratio at roughly 0.6–1.0.',
  },
  {
    id: 'jeukendrup-2014',
    role: 'Where the duration tiers come from',
    name: 'A Step Towards Personalized Sports Nutrition',
    source: 'Jeukendrup · Sports Medicine, 2014',
    url: 'https://link.springer.com/article/10.1007/s40279-014-0148-z',
    note: 'The paper that established the duration-based tier framework: ~30 g/hr for 1–2 hours, ~60 g/hr for 2–3 hours (the ceiling for a single carbohydrate source), ~90 g/hr for longer events on multiple transportable carbohydrates. Superseded on the upper end by the 2026 revision above, but still the clearest explanation of why intake scales with duration. Open access.',
  },
  {
    id: 'acsm-2016',
    role: 'The consensus it replaced',
    name: 'Nutrition and Athletic Performance',
    source: 'Thomas, Erdman & Burke · Med Sci Sports Exerc, 2016',
    url: 'https://journals.lww.com/acsm-msse/fulltext/2016/03000/nutrition_and_athletic_performance.25.aspx',
    note: 'The long-standing consensus position statement, which capped recommendations at ≤90 g/hr for efforts over 2.5–3 hours. Included because it is what most existing fueling advice still reflects — the 2026 review above is the argument for moving past it.',
  },
  {
    id: 'jeukendrup-2010',
    role: 'Why glucose and fructose together',
    name: 'The role of multiple transportable carbohydrates',
    source: 'Jeukendrup · Curr Opin Clin Nutr Metab Care, 2010',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20601741/',
    note: 'Why this mix combines maltodextrin and fructose at all. Glucose and fructose absorb via separate intestinal transporters (SGLT1 and GLUT5), lifting the oxidation ceiling from ~60 g/hr to ~90 g/hr.',
  },
  {
    id: 'podlogar-wallis-2022',
    role: 'Evidence above 90 g/hr',
    name: 'New Horizons in Carbohydrate Research',
    source: 'Podlogar & Wallis · Sports Medicine, 2022',
    url: 'https://pubmed.ncbi.nlm.nih.gov/36239908/',
    note: 'The evidence behind intakes above 90 g/hr. Oxidation keeps rising at 120 g/hr with maltodextrin plus fructose, and the gut adapts to repeated exposure — though field intakes of 120–200 g/hr still outpace the evidence, and measured performance gains taper above roughly 78 g/hr in recreationally trained riders.',
  },
  {
    id: 'sweat-rate',
    role: 'Sweat rate and sodium loss',
    name: 'Sweat rate & sodium loss overview',
    source: 'mysportscience',
    url: 'https://www.mysportscience.com/post/how-much-do-you-sweat',
    note: 'Typical sweat rate (0.75–1.5 L/hr) and sweat sodium concentration (500–1300 mg/L), used to derive the sodium target range.',
  },
  {
    id: 'sodium-athletes',
    role: 'How much sodium to replace',
    name: 'Sodium for athletes',
    source: 'Precision Hydration',
    url: 'https://www.precisionhydration.com/performance-advice/hydration/sodium-for-athletes/',
    note: 'Replacement guidance of ~50–80% of hourly sodium loss.',
  },
  {
    id: 'sweat-normative',
    role: 'Sweat data across sports',
    name: 'Normative sweat data across sports',
    source: 'Journal of Sports Sciences, 2019',
    url: 'https://www.tandfonline.com/doi/full/10.1080/02640414.2019.1633159',
    note: 'Pooled sweat-rate and sweat-sodium data used to sanity-check the 500–1000 mg/hr sodium target.',
  },
];

export function findResearch(id) {
  return RESEARCH.find((r) => r.id === id);
}
