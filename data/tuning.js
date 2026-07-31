// "Dial it in" guidance — symptom-driven adjustments.
//
// Each entry is a thing you might notice, and the specific lever to move.
// Kept as data (not prose in the HTML) so the guidance can be reordered,
// filtered, or linked to directly.

export const TUNING = [
  {
    id: 'scoop-calibration',
    symptom: 'You do not know what your scoop weighs',
    fix: 'Weigh it. Fill your scoop the way you actually fill it — same packing, same level-off — tip it onto a kitchen scale, and enter that number as your scoop size.',
    why: 'There is no standard scoop. The same scoop holds different weights depending on how packed the powder is, and this mix runs roughly 0.6–0.7 g per cc, so a scoop sold as "60 cc" lands somewhere near 36–42 g. Every per-scoop number on this page — carbs, sodium, calories — is only as accurate as this one input.',
    tag: 'Start here',
  },
  {
    id: 'too-sweet',
    symptom: 'Too sweet, or cloying late in a ride',
    fix: 'Move toward maltodextrin: drop the fructose ratio (try 0.65 → 0.5). If it is still too much, dilute — same scoops, more water.',
    why: 'Maltodextrin is a long glucose chain and barely registers as sweet; fructose is the sweetest common sugar. Nearly all perceived sweetness comes from the fructose and the flavoring, so the ratio is the real sweetness dial. Palate fatigue also worsens as a ride goes on, so a mix that tastes right in the kitchen can taste sickly at hour four — test it tired.',
  },
  {
    id: 'not-sweet-enough',
    symptom: 'Flat, watery, or hard to drink',
    fix: 'Raise the fructose ratio a little, or add more flavoring. A pinch more salt also helps more than people expect.',
    why: 'Salt suppresses bitterness and lifts perceived sweetness, which is why a mix that tastes flat is sometimes under-salted rather than under-sweetened. Try the salt first — it is the cheaper change nutritionally.',
  },
  {
    id: 'too-salty',
    symptom: 'Tastes salty or makes you thirstier',
    fix: 'Step the salt profile down (hot → endurance → moderate), or dilute with more water per scoop.',
    why: 'You are likely on a profile built for more sweat than you actually produce. Sodium needs vary several-fold between people; the profiles here are starting points, not prescriptions. Note that a mix tasting salty at rest often tastes correct mid-effort, when you are actually losing sodium.',
  },
  {
    id: 'cramping',
    symptom: 'Cramping, or salt crust on your face and kit',
    fix: 'Step the salt profile up (moderate → endurance → hot). If you are already on hot and still crusting, add salt separately rather than pushing this mix further.',
    why: 'Visible salt residue means a high sweat sodium concentration — some people lose over 1500 mg/hr. Past the hot profile, adding more salt starts to hurt the taste and does not scale well, so a dedicated electrolyte tab alongside the mix is the better tool. Cramping has causes other than sodium, so treat this as one thing to rule out, not a guaranteed fix.',
  },
  {
    id: 'gi-distress',
    symptom: 'Bloating, sloshing, or GI distress',
    fix: 'First dilute — more water per scoop, which is usually the actual problem. If that does not fix it, drop the fructose ratio toward 0.5 (the Steady recipe), then lower total carbs/hr.',
    why: 'A too-concentrated drink empties from the stomach slowly and sits there sloshing; concentration is the more common culprit than the ratio. If dilution does not help, fructose is the next suspect — malabsorption is common and dose-dependent. Gut tolerance is trainable: raise carbs/hr gradually in training rather than on race day.',
  },
  {
    id: 'bonking',
    symptom: 'Running out of energy despite drinking',
    fix: 'Raise carbs/hr before touching the ratio — most people under-fuel. Work up toward 90 g/hr, and only then move to the Big Day ratio (0.8).',
    why: 'The ceiling on glucose alone is about 60 g/hr; adding fructose lifts it toward 90 and beyond because the two use separate intestinal transporters. But most people fall short of even the lower number, so the fix is usually volume, not formulation. Above roughly 90 g/hr the ratio starts to matter, and that is when Big Day earns its keep.',
  },
  {
    id: 'flavor-weak',
    symptom: 'Flavor too weak or too strong',
    fix: 'Adjust the flavoring ratio directly — it is the one ingredient you can change freely without touching the fueling math.',
    why: 'Flavoring is typically about 10% of the mix by weight and contributes little to carbs or sodium, so moving it is nearly free nutritionally. It is not free financially: freeze-dried fruit powder is often around a third of the cost, so heavy-handed flavoring is the most expensive habit here.',
  },
  {
    id: 'clumping',
    symptom: 'Clumping in the bottle or not dissolving',
    fix: 'Add powder to water rather than water to powder, and mix in stages. Warm water dissolves it faster.',
    why: 'Maltodextrin gels on contact when water hits a dry pile, sealing the outside and leaving dry powder trapped inside. Adding powder into moving water keeps the particles separated. This is a mixing-technique problem, not a formulation one — no ratio change will fix it.',
  },
];
