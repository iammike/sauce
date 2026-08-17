// Config for the e2e/ browser checks (issue #24) — kept separate from
// vitest, which only covers tests/**/*.test.js and never renders a page.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  webServer: {
    // dist/ isn't committed (see .claude/CLAUDE.md) and is what ships, so
    // build it fresh rather than loading src/ directly.
    command: 'npm run build && npm run serve',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:8000',
  },
});
