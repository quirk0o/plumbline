import { test as setup, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'e2e-test@simtrack.test'
const AUTH_FILE = 'e2e/.auth/user.json'

setup('authenticate', async ({ request }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })

  const csrfRes = await request.get('/api/auth/csrf')
  const { csrfToken } = await csrfRes.json() as { csrfToken: string }

  // Auth.js v5 credentials endpoint uses the provider id in the path
  const res = await request.post('/api/auth/callback/test', {
    form: {
      email: TEST_EMAIL,
      csrfToken,
      callbackUrl: '/app',
      json: 'true',
    },
  })

  console.log('credentials POST status:', res.status())
  console.log('credentials POST url:', res.url())
  const body = await res.text()
  console.log('credentials POST body:', body.slice(0, 200))

  await request.storageState({ path: AUTH_FILE })

  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
  const hasSession = state.cookies.some((c: { name: string }) =>
    c.name.includes('session-token')
  )
  if (!hasSession) {
    throw new Error(
      'Auth setup failed: no session cookie found. ' +
      'Ensure the dev server started with AUTH_TEST_MODE=true.'
    )
  }
})
