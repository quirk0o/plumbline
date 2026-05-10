import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

config({ path: '.env.test' })

// Read the Next.js dev lock file to find the URL of any already-running dev server in this
// directory. This avoids the Next.js 16 single-server-per-directory restriction — if a server
// is already running (on any port), reuseExistingServer: true will reuse it instead of trying
// to start a second one.
function detectRunningDevServer(): string | undefined {
  try {
    const lock = JSON.parse(fs.readFileSync(path.join(__dirname, '.next/dev/lock'), 'utf-8'))
    return lock.appUrl as string
  } catch {
    return undefined
  }
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? detectRunningDevServer() ?? 'http://localhost:3737'

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
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
      AUTH_TEST_MODE: 'true',
    },
  },
})
