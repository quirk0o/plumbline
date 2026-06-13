import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestUser, cleanupUser, createTestTrackerType } from '@/test/helpers'
import { db } from '@/server/db'
import {
  getChallengeForView,
  listChallenges,
  normalizeQuery,
  normalizeTab,
} from './challengeBrowse'

// Challenge.ownerId is SetNull on user delete, so cleanupUser does NOT remove
// challenges — track and delete them explicitly.
const createdChallengeIds: string[] = []

// Unique per-run marker so assertions are immune to seed rows and parallel files.
const run = `browse-${Date.now()}`

async function makeChallenge(data: {
  name: string
  description?: string
  isPublic?: boolean
  ownerId?: string | null
}) {
  const challenge = await db.challenge.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      isPublic: data.isPublic ?? false,
      ownerId: data.ownerId ?? null,
    },
  })
  createdChallengeIds.push(challenge.id)
  return challenge
}

describe('listChallenges', () => {
  let userId: string
  let otherId: string

  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    ;({ id: otherId } = await createTestUser())
  })

  afterEach(async () => {
    await db.challenge.deleteMany({ where: { id: { in: createdChallengeIds } } })
    createdChallengeIds.length = 0
    await cleanupUser(userId)
    await cleanupUser(otherId)
  })

  it("returns own and public challenges, never others' private ones", async () => {
    const ownPrivate = await makeChallenge({ name: `${run} own private`, ownerId: userId })
    const ownPublic = await makeChallenge({ name: `${run} own public`, ownerId: userId, isPublic: true })
    const otherPublic = await makeChallenge({ name: `${run} other public`, ownerId: otherId, isPublic: true })
    const otherPrivate = await makeChallenge({ name: `${run} other private`, ownerId: otherId })

    const ids = (await listChallenges(userId)).map((c) => c.id)
    expect(ids).toContain(ownPrivate.id)
    expect(ids).toContain(ownPublic.id)
    expect(ids).toContain(otherPublic.id)
    expect(ids).not.toContain(otherPrivate.id)
  })

  it('tab=mine returns only own challenges', async () => {
    const ownPrivate = await makeChallenge({ name: `${run} mine a`, ownerId: userId })
    const ownPublic = await makeChallenge({ name: `${run} mine b`, ownerId: userId, isPublic: true })
    const otherPublic = await makeChallenge({ name: `${run} not mine`, ownerId: otherId, isPublic: true })

    const ids = (await listChallenges(userId, { tab: 'mine' })).map((c) => c.id)
    expect(ids).toContain(ownPrivate.id)
    expect(ids).toContain(ownPublic.id)
    expect(ids).not.toContain(otherPublic.id)
  })

  it('tab=public excludes own private challenges', async () => {
    const ownPrivate = await makeChallenge({ name: `${run} hidden`, ownerId: userId })
    const ownPublic = await makeChallenge({ name: `${run} shared`, ownerId: userId, isPublic: true })

    const ids = (await listChallenges(userId, { tab: 'public' })).map((c) => c.id)
    expect(ids).toContain(ownPublic.id)
    expect(ids).not.toContain(ownPrivate.id)
  })

  it('searches name and description case-insensitively', async () => {
    const byName = await makeChallenge({ name: `${run} Decennial Dynasty`, isPublic: true })
    const byDescription = await makeChallenge({
      name: `${run} plain`,
      description: 'A DECENNIAL undertaking',
      isPublic: true,
    })
    const noMatch = await makeChallenge({ name: `${run} unrelated`, isPublic: true })

    const ids = (await listChallenges(userId, { q: 'decennial' })).map((c) => c.id)
    expect(ids).toContain(byName.id)
    expect(ids).toContain(byDescription.id)
    expect(ids).not.toContain(noMatch.id)
  })

  it('orders by name and counts phases', async () => {
    const b = await makeChallenge({ name: `${run} Bravo`, ownerId: userId })
    const a = await makeChallenge({ name: `${run} Alpha`, ownerId: userId })
    await db.challengePhase.create({
      data: { challengeId: a.id, generationNumber: 1, sortOrder: 0 },
    })

    const results = await listChallenges(userId, { q: run, tab: 'mine' })
    expect(results.map((c) => c.id)).toEqual([a.id, b.id])
    expect(results[0]._count.phases).toBe(1)
    expect(results[1]._count.phases).toBe(0)
  })
})

describe('normalizeTab / normalizeQuery', () => {
  it('coerces invalid tab values to all', () => {
    expect(normalizeTab('mine')).toBe('mine')
    expect(normalizeTab('public')).toBe('public')
    expect(normalizeTab('banana')).toBe('all')
    expect(normalizeTab(undefined)).toBe('all')
    expect(normalizeTab(['mine'])).toBe('all')
  })

  it('trims query text and ignores non-strings', () => {
    expect(normalizeQuery('  legacy ')).toBe('legacy')
    expect(normalizeQuery(undefined)).toBe('')
    expect(normalizeQuery(['a'])).toBe('')
  })
})

describe('getChallengeForView', () => {
  let userId: string
  let otherId: string

  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    ;({ id: otherId } = await createTestUser())
  })

  afterEach(async () => {
    await db.challenge.deleteMany({ where: { id: { in: createdChallengeIds } } })
    createdChallengeIds.length = 0
    await cleanupUser(userId)
    await cleanupUser(otherId)
  })

  it('returns phases and trackers in sortOrder', async () => {
    const challenge = await makeChallenge({ name: `${run} ordered`, ownerId: userId })
    await db.challengePhase.create({
      data: { challengeId: challenge.id, title: 'Second', sortOrder: 1 },
    })
    const phase1 = await db.challengePhase.create({
      data: { challengeId: challenge.id, title: 'First', sortOrder: 0 },
    })
    const trackerType = await createTestTrackerType({ ownerId: userId })
    await db.trackerDefinition.create({
      data: { challengePhaseId: phase1.id, trackerTypeId: trackerType.id, name: 'Later goal', sortOrder: 1 },
    })
    await db.trackerDefinition.create({
      data: { challengePhaseId: phase1.id, trackerTypeId: trackerType.id, name: 'First goal', sortOrder: 0 },
    })

    const view = await getChallengeForView(userId, challenge.id)
    expect(view?.phases.map((p) => p.title)).toEqual(['First', 'Second'])
    expect(view?.phases[0].trackers.map((t) => t.name)).toEqual(['First goal', 'Later goal'])
  })

  it("returns null for another user's private challenge and for unknown ids", async () => {
    const otherPrivate = await makeChallenge({ name: `${run} secret`, ownerId: otherId })
    expect(await getChallengeForView(userId, otherPrivate.id)).toBeNull()
    expect(await getChallengeForView(userId, 'nonexistent-id')).toBeNull()
  })
})
