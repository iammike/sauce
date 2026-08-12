// Renders the on-screen #label-sheet to a downloadable PNG at the label's
// true physical size, since printing is awkward for saving to a phone,
// texting to someone, or sending to a sticker printer.
//
// Not an SVG <foreignObject> serialized through an <img>, despite that being
// the standard-looking way to turn arbitrary HTML into a raster image.
// Verified directly in Chrome: a canvas that has ever drawn an SVG image
// containing a <foreignObject> is permanently tainted and refuses
// toDataURL()/toBlob(), even with a trivial <div>Hello</div> and zero
// external resources of any kind. This is a deliberate Chrome restriction
// (Firefox allows it), not something fixable by inlining fonts more
// carefully — Chrome is the assumed primary browser here, so the whole
// technique is a dead end.
//
// Instead this walks #label-sheet's actual DOM and redraws it with the
// Canvas 2D API, reading real position and sizing from
// getBoundingClientRect() and getComputedStyle() rather than reimplementing
// flexbox/grid — the browser has already laid the element out on screen;
// this only samples where it put things and asks Canvas to draw
// text/rects/images at the same coordinates, scaled up to export
// resolution. That also means it stays correct if the label's CSS changes
// shape later, without this file needing a matching edit — it isn't
// reading any classname, only geometry.
//
// Every element draws its own background/borders, then either its whole
// merged text (if it's a "text leaf" — see isTextLeaf()) or recurses into
// its children, never both. A block element whose children are a mix of
// block siblings AND bare text nodes — not present in the label's current
// markup — would have that direct text silently dropped, since it isn't a
// leaf (so doesn't get the merged-text treatment) and its text nodes aren't
// elements (so the child recursion never reaches them either). Extending
// this to also draw a structural element's own text alongside its element
// children is real work — positioning that text relative to sibling
// elements needs a small inline-layout simulation, not just an added
// draw call — and hasn't been needed yet.
//
// Text wrapping is Canvas's own measureText() greedy-fit, not the browser's
// line-breaking algorithm — a deliberate approximation. The label's copy is
// short and its line-height generous, so the two rarely disagree enough to
// notice, and getting this pixel-exact would need reading back per-line
// Range.getClientRects() from the live DOM instead — real, but far more
// code for a feature whose job is "good enough to text to someone", not
// print-file precision. The Print button already covers the exact case.

const DPI = 300;
// getBoundingClientRect()/getComputedStyle() report CSS pixels, which are
// defined at 96 per inch regardless of the display's actual pixel density.
// This is the scale factor from that measurement space up to the target
// export resolution.
const SCALE = DPI / 96;

function px(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function isVisible(el) {
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && !el.hidden;
}

// An inline replaced element — <img>, <br>, <svg> — computes to
// display:inline by default too, same as <strong>, but has nothing to do
// with text flow: merging it into a leaf's textContent would either drop it
// silently (img) or fold it into the surrounding words (br). The artwork
// <img> currently escapes this only by accident, because its wrapping
// <figure> happens to be display:flex and so gets blockified — explicit
// here rather than depending on that staying true.
const REPLACED_TAGS = new Set(['IMG', 'BR', 'SVG', 'CANVAS', 'VIDEO']);

// A block whose element children (if any) are still plain inline flow —
// <strong>, not a flex/grid item. getComputedStyle() reports the *used*
// display here, not the authored one: a <span> inside a flex container is
// blockified and reports 'block', even though nothing in the markup says
// so — which is exactly the distinction this needs. Treating it as one leaf
// and drawing its whole textContent as a single wrapped run is what keeps
// e.g. "Ingredients:" and the list after it from being measured and wrapped
// as two independent boxes that happen to start at the same coordinates.
// The cost is real: any inline-only styling on a piece of that text (the
// bold "Ingredients:" prefix) is lost, drawn in the leaf's own font instead.
// Acceptable here — this file's whole approach is "close enough to read",
// not pixel-exact reproduction; see the header comment.
// Exported (unlike this file's other DOM-walking internals) because unlike
// them it needs no canvas and no real layout — only getComputedStyle(),
// which jsdom implements — so the tagName-casing bug it was rewritten to
// fix is cheaply testable instead of only hand-verified. See
// tests/label-export.test.js.
export function isTextLeaf(el) {
  return [...el.children].every((child) =>
    // tagName is only upper-cased for HTML-namespace elements — an <svg>
    // reports 'svg', not 'SVG', so REPLACED_TAGS.has(child.tagName) alone
    // silently never matches it. toUpperCase() is a no-op for the HTML tags
    // already in the set and fixes SVG.
    !REPLACED_TAGS.has(child.tagName.toUpperCase()) && getComputedStyle(child).display === 'inline');
}

function leafText(el) {
  return el.textContent.replace(/\s+/g, ' ').trim();
}

function drawBackgroundAndBorders(ctx, rect, cs) {
  const bg = cs.backgroundColor;
  if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
    ctx.fillStyle = bg;
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
  }
  for (const side of ['Top', 'Bottom', 'Left', 'Right']) {
    const width = px(cs[`border${side}Width`]);
    if (width <= 0 || cs[`border${side}Style`] === 'none') continue;
    ctx.fillStyle = cs[`border${side}Color`];
    if (side === 'Top') ctx.fillRect(rect.left, rect.top, rect.width, width);
    else if (side === 'Bottom') ctx.fillRect(rect.left, rect.bottom - width, rect.width, width);
    else if (side === 'Left') ctx.fillRect(rect.left, rect.top, width, rect.height);
    else ctx.fillRect(rect.right - width, rect.top, width, rect.height);
  }
}

