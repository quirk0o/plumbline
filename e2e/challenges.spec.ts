import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'e2e-test@simtrack.test'
const STAMP = Date.now()
const CHALLENGE_NAME = `Decennial Legacy ${STAMP}`
const DECOY_NAME = `Aquarium Keeper ${STAMP}`
const LEGACY_NAME = `Challenge Runners ${STAMP}`
const LEGACY_SLUG = `challenge-runners-${STAMP}`

let db: PrismaClient
let challengeId: string
let decoyId: string

test.beforeAll(async () => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  db = new PrismaClient({ adapter })
  const user = await db.user.findUniqueOrThrow({ where: { email: TEST_EMAIL } })

  const challenge = await db.challenge.create({
    data: {
      name: CHALLENGE_NAME,
      description: 'Ten generations of end-to-end verification.',
      isPublic: true,
      phases: {
        create: [
          { generationNumber: 1, title: 'The Founder', sortOrder: 0 },
          { generationNumber: 2, sortOrder: 1 },
        ],
      },
    },
  })
  challengeId = challenge.id

  const decoy = await db.challenge.create({
    data: { name: DECOY_NAME, isPublic: true },
  })
  decoyId = decoy.id

  await db.legacy.create({
    data: { name: LEGACY_NAME, slug: LEGACY_SLUG, userId: user.id },
  })
})

test.afterAll(async () => {
  await db.challengeRun.deleteMany({ where: { sourceChallengeId: challengeId } })
  await db.legacy.deleteMany({ where: { slug: LEGACY_SLUG } })
  await db.challenge.deleteMany({ where: { id: { in: [challengeId, decoyId] } } })
  await db.$disconnect()
})

test('user browses challenges, searches, and starts a run on their legacy', async ({ page }) => {
  await test.step('navigate to the challenges page from the nav', async () => {
    await page.goto('/app')
    await page.getByRole('link', { name: 'Challenges' }).click()
    await expect(page.getByRole('heading', { name: 'Challenges' })).toBeVisible()
    await expect(page.getByRole('heading', { name: CHALLENGE_NAME })).toBeVisible()
  })

  await test.step('the Mine tab shows the empty state', async () => {
    await page.getByRole('link', { name: 'Mine' }).click()
    await expect(page.getByText(/haven't created any challenges yet/i)).toBeVisible()
    await page.getByRole('link', { name: 'All', exact: true }).click()
    await expect(page.getByRole('heading', { name: CHALLENGE_NAME })).toBeVisible()
  })

  await test.step('search narrows the list', async () => {
    await page.getByRole('searchbox', { name: 'Search challenges' }).fill(`Decennial Legacy ${STAMP}`)
    await expect(page.getByRole('heading', { name: DECOY_NAME })).not.toBeVisible()
    await expect(page.getByRole('heading', { name: CHALLENGE_NAME })).toBeVisible()
    await expect(page).toHaveURL(/q=Decennial/)
  })

  await test.step('open the challenge detail', async () => {
    await page.locator('a', { has: page.getByRole('heading', { name: CHALLENGE_NAME }) }).click()
    await expect(page.getByRole('heading', { name: CHALLENGE_NAME })).toBeVisible()
    await expect(page.getByText('Ten generations of end-to-end verification.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'The Founder' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Generation 2' })).toBeVisible()
  })

  await test.step('start a run on the legacy', async () => {
    await page.getByRole('button', { name: 'Start run' }).click()
    const dialog = page.getByRole('dialog', { name: 'Start run' })
    await dialog.getByRole('button', { name: 'Choose a legacy…' }).click()
    await page.getByRole('option', { name: LEGACY_NAME }).click()
    await dialog.getByRole('button', { name: 'Start run' }).click()
    await expect(page).toHaveURL(new RegExp(`/app/legacies/${LEGACY_SLUG}$`))
  })
})
