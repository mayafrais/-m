// Runs the smoke tests against the static files of this repo, served locally.
const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: { command: 'node serve.js', port: 4173, reuseExistingServer: true },
  projects: [
    { name: 'iphone-safari', use: { ...devices['iPhone 13'] } },
    { name: 'android-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
  ],
});
