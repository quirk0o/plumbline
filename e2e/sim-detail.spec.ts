import { test, expect } from '@playwright/test'

async function createLegacyWithSim(page: import('@playwright/test').Page) {
  await page.goto('/app/legacies/new')
  await page.waitForLoadState('networkidle')
  const legacyName = `SimDetail Test ${Date.now()}`
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

test('sim portrait link navigates to detail page', async ({ page }) => {
  await createLegacyWithSim(page)

  await page.getByTestId('roster').getByRole('link', { name: /Bella Goth/ }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/[^/]+$/)
  await expect(page.getByLabel('First name')).toHaveValue('Bella')
  await expect(page.getByLabel('Last name')).toHaveValue('Goth')
})

test('editing first name inline saves on blur', async ({ page }) => {
  await createLegacyWithSim(page)

  await page.getByTestId('roster').getByRole('link', { name: /Bella Goth/ }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/[^/]+$/)

  const firstNameInput = page.getByLabel('First name')
  await firstNameInput.fill('Nova')
  await firstNameInput.blur()

  // Wait for the mutation to settle then reload to confirm persistence
  await page.waitForTimeout(500)
  await page.reload()
  await expect(page.getByLabel('First name')).toHaveValue('Nova')
})

test('life stage dropdown saves on change', async ({ page }) => {
  await createLegacyWithSim(page)

  await page.getByTestId('roster').getByRole('link', { name: /Bella Goth/ }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/[^/]+$/)

  // The life-stage combobox's accessible name is its selected value (the
  // combobox clears its aria-label once a value is set), so target it by value.
  await page.getByRole('button', { name: 'Young Adult' }).click()
  await page.getByRole('option', { name: 'Elder' }).click()
  await page.waitForTimeout(500)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Elder' })).toBeVisible()
})

test('mark as deceased shows death section', async ({ page }) => {
  await createLegacyWithSim(page)

  await page.getByTestId('roster').getByRole('link', { name: /Bella Goth/ }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/[^/]+$/)

  await page.getByRole('button', { name: '+ Mark as deceased' }).click()
  // The death-confirm UI exposes a "Cause of death" field label and a Confirm
  // action; the cause combobox itself is named by its default value ("Old Age").
  await expect(page.getByText('Cause of death')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible()
})

test('breadcrumb links back to legacy page', async ({ page }) => {
  await createLegacyWithSim(page)
  // Capture the settled legacy URL after the wizard redirect
  const legacyUrl = page.url()

  await page.getByTestId('roster').getByRole('link', { name: /Bella Goth/ }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/[^/]+$/)

  // Click the legacy name in the breadcrumb (slug-derived, matches /simdetail-test-…/)
  await page.getByRole('link', { name: /Simdetail Test/ }).click()
  await expect(page).toHaveURL(legacyUrl)
})

test('section titles are h2 headings', async ({ page }) => {
  await createLegacyWithSim(page)
  await page.getByTestId('roster').getByRole('link', { name: /Bella Goth/ }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/[^/]+$/)

  await expect(page.getByRole('heading', { name: 'Personality Traits', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Goals & Career', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Skills', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Relationships', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Family Tree', level: 2 })).toBeVisible()
})

test('breadcrumb is a navigation landmark', async ({ page }) => {
  await createLegacyWithSim(page)
  await page.getByTestId('roster').getByRole('link', { name: /Bella Goth/ }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/[^/]+$/)

  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible()
})
