import { test, expect } from '@playwright/test'
import { createLegacyWithSim } from './helpers'

test('user adds a sim to an existing legacy', async ({ page }) => {
  await test.step('create a legacy with a founder', async () => {
    await createLegacyWithSim(page, 'Add Sim Test')
    await expect(page.getByTestId('roster').getByRole('link', { name: /Bella Goth/ })).toBeVisible()
  })

  await test.step('add a second sim from the legacy page', async () => {
    await page.getByRole('link', { name: 'Add sim' }).click()
    await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/new$/)

    await page.getByPlaceholder('First name').fill('Don')
    await page.getByPlaceholder('Last name').fill('Lothario')
    await page.getByLabel('Gender').click()
    await page.getByRole('option', { name: 'Male', exact: true }).click()
    await page.getByRole('button', { name: 'Add sim' }).click()
  })

  await test.step('see both sims in the legacy roster', async () => {
    await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)
    await expect(page.getByTestId('roster').getByRole('link', { name: /Bella Goth/ })).toBeVisible()
    await expect(page.getByTestId('roster').getByRole('link', { name: /Don Lothario/ })).toBeVisible()
  })
})