/**
 * Greedy word-wrap to fit maxWidth, using the canvas's own font metrics.
 *
 * Every free-text field on the label (name, flavor, note, directions,
 * ingredients, maker) sets `overflow-wrap: anywhere` in CSS — a deliberate
 * choice, since several of those fields take dozens of characters with no
 * character validation, and an unbroken run that long can be wider than the
 * sheet. A pure word-boundary wrap ignores that: a single token
 * wider than maxWidth used to be emitted whole and run off the canvas edge,
 * silently missing from the export while still visible in the on-screen
 * preview it's supposed to match. splitWord() is the fallback for exactly
 * that word, breaking it at whatever character still fits.
 *
 * Exported (unlike the rest of this file's internals) because it's the one
 * piece of the renderer that doesn't need a real canvas to test — it only
 * calls ctx.measureText(), so a plain object with a fake measureText is
 * enough to pin its behavior under plain Node. See tests/label-export.test.js.
 */
export function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  const fits = (s) => ctx.measureText(s).width <= maxWidth;

  function splitWord(word) {
    let remaining = word;
    while (!fits(remaining)) {
      let end = remaining.length;
      while (end > 1 && !fits(remaining.slice(0, end))) end--;
      lines.push(remaining.slice(0, end));
      remaining = remaining.slice(end);
    }
    return remaining;
  }

  for (const word of text.split(' ')) {
    if (!line && !fits(word)) {
      line = splitWord(word);
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (line && !fits(candidate)) {
      lines.push(line);
      line = fits(word) ? word : splitWord(word);
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawLeafText(ctx, el, rect, cs) {
  let text = leafText(el);
  if (!text) return;
  if (cs.textTransform === 'uppercase') text = text.toUpperCase();
  else if (cs.textTransform === 'lowercase') text = text.toLowerCase();

  const fontStyle = cs.fontStyle === 'italic' ? 'italic ' : '';
  ctx.font = `${fontStyle}${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  ctx.fillStyle = cs.color;
  ctx.textBaseline = 'alphabetic';

  const paddingLeft = px(cs.paddingLeft);
  const paddingRight = px(cs.paddingRight);
  const contentLeft = rect.left + px(cs.borderLeftWidth) + paddingLeft;
  const contentWidth = rect.width - px(cs.borderLeftWidth) - px(cs.borderRightWidth) - paddingLeft - paddingRight;
  const lineHeight = cs.lineHeight === 'normal' ? px(cs.fontSize) * 1.2 : px(cs.lineHeight);
  // Canvas only positions text by baseline, not "top of line box", so this
  // has to derive one from the other using the same half-leading model CSS
  // itself uses: centre the font's own ascent+descent within the line box,
  // then the baseline sits `halfLeading + ascent` below the box's top.
  // fontBoundingBoxAscent/Descent are metrics of the font, not the specific
  // characters being measured, so any non-empty string gives the real
  // numbers — measuring a single space is enough. Falls back to a fixed
  // fraction of font-size only if a browser doesn't implement the property.
  const metrics = ctx.measureText(' ');
  const { fontBoundingBoxAscent: ascentMetric, fontBoundingBoxDescent: descentMetric } = metrics;
  // Both metrics have to be present, not just the ascent — a NaN sneaking
  // into either half of ascentMetric + descentMetric would poison every
  // fillText()'s y-coordinate with NaN rather than falling back, which
  // draws nothing at all instead of just imprecise text.
  const ascent = Number.isFinite(ascentMetric) && Number.isFinite(descentMetric)
    ? ((lineHeight - (ascentMetric + descentMetric)) / 2) + ascentMetric
    : px(cs.fontSize) * 0.8;

  const lines = wrapText(ctx, text, Math.max(contentWidth, 1));
  const contentTop = rect.top + px(cs.borderTopWidth) + px(cs.paddingTop);
  lines.forEach((line, i) => {
    const y = contentTop + i * lineHeight + ascent;
    ctx.textAlign = cs.textAlign === 'center' ? 'center' : cs.textAlign === 'right' ? 'right' : 'left';
    const x = ctx.textAlign === 'center' ? contentLeft + contentWidth / 2
      : ctx.textAlign === 'right' ? contentLeft + contentWidth
        : contentLeft;
    ctx.fillText(line, x, y);
  });
}

// drawImage() on an <img> that has a src but hasn't finished decoding is a
// spec no-op, not a wait — clicking Download right after picking an artwork
// file (up to 2 MB, base64-decoded) could otherwise export a PNG with a
// blank space where the artwork should be: no error, no indication anything
// is missing. document.fonts.ready is awaited below for the identical reason.
async function waitForImages(root) {
  await Promise.all([...root.querySelectorAll('img')].map((img) => {
    if (img.complete && img.naturalWidth > 0) return null;
    return img.decode ? img.decode().catch(() => {}) : null;
  }));
}

function walk(ctx, el, offsetX, offsetY) {
  if (!isVisible(el)) return;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;
  const at = { left: rect.left + offsetX, top: rect.top + offsetY, right: rect.right + offsetX, bottom: rect.bottom + offsetY, width: rect.width, height: rect.height };
  const cs = getComputedStyle(el);

  drawBackgroundAndBorders(ctx, at, cs);

  if (el.tagName === 'IMG') {
    // drawImage() throws on a broken image (decode failed, corrupt file that
    // still passed the MIME-type check in loadArtwork()) rather than no-op'ing
    // — naturalWidth is 0 in exactly that case, so skip it instead of failing
    // the whole export over one bad image.
    if ((el.currentSrc || el.src) && el.naturalWidth > 0) ctx.drawImage(el, at.left, at.top, at.width, at.height);
    return;
  }

  if (isTextLeaf(el)) {
    drawLeafText(ctx, el, at, cs);
    return; // its children's text is already included in the leaf's textContent
  }

  for (const child of el.children) walk(ctx, child, offsetX, offsetY);
}

/**
 * Render #label-sheet to a PNG Blob at its declared physical size.
 *
 * The canvas is exactly widthIn x heightIn — nothing past that edge exists
 * in the output. A jar label with the note, a maker name and artwork all
 * filled in at once can outgrow its own declared height (a pre-existing
 * content-density limit of the label design, not something this
 * introduces — verified against the live, unexported page: the footer sits
 * past the sheet's own bottom edge there too). Unlike here, that overflow
 * isn't actually clipped anywhere else: nothing sets overflow:hidden on
 * .label-sheet, on screen or in the print stylesheet, so it stays visible
 * both places, just outside the drawn border. A canvas can't do that — it
 * has no "outside," only the pixels it was given — so this is a real,
 * narrow difference from both the preview and Print, not a match for
 * either. Worth fixing properly (grow the canvas, or shrink content to
 * fit) if it turns out to bite in practice.
 */
export async function exportLabelPng() {
  const sheet = document.getElementById('label-sheet');
  const widthIn = parseFloat(sheet.style.width);
  const heightIn = parseFloat(sheet.style.height);
  if (!Number.isFinite(widthIn) || !Number.isFinite(heightIn)) {
    throw new Error('The label has no size set — pick a label size first.');
  }

  // Canvas text needs the font already loaded, the same way any other
  // canvas text draw does — the sheet being visibly rendered with the right
  // fonts on screen already implies this, but a slow first load could still
  // be mid-fetch.
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  await waitForImages(sheet);

  // fitLabelPreview() shrinks the wide format with CSS zoom to fit a narrow
  // viewport, and zoom scales every descendant's getBoundingClientRect()
  // along with it — reading rects without accounting for that produced a
  // correctly-shaped but wrong-resolution export (1875x1449 instead of
  // 3300x2550 for the 11x8.5in format, on a viewport that had shrunk it).
  // Reset to true size for the measurement and redraw, then restore
  // whatever zoom was actually in effect, matching how the print stylesheet
  // already forces `zoom: 1` for the same reason. Restored immediately after
  // walk() finishes reading the DOM, not after the async toBlob() below —
  // walk() is synchronous, so there's a paint opportunity between them, and
  // fitLabelPreview() is also bound to window resize; a resize landing in
  // that gap would compute a fresh correct zoom only for this function to
  // clobber it back to the pre-export value once toBlob() finally resolves.
  const previousZoom = sheet.style.zoom;
  sheet.style.zoom = '';
  // Idempotent and called from two places: right after walk() on the normal
  // path (see above for why that timing matters), and from `finally` as a
  // safety net in case something throws before reaching that point.
  let zoomRestored = false;
  const restoreZoom = () => { if (!zoomRestored) { sheet.style.zoom = previousZoom; zoomRestored = true; } };

  try {
    const rect = sheet.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(widthIn * DPI);
    canvas.height = Math.round(heightIn * DPI);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser would not give the label a canvas to draw on.');
    ctx.scale(SCALE, SCALE);

    // Everything walk() draws is positioned in on-screen coordinates
    // (getBoundingClientRect() is viewport-relative, not sheet-relative),
    // so shift by the sheet's own top-left to land it at the canvas origin.
    walk(ctx, sheet, -rect.left, -rect.top);
    restoreZoom();

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Rendering the label produced no image.'))), 'image/png');
    });
  } finally {
    restoreZoom();
  }
}

/** A filesystem-safe download name from whatever's in the product-name field. */
export function labelFileName(productName) {
  // Trim before falling back, not after — '   ' is truthy, so `||` alone
  // would let three spaces through as a "name" and only strip them
  // afterward, leaving an empty base and a filename that starts " label.png".
  const trimmed = (productName || '').trim();
  const base = (trimmed || 'The Sauce').replace(/[\\/:*?"<>|]+/g, '-');
  return `${base} label.png`;
}
