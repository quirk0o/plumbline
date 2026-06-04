import { test, expect } from '@playwright/test'

test('user can browse and toggle pack ownership on the onboarding page', async ({ page }) => {
  await page.goto('/app/onboarding/packs')

  await expect(page.getByRole('heading', { name: 'Which packs do you own?' })).toBeVisible()
  await expect(page.getByText('Expansion Packs')).toBeVisible()
  await expect(page.getByText(/\d+ packs? selected/)).toBeVisible()

  const unownedPack = page.getByRole('button', { name: /— not owned/ }).first()
  const label = await unownedPack.getAttribute('aria-label')
  const packName = label!.replace(' — not owned', '')

  await unownedPack.click()

  await expect(page.getByRole('button', { name: `${packName} — owned` })).toHaveAttribute('aria-pressed', 'true')
})
