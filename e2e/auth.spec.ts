import { test, expect } from '@playwright/test'

test('unauthenticated visitor is redirected to sign-in and can submit their email', async ({ page }) => {
  await page.goto('/app')
  await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=/)

  await page.getByPlaceholder('your@email.com').fill('test@example.com')
  await page.getByRole('button', { name: 'Send magic link' }).click()
  await expect(page.getByText('Check your inbox')).toBeVisible()
  await expect(page.getByText('test@example.com')).toBeVisible()
})
