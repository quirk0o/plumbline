import { test, expect } from '@playwright/test'

test('user can create a legacy with a founder sim', async ({ page }) => {
  const legacyName = `Test Legacy ${Date.now()}`

  await test.step('arrive at the wizard from the app home', async () => {
    await page.goto('/app')
    await page.getByRole('link', { name: '+ Start a legacy' }).click()
    await expect(page).toHaveURL('/app/legacies/new')
    await expect(page.getByRole('heading', { name: 'Your Legacy' })).toBeVisible()
  })

  await test.step('name the legacy and continue to step 2', async () => {
    await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
    await page.getByRole('button', { name: 'Continue →' }).click()
    await expect(page.getByRole('heading', { name: 'Founder Sim' })).toBeVisible()
  })

  await test.step('fill the founder and create the legacy', async () => {
    await page.getByPlaceholder('First name').fill('Alice')
    await page.getByPlaceholder('Last name').fill('Sim')
    await page.getByLabel('Gender').click()
    await page.getByRole('option', { name: 'Female' }).click()
    await page.getByRole('button', { name: 'Create legacy →' }).click()

    await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)
    await expect(page.getByRole('heading', { name: legacyName })).toBeVisible()
    await expect(page.getByTestId('roster').getByRole('listitem').getByText('Alice Sim')).toBeVisible()
  })
})

test('user can create a legacy and skip the founder sim', async ({ page }) => {
  const legacyName = `Skipfounder Legacy ${Date.now()}`

  await test.step('arrive at the wizard', async () => {
    await page.goto('/app/legacies/new')
    await expect(page.getByRole('heading', { name: 'Your Legacy' })).toBeVisible()
  })

  await test.step('name the legacy and continue', async () => {
    await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
    await page.getByRole('button', { name: 'Continue →' }).click()
    await expect(page.getByRole('heading', { name: 'Founder Sim' })).toBeVisible()
  })

  await test.step('skip the founder and land on the new legacy', async () => {
    await page.getByRole('button', { name: 'Skip →' }).click()
    await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)
    await expect(page.getByRole('heading', { name: legacyName })).toBeVisible()
  })
})
