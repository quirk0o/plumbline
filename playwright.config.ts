import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

// Load dev env first, then overlay test DB URL so E2E uses the seeded test database
config()
config({ path: '.env.test', override: true })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3737',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: '**/setup/*.ts', teardown: 'teardown' },
    { name: 'teardown', testMatch: '**/teardown/*.ts' },
    {
      name: 'chromium',
      testMatch: ['**/packs.spec.ts', '**/legacy-wizard.spec.ts'],
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
    url: 'http://localhost:3737',
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
    },
  },
})
