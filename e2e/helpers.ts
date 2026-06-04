import { expect, type Page } from '@playwright/test'

/**
 * Create a legacy with a single founder sim (Bella Goth) via the wizard, then
 * land on the legacy detail page. Returns the generated legacy name so callers
 * can assert breadcrumbs / headings.
 */
export async function createLegacyWithSim(page: Page, namePrefix: string) {
  await page.goto('/app/legacies/new')

  const legacyName = `${namePrefix} ${Date.now()}`
  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
  await page.getByRole('button', { name: 'Continue →' }).click()

  await page.getByPlaceholder('First name').fill('Bella')
  await page.getByPlaceholder('Last name').fill('Goth')
  await page.getByLabel('Gender').click()
  await page.getByRole('option', { name: 'Female' }).click()
  await page.getByRole('button', { name: 'Create legacy →' }).click()

  // Wait for the legacy detail page — exclude /new to avoid matching the wizard URL
  await expect(page).toHaveURL(/\/app\/legacies\/(?!new)[^/]+$/)
  return { legacyName }
}

/**
 * Create a legacy with two sims (founder Bella Goth + Mortimer Goth), then open
 * Bella's sim detail page. Returns the generated legacy name.
 */
export async function createLegacyWithTwoSims(page: Page, namePrefix: string) {
  await page.goto('/app/legacies/new')

  const legacyName = `${namePrefix} ${Date.now()}`
  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
  await page.getByRole('button', { name: 'Continue →' }).click()

  await page.getByPlaceholder('First name').fill('Bella')
  await page.getByPlaceholder('Last name').fill('Goth')
  await page.getByLabel('Gender').click()
  await page.getByRole('option', { name: 'Female' }).click()
  await page.getByRole('button', { name: 'Create legacy →' }).click()

  await expect(page).toHaveURL(/\/app\/legacies\/(?!new)[^/]+$/)

  await page.getByRole('link', { name: 'Add sim' }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/new$/)

  await page.getByPlaceholder('First name').fill('Mortimer')
  await page.getByPlaceholder('Last name').fill('Goth')
  await page.getByLabel('Gender').click()
  await page.getByRole('option', { name: 'Male', exact: true }).click()
  await page.getByRole('button', { name: 'Add sim' }).click()

  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)
  await page.getByTestId('roster').getByRole('link', { name: /Bella Goth/ }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/[^/]+$/)

  return { legacyName }
}
