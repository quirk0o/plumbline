import { test, expect } from '@playwright/test'

test('user can create a legacy with a founder sim', async ({ page }) => {
  await page.goto('/app')
  await page.waitForLoadState('networkidle')

  await page.getByRole('link', { name: '+ Start a legacy' }).click()
  await expect(page).toHaveURL('/app/legacies/new')
  await expect(page.getByRole('heading', { name: 'Your Legacy' })).toBeVisible()

  const legacyName = `Test Legacy ${Date.now()}`
  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
  await page.getByRole('button', { name: 'Continue →' }).click()

  await expect(page.getByRole('heading', { name: 'Founder Sim' })).toBeVisible()

  await page.getByPlaceholder('First name').fill('Alice')
  await page.getByPlaceholder('Last name').fill('Sim')
  await page.getByLabel('Gender').click()
  await page.getByRole('option', { name: 'Female' }).click()

  await page.getByRole('button', { name: 'Create legacy →' }).click()

  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)
  await expect(page.getByRole('heading', { name: legacyName })).toBeVisible()
  await expect(page.getByTestId('roster').getByRole('listitem').getByText('Alice Sim')).toBeVisible()
})

test('user can create a legacy and skip the founder sim', async ({ page }) => {
  await page.goto('/app/legacies/new')
  await expect(page.getByRole('heading', { name: 'Your Legacy' })).toBeVisible()

  const legacyName = `Skipfounder Legacy ${Date.now()}`
  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
  await page.getByRole('button', { name: 'Continue →' }).click()

  await expect(page.getByRole('heading', { name: 'Founder Sim' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip →' }).click()

  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)
  await expect(page.getByRole('heading', { name: legacyName })).toBeVisible()
  await expect(
    page
      .getByTestId('roster')
      .getByRole('heading', { name: /No Sims\s+named\s+yet\./i }),
  ).toBeVisible()
})

test('step 1 shows a validation error when legacy name is empty', async ({ page }) => {
  await page.goto('/app/legacies/new')
  await expect(page.getByRole('heading', { name: 'Your Legacy' })).toBeVisible()

  await page.getByRole('button', { name: 'Continue →' }).click()

  await expect(page.getByText('Legacy name is required')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your Legacy' })).toBeVisible()
})

test('step 2 shows validation errors when required sim fields are missing', async ({ page }) => {
  await page.goto('/app/legacies/new')

  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(`Validation Test ${Date.now()}`)
  await page.getByRole('button', { name: 'Continue →' }).click()

  await expect(page.getByRole('heading', { name: 'Founder Sim' })).toBeVisible()

  await page.getByRole('button', { name: 'Create legacy →' }).click()

  await expect(page.getByText('First name is required')).toBeVisible()
  await expect(page.getByText('Last name is required')).toBeVisible()
  await expect(page.getByText('Gender is required')).toBeVisible()
})

test('back button on step 2 returns to step 1 with legacy name intact', async ({ page }) => {
  await page.goto('/app/legacies/new')
  await expect(page.getByRole('heading', { name: 'Your Legacy' })).toBeVisible()

  const legacyName = `Back Button Legacy ${Date.now()}`
  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
  await page.getByRole('button', { name: 'Continue →' }).click()

  await expect(page.getByRole('heading', { name: 'Founder Sim' })).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()

  await expect(page.getByRole('heading', { name: 'Your Legacy' })).toBeVisible()
  await expect(page.getByPlaceholder('e.g. The Caliente Legacy')).toHaveValue(legacyName)
})
