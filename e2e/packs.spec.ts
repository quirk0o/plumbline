import { test, expect } from '@playwright/test'

test('user can browse and toggle pack ownership on the onboarding page', async ({ page }) => {
  await page.goto('/app/onboarding/packs')

  await expect(page.getByRole('heading', { name: 'Which packs do you own?' })).toBeVisible()
  await expect(page.getByText('Expansion Packs')).toBeVisible()
  await expect(page.getByText(/\d+ packs? selected/)).toBeVisible()

  const unownedPack = page.getByRole('button', { name: /— not owned/ }).first()
  // The pack name is also rendered as visible text inside the card; reading it
  // (rather than scraping+munging the aria-label) gives a stable handle that
  // still matches after the click flips the accessible name to "— owned".
  const packName = (await unownedPack.innerText()).trim()
  const pack = page.getByRole('button').filter({ hasText: packName }).first()

  await pack.click()

  await expect(pack).toHaveAttribute('aria-pressed', 'true')
})
