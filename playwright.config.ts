import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

// In a git worktree the per-environment .env.test provides the test DATABASE_URL.
// The parent project's .env (three levels up from the worktree) provides AUTH_SECRET
// and other shared secrets. We load both; .env.test wins for any key it redeclares.
config({ path: '../../../.env' })
config({ path: '.env.test', override: true })

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
      testMatch: ['**/packs.spec.ts', '**/legacy-wizard.spec.ts', '**/add-sims-to-legacy.spec.ts', '**/sim-detail.spec.ts', '**/add-relationship-modal.spec.ts', '**/milestones.spec.ts'],
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
      AUTH_SECRET: process.env.AUTH_SECRET!,
      AUTH_TEST_MODE: 'true',
      NEXT_DIST_DIR: '.next-test',
    },
  },
})
