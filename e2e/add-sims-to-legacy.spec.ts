import { test, expect } from '@playwright/test'

test('legacy with a founder shows the founder in the sims section', async ({ page }) => {
  await page.goto('/app/legacies/new')

  const legacyName = `Founder Sims Test ${Date.now()}`
  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
  await page.getByRole('button', { name: 'Continue →' }).click()

  await page.getByPlaceholder('First name').fill('Bella')
  await page.getByPlaceholder('Last name').fill('Goth')
  await page.getByLabel('Gender').click()
  await page.getByRole('option', { name: 'Female' }).click()
  await page.getByRole('button', { name: 'Create legacy →' }).click()

  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Sims', exact: true })).toBeVisible()
  await expect(page.getByRole('listitem').getByText('Bella Goth')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add sim' })).toBeVisible()
})

test('legacy with no sims shows empty state with a CTA link', async ({ page }) => {
  await page.goto('/app/legacies/new')

  const legacyName = `No Sims Test ${Date.now()}`
  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
  await page.getByRole('button', { name: 'Continue →' }).click()

  await page.getByRole('button', { name: 'Skip →' }).click()

  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Sims', exact: true })).toBeVisible()
  await expect(
    page.locator('section', { has: page.getByRole('heading', { name: 'Sims', exact: true }) }).getByText('No sims yet.')
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add your first sim →' })).toBeVisible()
})

test('user can add a sim to an existing legacy and see it in the list', async ({ page }) => {
  await page.goto('/app/legacies/new')
  const legacyName = `Add Sim Test ${Date.now()}`
  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
  await page.getByRole('button', { name: 'Continue →' }).click()
  await page.getByRole('button', { name: 'Skip →' }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)

  await page.getByRole('link', { name: 'Add your first sim →' }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/new$/)

  await page.getByPlaceholder('First name').fill('Don')
  await page.getByPlaceholder('Last name').fill('Lothario')
  await page.getByLabel('Gender').click()
  await page.getByRole('option', { name: 'Male', exact: true }).click()
  await page.getByRole('button', { name: 'Add sim' }).click()

  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)
  await expect(page.getByRole('link', { name: 'Don Lothario' })).toBeVisible()
})
