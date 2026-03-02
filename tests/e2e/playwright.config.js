// Playwright config for Electron E2E tests
const path = require('path')
module.exports = {
  timeout: 120000,
  testDir: path.join(__dirname),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: true,
  }
}
