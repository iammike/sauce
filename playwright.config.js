// Config for the e2e/ browser checks (issue #24) — kept separate from
// vitest, which only covers tests/**/*.test.js and never renders a page.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  // A stray test.only would silently narrow this to one viewport and still
  // report green — fail CI outright instead.
  forbidOnly: !!process.env.CI,
  webServer: {
    // Build is NOT here: reuseExistingServer means this command may not run
    // at all locally, and the build has to happen every time regardless —
    // see the npm script, which runs it unconditionally before this config
    // is even loaded.
    command: 'npm run serve',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:8000',
  },
});
