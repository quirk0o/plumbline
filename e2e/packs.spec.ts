import { test, expect } from '@playwright/test'

test('onboarding page renders the pack grid heading', async ({ page }) => {
  await page.goto('/app/onboarding/packs')
  await expect(page.getByRole('heading', { name: 'Which packs do you own?' })).toBeVisible()
})

test('pack grid shows pack type sections', async ({ page }) => {
  await page.goto('/app/onboarding/packs')
  await expect(page.getByText('Expansion Packs')).toBeVisible()
  await expect(page.getByText('Game Packs')).toBeVisible()
})

test('pack grid shows a selected count', async ({ page }) => {
  await page.goto('/app/onboarding/packs')
  await expect(page.getByText(/\d+ packs? selected/)).toBeVisible()
})

test('clicking an unowned pack toggles it to owned', async ({ page }) => {
  await page.goto('/app/onboarding/packs')

  const unownedPack = page.getByRole('button', { pressed: false }).first()
  await unownedPack.waitFor()
  const packName = await unownedPack.getAttribute('aria-label')

  await unownedPack.click()

  if (packName) {
    const toggled = page.getByRole('button').filter({ hasText: packName.split(' — ')[0] })
    await expect(toggled).toHaveAttribute('aria-pressed', 'true')
  } else {
    await expect(page.getByRole('button', { pressed: true }).first()).toBeVisible()
  }
})

test('clicking an owned pack toggles it back to unowned', async ({ page }) => {
  await page.goto('/app/onboarding/packs')

  const unownedPack = page.getByRole('button', { pressed: false }).first()
  await unownedPack.waitFor()
  const packLabel = await unownedPack.getAttribute('aria-label')
  const packName = packLabel?.split(' — ')[0] ?? ''

  await unownedPack.click()
  await expect(page.getByRole('button').filter({ hasText: packName })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button').filter({ hasText: packName }).click()
  await expect(page.getByRole('button').filter({ hasText: packName })).toHaveAttribute('aria-pressed', 'false')
})

test('dashboard renders a pack count and greeting', async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByText(/selected/)).toBeVisible()
  await expect(page.getByText(/Welcome back/)).toBeVisible()
})

test('settings packs page renders the same pack grid', async ({ page }) => {
  await page.goto('/app/settings/packs')
  await expect(page.getByText('Expansion Packs')).toBeVisible()
  await expect(page.getByText(/\d+ packs? selected/)).toBeVisible()
})
