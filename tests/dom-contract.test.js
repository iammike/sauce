import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const app = readFileSync(resolve(root, 'src/app.js'), 'utf8');

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

// Every element app.js reaches for by id, via the $() helper.
const referenced = [...new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]))];

describe('DOM contract between index.html and src/app.js', () => {
  it('references only ids that exist in the markup', () => {
    // Regression: moving a block of inputs between sections silently deleted
    // #hourly-warning while app.js still set .hidden on it. That threw inside
    // the render chain, so every panel rendered after it stayed blank — with
    // no visible error. Cheap to assert, expensive to debug.
    const missing = referenced.filter((id) => !htmlIds.has(id));
    expect(missing).toEqual([]);
  });

  it('actually found ids to check', () => {
    // Guards the guard: if the regex stops matching, the test above passes
    // trivially and protects nothing.
    expect(referenced.length).toBeGreaterThan(30);
  });

  it('has no duplicate ids in the markup', () => {
    const all = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    const dupes = all.filter((id, i) => all.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });
});
