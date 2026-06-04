import { test, expect } from '@playwright/test'
import { createLegacyWithSim } from './helpers'

test("user reviews and edits a sim's details", async ({ page }) => {
  await test.step('create a legacy with a founder', async () => {
    await createLegacyWithSim(page, 'SimDetail Test')
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

  await test.step('mark the sim as deceased', async () => {
    await page.getByRole('button', { name: '+ Mark as deceased' }).click()
    // Keep the default cause (Old Age) and confirm. Register the wait before the
    // click that fires the sims.update mutation.
    const saved = page.waitForResponse((r) => r.url().includes('sims.update') && r.ok())
    await page.getByRole('button', { name: 'Confirm' }).click()
    await saved
    // Confirmed-deceased state: the cause is shown and the "Mark as deceased"
    // chip is gone, replaced by alive/change controls.
    await expect(page.getByText('Old Age')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark as alive' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Mark as deceased' })).toBeHidden()
  })

  await test.step('reload and verify all edits persisted', async () => {
    await page.reload()
    await expect(page.getByLabel('First name')).toHaveValue('Nova')
    await expect(page.getByRole('button', { name: 'Elder' })).toBeVisible()
    await expect(page.getByText('Old Age')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark as alive' })).toBeVisible()
  })

  await test.step('navigate back to the legacy via the breadcrumb', async () => {
    await page.getByRole('link', { name: /Simdetail Test/ }).click()
    await expect(page).toHaveURL(/\/app\/legacies\/(?!new)[^/]+$/)
  })
})
