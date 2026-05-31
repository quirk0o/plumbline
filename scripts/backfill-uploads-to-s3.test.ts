import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { db } from '../src/server/db'
import { runBackfill } from './backfill-uploads-to-s3'

const s3Mock = mockClient(S3Client)
const USER_ID = 'backfill-test-user'

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
)

let sourceDir: string

async function cleanupDb() {
  await db.pack.deleteMany({ where: { code: 'TESTPACK' } })
  await db.sim.deleteMany({ where: { legacy: { userId: USER_ID } } })
  await db.legacy.deleteMany({ where: { userId: USER_ID } })
  await db.user.deleteMany({ where: { id: USER_ID } })
}

beforeEach(async () => {
  s3Mock.reset()
  s3Mock.on(PutObjectCommand).resolves({})
  sourceDir = mkdtempSync(join(tmpdir(), 'backfill-'))
  await cleanupDb()
  await db.user.create({ data: { id: USER_ID, email: 'backfill@example.com' } })
})

afterEach(async () => {
  rmSync(sourceDir, { recursive: true, force: true })
  await cleanupDb()
})

describe('runBackfill', () => {
  it('migrates a Legacy image and rewrites the row, copying userId', async () => {
    writeFileSync(join(sourceDir, 'cover.png'), PNG_BYTES)
    const legacy = await db.legacy.create({
      data: { name: 'L', slug: 'l', userId: USER_ID, imageUrl: '/uploads/cover.png' },
    })

    const summary = await runBackfill({ sourceDir, dryRun: false })

    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input.Key).toBe(`uploads/${USER_ID}/cover.png`)
    const updated = await db.legacy.findUnique({ where: { id: legacy.id } })
    expect(updated?.imageUrl).toBe(`/media/uploads/${USER_ID}/cover.png`)
    expect(summary.migrated).toBe(1)
  })

  it('resolves userId for a Sim via its legacy', async () => {
    writeFileSync(join(sourceDir, 'face.png'), PNG_BYTES)
    const legacy = await db.legacy.create({
      data: { name: 'L', slug: 'l2', userId: USER_ID },
    })
    const sim = await db.sim.create({
      data: {
        firstName: 'A', lastName: 'B', legacyId: legacy.id,
        lifeStage: 'ADULT', gender: 'FEMALE', imageUrl: '/uploads/face.png',
      },
    })

    await runBackfill({ sourceDir, dryRun: false })

    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls[0].args[0].input.Key).toBe(`uploads/${USER_ID}/face.png`)
    const updated = await db.sim.findUnique({ where: { id: sim.id } })
    expect(updated?.imageUrl).toBe(`/media/uploads/${USER_ID}/face.png`)
  })

  it('reports unrecoverable rows when the source file is missing and leaves them unchanged', async () => {
    const legacy = await db.legacy.create({
      data: { name: 'L', slug: 'l3', userId: USER_ID, imageUrl: '/uploads/gone.png' },
    })

    const summary = await runBackfill({ sourceDir, dryRun: false })

    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0)
    expect(summary.unrecoverable).toContain('/uploads/gone.png')
    const unchanged = await db.legacy.findUnique({ where: { id: legacy.id } })
    expect(unchanged?.imageUrl).toBe('/uploads/gone.png')
  })

  it('is idempotent: a /media row is skipped with no further uploads', async () => {
    await db.legacy.create({
      data: { name: 'L', slug: 'l4', userId: USER_ID, imageUrl: `/media/uploads/${USER_ID}/x.png` },
    })

    const summary = await runBackfill({ sourceDir, dryRun: false })

    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0)
    expect(summary.migrated).toBe(0)
  })

  it('dry-run uploads nothing and does not modify rows', async () => {
    writeFileSync(join(sourceDir, 'dry.png'), PNG_BYTES)
    const legacy = await db.legacy.create({
      data: { name: 'L', slug: 'l5', userId: USER_ID, imageUrl: '/uploads/dry.png' },
    })

    await runBackfill({ sourceDir, dryRun: true })

    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0)
    const unchanged = await db.legacy.findUnique({ where: { id: legacy.id } })
    expect(unchanged?.imageUrl).toBe('/uploads/dry.png')
  })

  it('migrates a Pack image under the unknown namespace', async () => {
    writeFileSync(join(sourceDir, 'pack.png'), PNG_BYTES)
    const pack = await db.pack.create({
      data: { name: 'Test Pack', type: 'EXPANSION', code: 'TESTPACK', imageUrl: '/uploads/pack.png' },
    })

    await runBackfill({ sourceDir, dryRun: false })

    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls.some((c) => c.args[0].input.Key === 'uploads/unknown/pack.png')).toBe(true)
    const updated = await db.pack.findUnique({ where: { id: pack.id } })
    expect(updated?.imageUrl).toBe('/media/uploads/unknown/pack.png')
  })
})
