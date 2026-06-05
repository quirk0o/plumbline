import { test, expect } from '@playwright/test'

test('household management journey: found, manage, move, set active', async ({ page }) => {
  // Arrange — a legacy whose founder settles into an auto-founded household
  await page.goto('/app/legacies/new')
  const legacyName = `Household Journey ${Date.now()}`
  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
  await page.getByRole('button', { name: 'Continue →' }).click()

  await page.getByPlaceholder('First name').fill('Dina')
  await page.getByPlaceholder('Last name').fill('Caliente')
  await page.getByLabel('Gender').click()
  await page.getByRole('option', { name: 'Female' }).click()
  await expect(
    page.getByRole('checkbox', { name: /Settle them into a household/i }),
  ).toBeChecked()
  await page.getByRole('button', { name: 'Create legacy →' }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)

  const households = page.getByTestId('households')

  await test.step('founder checkbox created the active household', async () => {
    await expect(households.getByText('Now playing')).toBeVisible()
    await expect(
      households.getByRole('heading', { name: 'The Caliente Household' }),
    ).toBeVisible()
  })

  await test.step('rename the household in the management drawer', async () => {
    await households.getByRole('button', { name: /Manage household/i }).click()
    await page.getByRole('button', { name: 'The Caliente Household' }).click()
    const nameInput = page.getByRole('textbox', { name: 'Household name' })
    await nameInput.fill('Caliente Villa')
    await nameInput.press('Enter')
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(households.getByRole('heading', { name: 'Caliente Villa' })).toBeVisible()
  })

  await test.step('found a second household, moving the founder in', async () => {
    await households.getByRole('button', { name: /Found a household/i }).click()
    await page.getByPlaceholder('Name your household').fill('Goth Manor')
    await page.getByRole('button', { name: /Dina Caliente — Caliente Villa/i }).click()
    await page.getByRole('button', { name: /Found the household/i }).click()

    // Founding opens the new household's drawer with Dina now resident
    const drawer = page.getByRole('dialog', { name: 'Goth Manor' })
    await expect(drawer.getByText('Dina Caliente')).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(households.getByRole('heading', { name: 'Goth Manor' })).toBeVisible()
  })

  await test.step('set the new household active — the featured card swaps', async () => {
    // The compact card's accessible name concatenates its contents, so match by substring.
    await households.getByRole('button', { name: /Goth Manor/ }).click()
    await page.getByRole('button', { name: 'Set as active' }).click()
    await page.getByRole('button', { name: 'Close' }).click()

    // Wait until Goth Manor is the FEATURED card (h3 inside the featured wrapper),
    // not just visible somewhere (the compact card also has a heading role).
    await expect(
      page.getByTestId('featured-household').getByRole('heading', { name: 'Goth Manor' }),
    ).toBeVisible()
    // The featured card now carries Goth Manor; Caliente Villa is in the grid
    await expect(
      page.getByTestId('featured-household').getByRole('button', { name: /Manage household/i }),
    ).toBeVisible()
  })

  await test.step('move the founder back out to unhoused', async () => {
    await page.getByTestId('featured-household').getByRole('button', { name: /Manage household/i }).click()
    await page.getByRole('button', { name: 'Move Dina to' }).click()
    await page.getByRole('option', { name: 'Unhoused' }).click()
    await expect(page.getByText(/This lot is empty/i)).toBeVisible()
  })
})
