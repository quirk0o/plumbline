import { test, expect } from '@playwright/test'
import { createLegacyWithTwoSims } from './helpers'

test('user records relationships for a sim', async ({ page }) => {
  await test.step('create a legacy with two sims', async () => {
    await createLegacyWithTwoSims(page, 'Relationship Test')
  })

  await test.step('add a partner relationship with the Partner status', async () => {
    await page.getByRole('button', { name: /^\+ Add$/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Add relationship' })
    await page.getByRole('button', { name: 'Select sim' }).click()
    await page.getByRole('option', { name: /Mortimer Goth/ }).click()
    await dialog.getByRole('button', { name: 'Romantic status' }).click()
    await page.getByRole('option', { name: 'Partner', exact: true }).click()
    // The dialog closes optimistically before the mutation is flushed, so
    // dialog-close is not a commit signal — register the wait before clicking Add.
    // Note: tRPC batches procedures, so r.ok() reflects the HTTP envelope, not the
    // per-procedure result — the reload-verify step is the authoritative commit assertion.
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
    const relationships = page.getByTestId('relationships')
    await expect(relationships.getByText('Mortimer Goth').first()).toBeVisible()
    await expect(relationships.getByText('Partner', { exact: true }).first()).toBeVisible()
  })
})
