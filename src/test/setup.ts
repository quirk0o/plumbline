import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

const testEnv = resolve(process.cwd(), '.env.test')
config({ path: existsSync(testEnv) ? testEnv : resolve(process.cwd(), '.env') })

// Only extend expect with jest-dom matchers in jsdom environments (component tests)
if (typeof window !== 'undefined') {
  const { default: matchers } = await import('@testing-library/jest-dom/matchers')
  const { expect } = await import('vitest')
  expect.extend(matchers)
}
