import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.test' })

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3737'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: '**/setup/*.ts', teardown: 'teardown' },
    { name: 'teardown', testMatch: '**/teardown/*.ts' },
    {
      name: 'chromium',
      // Glob (with auth carved out) so new authed specs — e.g. challenges.spec.ts —
      // are picked up automatically instead of being silently skipped.
      testMatch: '**/*.spec.ts',
      testIgnore: '**/auth.spec.ts',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-unauthed',
      testMatch: '**/auth.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev:test',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
      AUTH_TEST_MODE: 'true',
      NEXT_DIST_DIR: '.next-test',
    },
  },
})
