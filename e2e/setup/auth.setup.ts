import { test as setup, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as fs from 'fs'
import * as path from 'path'

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'e2e-test@simtrack.test'
const AUTH_FILE = 'e2e/.auth/user.json'

setup('authenticate', async ({ page }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })

  await page.goto('/auth/signin')
  await page.getByPlaceholder('your@email.com').fill(TEST_EMAIL)
  await page.getByRole('button', { name: 'Send magic link' }).click()
  await expect(page.getByText('Check your inbox')).toBeVisible()

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const db = new PrismaClient({ adapter })

  let token: { token: string } | null = null
  for (let i = 0; i < 10; i++) {
    token = await db.verificationToken.findFirst({
      where: { identifier: TEST_EMAIL },
      orderBy: { expires: 'desc' },
    })
    if (token) break
    await new Promise(r => setTimeout(r, 500))
  }
  await db.$disconnect()

  if (!token) throw new Error('Verification token not found in DB. Is the DB running and seeded?')

  const callbackUrl = new URL('/api/auth/callback/email', 'http://localhost:3000')
  callbackUrl.searchParams.set('token', token.token)
  callbackUrl.searchParams.set('email', TEST_EMAIL)
  callbackUrl.searchParams.set('callbackUrl', '/app')

  await page.goto(callbackUrl.toString())
  await page.waitForURL('/app/**', { timeout: 10000 })

  await page.context().storageState({ path: AUTH_FILE })
})
