import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const TEST_IMAGE = path.join(process.cwd(), 'public/uploads/1778220455753-Lemons.png')
const LOG_FILE = path.join(process.cwd(), '.next/dev/logs/next-development.log')

test.describe.configure({ mode: 'serial' })

async function signIn(page: import('@playwright/test').Page, email: string) {
  await page.goto('/auth/signin')
  await page.getByRole('textbox').fill(email)
  await page.getByRole('button', { name: /send/i }).click()
  await page.waitForTimeout(2000)

  const encodedEmail = encodeURIComponent(email)
  const log = fs.readFileSync(LOG_FILE, 'utf-8')
  // Match only the link for this specific email to avoid consuming stale tokens
  const pattern = new RegExp(
    `(http://localhost:\\d+/api/auth/callback/email\\?[^\\s"'<\\\\]+${encodedEmail}[^\\s"'<\\\\]*)`,
    'g'
  )
  const matches = [...log.matchAll(pattern)]
  if (!matches.length) throw new Error(`No magic link found for ${email}`)
  await page.goto(matches[matches.length - 1][1])
  await page.waitForURL(/\/app/, { timeout: 15000 })
}

test('upload button renders at correct size before upload', async ({ page }) => {
  await signIn(page, `pw-size-${Date.now()}@simtrack.test`)
  await page.goto('/app/legacies/new')

  const btn = page.getByRole('button', { name: 'Cover image' })
  await expect(btn).toBeVisible()
  const box = await btn.boundingBox()
  expect(box?.width).toBeCloseTo(104, 0)
  expect(box?.height).toBeCloseTo(104, 0)
})

test('thumbnail fills button after upload', async ({ page }) => {
  await signIn(page, `pw-upload-${Date.now()}@simtrack.test`)
  await page.goto('/app/legacies/new')

  const fileInput = page.locator('input[type="file"][accept="image/*"]').first()
  await fileInput.setInputFiles(TEST_IMAGE)

  const btn = page.getByRole('button', { name: 'Change image' })
  await expect(btn).toBeVisible({ timeout: 10000 })

  const bgImage = await btn.evaluate((el) => getComputedStyle(el).backgroundImage)
  const bgSize = await btn.evaluate((el) => getComputedStyle(el).backgroundSize)
  const bgPos = await btn.evaluate((el) => getComputedStyle(el).backgroundPosition)

  expect(bgImage).not.toBe('none')
  expect(bgSize).toBe('contain')
  expect(bgPos).toMatch(/50% 50%|center/)

  const box = await btn.boundingBox()
  expect(box?.width).toBeCloseTo(104, 0)
  expect(box?.height).toBeCloseTo(104, 0)

  await page.screenshot({ path: 'e2e/screenshots/thumbnail-after-upload.png' })
})

test('background-size stays cover on hover', async ({ page }) => {
  await signIn(page, `pw-hover-${Date.now()}@simtrack.test`)
  await page.goto('/app/legacies/new')

  const fileInput = page.locator('input[type="file"][accept="image/*"]').first()
  await fileInput.setInputFiles(TEST_IMAGE)

  const btn = page.getByRole('button', { name: 'Change image' })
  await expect(btn).toBeVisible({ timeout: 10000 })
  await btn.hover()

  const bgSize = await btn.evaluate((el) => getComputedStyle(el).backgroundSize)
  const bgImage = await btn.evaluate((el) => getComputedStyle(el).backgroundImage)

  expect(bgSize).toBe('contain')
  expect(bgImage).not.toBe('none')

  await page.screenshot({ path: 'e2e/screenshots/thumbnail-on-hover.png' })
})
