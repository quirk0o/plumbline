import { test, expect } from '@playwright/test'

async function createLegacyWithTwoSims(page: import('@playwright/test').Page) {
  await page.goto('/app/legacies/new')
  await page.waitForLoadState('networkidle')

  const legacyName = `Relationship Test ${Date.now()}`
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
  await page.getByRole('link', { name: 'Bella Goth' }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/[^/]+$/)
}

test('add relationship modal opens and shows available sims in the combobox', async ({ page }) => {
  await createLegacyWithTwoSims(page)

  await page.getByRole('button', { name: /^\+ Add$/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Add relationship' })
  await expect(dialog).toBeVisible()

  await page.getByRole('button', { name: 'Select sim' }).click()
  await expect(page.getByText('Mortimer Goth')).toBeVisible()
  await expect(page.getByText('+ Create new sim…')).toBeVisible()
})

test('user can add a partner relationship', async ({ page }) => {
  await createLegacyWithTwoSims(page)

  await page.getByRole('button', { name: /^\+ Add$/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Add relationship' })
  await expect(dialog).toBeVisible()

  await page.getByRole('button', { name: 'Select sim' }).click()
  await page.getByText('Mortimer Goth').click()

  await dialog.getByRole('button', { name: 'Add' }).click()

  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('Mortimer Goth')).toBeVisible()
})

test('user can add a family relationship', async ({ page }) => {
  await createLegacyWithTwoSims(page)

  await page.getByRole('button', { name: /^\+ Add$/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Add relationship' })
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Family' }).click()

  await page.getByRole('button', { name: 'Select sim' }).click()
  await page.getByText('Mortimer Goth').click()

  await dialog.getByRole('button', { name: 'Add' }).click()

  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('Mortimer Goth')).toBeVisible()
})

test('cancel closes the modal without adding a relationship', async ({ page }) => {
  await createLegacyWithTwoSims(page)

  await page.getByRole('button', { name: /^\+ Add$/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Add relationship' })
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).not.toBeVisible()
})
