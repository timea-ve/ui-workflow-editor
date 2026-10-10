import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5180', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Cross-browser smoke only; Chromium runs the full suite.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: /smoke\.spec\.ts$/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testMatch: /smoke\.spec\.ts$/ },
  ],
  webServer: [
    {
      command: 'npx vite --port 5180 --strictPort',
      url: 'http://localhost:5180',
      reuseExistingServer: true,
      timeout: 60_000,
      // "Save to GitHub" stays off here (empty values beat any local .env file), as when unconfigured.
      env: { VITE_GITHUB_CLIENT_ID: '', VITE_GITHUB_APP_SLUG: '', VITE_AUTH_WORKER_URL: '' },
    },
    {
      // Same app with "Save to GitHub" on, pointed at fakes (e2e/github.fixture.ts). Used by github-save.spec.ts.
      command: 'npx vite --port 5181 --strictPort',
      url: 'http://localhost:5181',
      reuseExistingServer: true,
      timeout: 60_000,
      env: { VITE_GITHUB_CLIENT_ID: 'Iv1.e2etest', VITE_GITHUB_APP_SLUG: 'test-app', VITE_AUTH_WORKER_URL: 'https://auth.test.example' },
    },
  ],
});
