import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a legacy via the wizard and land on the legacy detail page.
 *  Returns the legacy page URL. */
async function createLegacyWithFounder(
  page: import('@playwright/test').Page,
  founderFirst: string,
  founderLast: string,
  legacyPrefix: string = 'Milestones E2E',
) {
  await page.goto('/app/legacies/new')
  await page.waitForLoadState('networkidle')

  // Use a combination of timestamp + random to avoid parallel-test name collisions.
  const legacyName = `${legacyPrefix} ${Date.now()}-${Math.floor(Math.random() * 100000)}`
  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
  await page.getByRole('button', { name: 'Continue →' }).click()

  await page.getByPlaceholder('First name').fill(founderFirst)
  await page.getByPlaceholder('Last name').fill(founderLast)
  await page.getByLabel('Gender').click()
  await page.getByRole('option', { name: 'Female' }).click()
  await page.getByRole('button', { name: 'Create legacy →' }).click()

  await expect(page).toHaveURL(/\/app\/legacies\/(?!new)[^/]+$/)
  return page.url()
}

/** Add a sim via /sims/new and return to the legacy page. */
async function addSim(
  page: import('@playwright/test').Page,
  legacyUrl: string,
  firstName: string,
  lastName: string,
) {
  await page.goto(legacyUrl)
  await page.getByRole('link', { name: 'Add sim' }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/new$/)

  await page.getByPlaceholder('First name').fill(firstName)
  await page.getByPlaceholder('Last name').fill(lastName)
  await page.getByLabel('Gender').click()
  await page.getByRole('option', { name: 'Female' }).click()
  await page.getByRole('button', { name: 'Add sim' }).click()

  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Legacy milestones', () => {
  /**
   * Birth-bug regression: a sim with an in-legacy parent gets an "is born" row;
   * a married-in adult with no in-legacy parent does NOT.
   */
  test('born sim gets "is born" milestone; married-in adult does not', async ({ page }) => {
    // 1. Create a legacy with Bella Goth as the founder.
    const legacyUrl = await createLegacyWithFounder(page, 'Bella', 'Goth')

    // 2. Add Don Lothario — a married-in adult (no in-legacy parent, no family relationship).
    await addSim(page, legacyUrl, 'Don', 'Lothario')

    // 3. Add Alice Goth — she will become Bella's child.
    await addSim(page, legacyUrl, 'Alice', 'Goth')

    // 4. Navigate to Bella's sim detail page via the roster.
    await page.goto(legacyUrl)
    await page.getByTestId('roster').getByRole('link', { name: /Bella Goth/ }).click()
    await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/[^/]+$/)

    // 5. Open "Add relationship" modal and add Alice as Bella's child.
    //    (default role is "This sim is the child" = Alice is the child, Bella is the parent)
    await page.getByRole('button', { name: /^\+ Add$/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Add relationship' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Family' }).click()

    // The sim combobox trigger button label is set to the selected value once picked.
    // Before selection, its accessible name is "Select sim".
    await page.getByRole('button', { name: 'Select sim' }).click()
    await page.getByText('Alice Goth').click()

    // Confirm role is "This sim is the child" (default) — Alice is Bella's child.
    // No need to change it; just confirm and add.
    await dialog.getByRole('button', { name: 'Add' }).click()
    await expect(dialog).not.toBeVisible()

    // 6. Navigate back to the legacy page and scroll to the Milestones section.
    await page.goto(legacyUrl)
    await page.locator('#milestones').scrollIntoViewIfNeeded()

    // Alice (in-legacy child of Bella) must have a "is born" row.
    await expect(page.getByText('Alice Goth is born')).toBeVisible()

    // Don (married-in adult, no in-legacy parent) must NOT have an "is born" row.
    await expect(page.getByText('Don Lothario is born')).toHaveCount(0)
  })

  /**
   * User can add a milestone, it appears in the timeline and persists after
   * a page reload, and can be deleted.
   */
  test('user can create a milestone that persists, then delete it', async ({ page }) => {
    const legacyUrl = await createLegacyWithFounder(page, 'Mortimer', 'Goth', 'Milestone CRUD')

    await page.goto(legacyUrl)
    await page.locator('#milestones').scrollIntoViewIfNeeded()

    // Open the composer and create a milestone.
    await page.getByRole('button', { name: /\+ Add milestone/i }).click()
    await page.getByLabel('Title').fill('The back-porch truce')
    await page.getByRole('button', { name: 'Save milestone' }).click()

    // The new milestone should appear in the milestones timeline.
    const milestonesSection = page.locator('#milestones')
    await expect(milestonesSection.getByText('The back-porch truce')).toBeVisible()

    // Persists after a page reload.
    await page.reload()
    await page.locator('#milestones').scrollIntoViewIfNeeded()
    await expect(milestonesSection.getByText('The back-porch truce')).toBeVisible()

    // Deleting the milestone removes it from the timeline.
    await page.getByRole('button', { name: 'Delete The back-porch truce' }).click()
    await expect(milestonesSection.getByText('The back-porch truce')).toHaveCount(0)
  })

  /**
   * User can edit an existing user milestone: the new title replaces the old,
   * and the change persists after a reload.
   */
  test('user can edit a milestone title and the change persists', async ({ page }) => {
    const legacyUrl = await createLegacyWithFounder(page, 'Cassandra', 'Goth', 'Milestone Edit')

    await page.goto(legacyUrl)
    await page.locator('#milestones').scrollIntoViewIfNeeded()

    // Create a Note milestone.
    await page.getByRole('button', { name: /\+ Add milestone/i }).click()
    await page.getByLabel('Title').fill('Original title')
    await page.getByRole('button', { name: 'Save milestone' }).click()

    const milestonesSection = page.locator('#milestones')
    await expect(milestonesSection.getByText('Original title')).toBeVisible()

    // Click the Edit control for this milestone.
    await page.getByRole('button', { name: 'Edit Original title' }).click()

    // The composer opens pre-filled; clear and type the new title.
    const titleInput = page.getByRole('textbox', { name: 'Title' })
    await expect(titleInput).toHaveValue('Original title')
    await titleInput.clear()
    await titleInput.fill('Updated title')

    // Save the edit.
    await page.getByRole('button', { name: 'Save milestone' }).click()

    // The updated title should be visible; the old one should be gone.
    await expect(milestonesSection.getByText('Updated title')).toBeVisible()
    await expect(milestonesSection.getByText('Original title')).toHaveCount(0)

    // Change persists after a page reload.
    await page.reload()
    await page.locator('#milestones').scrollIntoViewIfNeeded()
    await expect(milestonesSection.getByText('Updated title')).toBeVisible()
    await expect(milestonesSection.getByText('Original title')).toHaveCount(0)
  })

  /**
   * Drag-reorder is covered at the unit level by the neighborSortOrders tests
   * in milestones-client.test.tsx. Keyboard-based dnd-kit reorder is not
   * included here because Playwright's synthetic keyboard events do not reliably
   * trigger dnd-kit's KeyboardSensor lift/move/drop cycle in a headed browser,
   * making any such test inherently flaky.
   */
})
