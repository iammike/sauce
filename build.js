// Build script: bundle src/app.js into dist/app.min.js, minify shared.css.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src', 'app.js')],
    bundle: true,
    minify: true,
    target: 'es2020',
    format: 'iife',
    outfile: path.join(distDir, 'app.min.js'),
  });

  // The day-of planner is its own page and its own bundle — it shares the
  // stylesheet but almost none of the batch calculator's code.
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src', 'ride-app.js')],
    bundle: true,
    minify: true,
    target: 'es2020',
    format: 'iife',
    outfile: path.join(distDir, 'ride.min.js'),
  });

  const cssResult = await esbuild.transform(fs.readFileSync(path.join(__dirname, 'shared.css'), 'utf8'), {
    minify: true,
    loader: 'css',
  });
  fs.writeFileSync(path.join(distDir, 'app.min.css'), cssResult.code);

  console.log('built dist/app.min.js + dist/ride.min.js + dist/app.min.css');
}

build().catch((err) => { console.error(err); process.exit(1); });
