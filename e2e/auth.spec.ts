import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test('landing page loads at /', async ({ page }) => {
  await page.goto('/')
  await expect(page).not.toHaveURL('/auth/signin')
  await expect(page.locator('body')).toBeVisible()
})

test('/app redirects unauthenticated users to sign-in with callbackUrl', async ({ page }) => {
  await page.goto('/app')
  await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=/)
  expect(page.url()).toContain('callbackUrl=')
})

test('/app/onboarding/packs redirects unauthenticated users to sign-in', async ({ page }) => {
  await page.goto('/app/onboarding/packs')
  await expect(page).toHaveURL(/\/auth\/signin/)
})

test('/app/settings/packs redirects unauthenticated users to sign-in', async ({ page }) => {
  await page.goto('/app/settings/packs')
  await expect(page).toHaveURL(/\/auth\/signin/)
})

test('sign-in page renders email form and Google button', async ({ page }) => {
  await page.goto('/auth/signin')
  await expect(page.getByPlaceholder('your@email.com')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
})

test('submitting email on sign-in shows confirmation', async ({ page }) => {
  await page.goto('/auth/signin')
  await page.getByPlaceholder('your@email.com').fill('test@example.com')
  await page.getByRole('button', { name: 'Send magic link' }).click()
  await expect(page.getByText('Check your inbox')).toBeVisible()
  await expect(page.getByText('test@example.com')).toBeVisible()
})
