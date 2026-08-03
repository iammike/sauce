import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Each page and the script that drives it.
const PAGES = [
  { html: 'index.html', script: 'src/app.js' },
  { html: 'ride.html', script: 'src/ride-app.js' },
];

function contractFor({ html: htmlFile, script }) {
  const html = readFileSync(resolve(root, htmlFile), 'utf8');
  const js = readFileSync(resolve(root, script), 'utf8');
  const allIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  return {
    htmlFile,
    script,
    allIds,
    htmlIds: new Set(allIds),
    // Every element the script reaches for by id, via its $() helper.
    referenced: [...new Set([...js.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]))],
  };
}

describe.each(PAGES.map(contractFor))(
  'DOM contract: $htmlFile <-> $script',
  ({ htmlIds, referenced, allIds }) => {
    it('references only ids that exist in the markup', () => {
      // Regression: moving a block of inputs between sections silently deleted
      // #hourly-warning while app.js still set .hidden on it. That threw inside
      // the render chain, so every panel after it stayed blank — with no
      // visible error. Cheap to assert, expensive to debug.
      const missing = referenced.filter((id) => !htmlIds.has(id));
      expect(missing).toEqual([]);
    });

    it('actually found ids to check', () => {
      // Guards the guard: if the regex stops matching, the test above passes
      // trivially and protects nothing.
      expect(referenced.length).toBeGreaterThan(3);
    });

    it('has no duplicate ids in the markup', () => {
      const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
      expect(dupes).toEqual([]);
    });
  },
);
