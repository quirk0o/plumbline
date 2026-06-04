import { test, expect } from '@playwright/test'

async function createLegacyWithSim(page: import('@playwright/test').Page) {
  await page.goto('/app/legacies/new')
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

test("user reviews and edits a sim's details", async ({ page }) => {
  await test.step('create a legacy with a founder', async () => {
    await createLegacyWithSim(page)
  })

  await test.step('open the sim from the roster', async () => {
    await page.getByTestId('roster').getByRole('link', { name: /Bella Goth/ }).click()
    await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/[^/]+$/)
    await expect(page.getByLabel('First name')).toHaveValue('Bella')
    await expect(page.getByLabel('Last name')).toHaveValue('Goth')
  })

  await test.step('edit the first name inline (saves on blur)', async () => {
    const firstNameInput = page.getByLabel('First name')
    await firstNameInput.fill('Nova')
    // Register the wait BEFORE the blur that fires the mutation.
    const saved = page.waitForResponse((r) => r.url().includes('sims.update') && r.ok())
    await firstNameInput.blur()
    await saved
  })

  await test.step('change the life stage (saves on change)', async () => {
    // The life-stage combobox's accessible name is its selected value.
    await page.getByRole('button', { name: 'Young Adult' }).click()
    const saved = page.waitForResponse((r) => r.url().includes('sims.update') && r.ok())
    await page.getByRole('option', { name: 'Elder' }).click()
    await saved
  })

  await test.step('reload and verify both edits persisted', async () => {
    await page.reload()
    await expect(page.getByLabel('First name')).toHaveValue('Nova')
    await expect(page.getByRole('button', { name: 'Elder' })).toBeVisible()
  })

  await test.step('open the mark-as-deceased section', async () => {
    await page.getByRole('button', { name: '+ Mark as deceased' }).click()
    await expect(page.getByText('Cause of death')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible()
  })

  await test.step('navigate back to the legacy via the breadcrumb', async () => {
    await page.getByRole('link', { name: /Simdetail Test/ }).click()
    await expect(page).toHaveURL(/\/app\/legacies\/(?!new)[^/]+$/)
  })
})
