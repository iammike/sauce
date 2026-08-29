// Troubleshooting — symptom-driven, in the order you'd hit the problems:
// making the batch, then mixing a bottle, then taste, then how it feels on
// the bike.
//
// Each entry is a thing you might notice, and the specific lever to move.
// Kept as data (not prose in the HTML) so the guidance can be reordered,
// filtered, or linked to directly.

export const TUNING = [
  {
    id: 'uneven-batch',
    symptom: 'The batch is not evenly mixed',
    fix: 'Leave the container at least a third empty and shake it properly — end over end, not side to side, for a good minute. Top the container up only after mixing.',
    why: 'Four powders of different densities and particle sizes do not combine by being poured into the same tub. Salt is the one that matters: it is the densest and by far the smallest fraction, so if it settles you get scoops that taste of nothing followed by one that tastes of seawater. A full container cannot tumble, which is why headroom is not wasted space — it is what does the mixing.',
  },
  {
    id: 'clumping',
    symptom: 'Clumping in the bottle or not dissolving',
    fix: 'Add powder to water rather than water to powder, and mix in stages. Warm water dissolves it faster.',
    why: 'Maltodextrin gels on contact when water hits a dry pile, sealing the outside and leaving dry powder trapped inside. Adding powder into moving water keeps the particles separated. This is a mixing-technique problem, not a formulation one — no ratio change will fix it.',
  },
  {
    id: 'scoop-calibration',
    symptom: 'You want to scoop rather than weigh every time',
    fix: 'Weigh your scoop once. Fill it the way you actually fill it — same packing, same level-off — tip it onto the scale, and use that number.',
    why: 'There is no standard scoop. The same scoop holds different weights depending on how packed the powder is, and this mix runs roughly 0.6–0.7 g per cc, so a scoop sold as "60 cc" lands somewhere near 36–42 g. Every per-scoop number on this page — carbs, sodium, calories — is only as accurate as this one input.',
  },
  {
    id: 'too-sweet',
    symptom: 'Too sweet, or cloying late in a ride',
    fix: 'Move toward maltodextrin: drop the fructose ratio (try 0.8 → 0.65). If it is still too much, dilute — same scoops, more water.',
    why: 'Maltodextrin is a long glucose chain and barely registers as sweet; fructose is the sweetest common sugar. Nearly all perceived sweetness comes from the fructose and the flavoring, so the ratio is the real sweetness dial. Palate fatigue also worsens as a ride goes on, so a mix that tastes right in the kitchen can taste sickly at hour four — test it tired.',
  },
  {
    id: 'not-sweet-enough',
    symptom: 'Flat, watery, or hard to drink',
    fix: 'Raise the flavoring, or add a pinch more salt — it helps more than people expect. The fructose ratio is the other dial, but 0.8 is already the best-evidenced point in the band.',
    why: 'Salt suppresses bitterness and lifts perceived sweetness, which is why a mix that tastes flat is sometimes under-salted rather than under-sweetened. Try the salt first — it is the cheaper change nutritionally.',
  },
  {
    id: 'just-use-sugar',
    symptom: 'You want to just use table sugar',
    fix: 'You can, at moderate intakes, with a salt source alongside it. Sucrose is glucose and fructose bonded 1:1, which lands inside the optimal ratio band on its own, and it is the cheapest carbohydrate there is.',
    why: 'The osmolality argument against sugar is weaker than it looks here. Maltodextrin counts as one particle while carrying many glucose units, but free fructose is a single particle just as glucose is — so at the standard 0.8 ratio the fructose supplies most of the count and the mix lands at about 286 mOsm/L against sucrose at 292. Level. The gap only opens if you drop the ratio toward 0.5, where the mix reaches 238 and sugar cannot follow. What you actually buy by weighing two powders is the ability to move that ratio, sodium already in the jar, and a drink that is a sixth to two thirds less sweet at the same carbohydrate.',
  },
  {
    id: 'cheapest-mix',
    symptom: 'You want the cheapest thing that works',
    fix: 'Table sugar and sodium citrate, nothing else. Pick Table sugar as the carb source and Unflavored as the flavouring: about $0.25 an hour against $1.30 for the full mix, and cheaper than anything you can buy ready-made.',
    why: 'Two levers, and the carbohydrate is the bigger one — swapping maltodextrin and fructose for sucrose saves more than dropping the flavouring does, though you want both. The salt is the part not to cut: sugar carries none of its own, and whichever level you pick delivers the same sodium per gram of carbohydrate here as it does in the full mix. Expect it to taste like sweet salty water; lemon or lime juice goes in the bottle rather than the jar, so it costs nothing to add on the day.',
  },
  {
    id: 'flavor-weak',
    symptom: 'Flavor too weak or too strong',
    fix: 'Adjust the flavoring ratio directly — it is the one ingredient you can change freely without touching the fueling math.',
    why: 'Flavoring is typically about 10% of the mix by weight and contributes little to carbs or sodium, so moving it is nearly free nutritionally. It is not free financially: freeze-dried fruit powder is often around a third of the cost, so heavy-handed flavoring is the most expensive habit here.',
  },
  {
    id: 'too-salty',
    symptom: 'Tastes salty or makes you thirstier',
    fix: 'Step the salt profile down (hot → endurance → moderate), or dilute with more water per scoop.',
    why: 'You are likely on a profile built for more sweat than you actually produce. Sodium needs vary several-fold between people; the profiles here are starting points, not prescriptions. Note that a mix tasting salty at rest often tastes correct mid-effort, when you are actually losing sodium.',
  },
  {
    id: 'gi-distress',
    symptom: 'Bloating, sloshing, or GI distress',
    fix: 'First dilute — more water per scoop, which is usually the actual problem. If that does not fix it, drop the fructose ratio toward 0.5, then lower total carbs/hr.',
    why: 'A too-concentrated drink empties from the stomach slowly and sits there sloshing; concentration is the more common culprit than the ratio. If dilution does not help, fructose is the next suspect — malabsorption is common and dose-dependent. Gut tolerance is trainable: raise carbs/hr gradually in training rather than on race day.',
  },
  {
    id: 'cramping',
    symptom: 'Cramping, or salt crust on your face and kit',
    fix: 'Step the salt profile up (moderate → endurance → hot). If you are already on hot and still crusting, add salt separately rather than pushing this mix further.',
    why: 'Visible salt residue means a high sweat sodium concentration — some people lose over 1500 mg/hr. Past the hot profile, adding more salt starts to hurt the taste and does not scale well, so a dedicated electrolyte tab alongside the mix is the better tool. Cramping has causes other than sodium, so treat this as one thing to rule out, not a guaranteed fix.',
  },
  {
    id: 'bonking',
    symptom: 'Running out of energy despite drinking',
    fix: 'Raise carbs/hr before touching the ratio — most people under-fuel. Work up toward 90 g/hr first, and only then consider raising the fructose ratio toward 0.8.',
    why: 'The ceiling on glucose alone is about 60 g/hr; adding fructose lifts it toward 90, and toward 120 for trained athletes, because the two use separate intestinal transporters. But most people fall short of even the lower number, so the fix is usually volume rather than formulation. The ratio only becomes the limiting factor once you are reliably fuelling above about 90 g/hr.',
  },
];
