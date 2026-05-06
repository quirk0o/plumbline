import { test as setup } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'e2e-test@simtrack.test'
const AUTH_FILE = 'e2e/.auth/user.json'

setup('authenticate', async ({ request }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })

  const csrfRes = await request.get('/api/auth/csrf')
  const { csrfToken } = await csrfRes.json() as { csrfToken: string }

  await request.post('/api/auth/callback/credentials', {
    form: {
      email: TEST_EMAIL,
      csrfToken,
      callbackUrl: '/app',
      json: 'true',
    },
  })

  await request.storageState({ path: AUTH_FILE })
})
