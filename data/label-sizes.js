// Label formats.
//
// A wrap label round a tub is wider than it is tall, which wants a different
// arrangement from a small stick-on: brand and artwork on one side, the facts
// panel on the other. `wide` drives that switch rather than a raw width
// comparison, so a format can opt out if it ever needs to.

export const LABEL_SIZES = [
  { id: '3x4', label: '3 × 4 in — small jar', widthIn: 3, heightIn: 4, wide: false },
  { id: '4x6', label: '4 × 6 in — large jar', widthIn: 4, heightIn: 6, wide: false },
  { id: 'letter', label: '8.5 × 11 in — full sheet', widthIn: 8.5, heightIn: 11, wide: false },
  { id: 'letter-wrap', label: '11 × 8.5 in — full sheet, wraps a tub', widthIn: 11, heightIn: 8.5, wide: true },
];

export function findLabelSize(id) {
  return LABEL_SIZES.find((s) => s.id === id) ?? LABEL_SIZES[0];
}
