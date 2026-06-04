import { test, expect } from '@playwright/test'

async function createLegacyWithTwoSims(page: import('@playwright/test').Page) {
  await page.goto('/app/legacies/new')

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
  await page.getByTestId('roster').getByRole('link', { name: /Bella Goth/ }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/[^/]+$/)
}

test('user records relationships for a sim', async ({ page }) => {
  await test.step('create a legacy with two sims', async () => {
    await createLegacyWithTwoSims(page)
  })

  await test.step('add a partner relationship', async () => {
    await page.getByRole('button', { name: /^\+ Add$/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Add relationship' })
    await expect(dialog).toBeVisible()
    await page.getByRole('button', { name: 'Select sim' }).click()
    await page.getByRole('option', { name: /Mortimer Goth/ }).click()
    // The dialog closes optimistically before the mutation is flushed, so
    // dialog-close is not a commit signal — register the wait before clicking Add.
    const saved = page.waitForResponse((r) => r.url().includes('sims.addSocialRelationship') && r.ok())
    await dialog.getByRole('button', { name: 'Add' }).click()
    await expect(dialog).not.toBeVisible()
    await saved
  })

  await test.step('add a family relationship', async () => {
    await page.getByRole('button', { name: /^\+ Add$/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Add relationship' })
    await dialog.getByRole('button', { name: 'Family' }).click()
    await page.getByRole('button', { name: 'Select sim' }).click()
    await page.getByRole('option', { name: /Mortimer Goth/ }).click()
    const saved = page.waitForResponse((r) => r.url().includes('sims.addFamilyRelationship') && r.ok())
    await dialog.getByRole('button', { name: 'Add' }).click()
    await expect(dialog).not.toBeVisible()
    await saved
  })

  await test.step('reload and verify the relationships persist', async () => {
    await page.reload()
    await expect(page.getByTestId('relationships').getByText('Mortimer Goth').first()).toBeVisible()
  })
})
