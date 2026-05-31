import { readFile } from 'fs/promises'
import { basename, join } from 'path'
import { fileTypeFromBuffer } from 'file-type'
import { db } from '../src/server/db'
import { putObject } from '../src/lib/storage'

interface BackfillOptions {
  sourceDir: string
  dryRun: boolean
}

interface BackfillSummary {
  migrated: number
  skipped: number
  unrecoverable: string[]
}

const OLD_PREFIX = '/uploads/'

async function migrateRow(
  imageUrl: string,
  userId: string,
  options: BackfillOptions,
  summary: BackfillSummary,
): Promise<string | null> {
  if (!imageUrl.startsWith(OLD_PREFIX)) {
    summary.skipped += 1
    return null
  }

  const filename = basename(imageUrl)
  let bytes: Buffer
  try {
    bytes = await readFile(join(options.sourceDir, filename))
  } catch {
    summary.unrecoverable.push(imageUrl)
    return null
  }

  const key = `uploads/${userId}/${filename}`
  const newUrl = `/media/${key}`

  if (options.dryRun) {
    console.log(`[dry-run] would migrate ${imageUrl} -> ${newUrl}`)
    summary.migrated += 1
    return null
  }

  const detected = await fileTypeFromBuffer(bytes)
  await putObject(key, bytes, detected?.mime ?? 'application/octet-stream')
  summary.migrated += 1
  return newUrl
}

export async function runBackfill(options: BackfillOptions): Promise<BackfillSummary> {
  const summary: BackfillSummary = { migrated: 0, skipped: 0, unrecoverable: [] }

  const legacies = await db.legacy.findMany({
    where: { imageUrl: { startsWith: OLD_PREFIX } },
    select: { id: true, imageUrl: true, userId: true },
  })
  for (const row of legacies) {
    if (!row.imageUrl) continue
    const newUrl = await migrateRow(row.imageUrl, row.userId, options, summary)
    if (newUrl) {
      await db.legacy.update({ where: { id: row.id }, data: { imageUrl: newUrl } })
    }
  }

  const sims = await db.sim.findMany({
    where: { imageUrl: { startsWith: OLD_PREFIX } },
    select: { id: true, imageUrl: true, legacy: { select: { userId: true } } },
  })
  for (const row of sims) {
    if (!row.imageUrl) continue
    const newUrl = await migrateRow(row.imageUrl, row.legacy.userId, options, summary)
    if (newUrl) {
      await db.sim.update({ where: { id: row.id }, data: { imageUrl: newUrl } })
    }
  }

  const packs = await db.pack.findMany({
    where: { imageUrl: { startsWith: OLD_PREFIX } },
    select: { id: true, imageUrl: true },
  })
  for (const row of packs) {
    if (!row.imageUrl) continue
    const newUrl = await migrateRow(row.imageUrl, 'unknown', options, summary)
    if (newUrl) {
      await db.pack.update({ where: { id: row.id }, data: { imageUrl: newUrl } })
    }
  }

  return summary
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const sourceDir = process.env.SOURCE_UPLOAD_DIR ?? join(process.cwd(), 'public', 'uploads')
  console.log(`Backfilling from ${sourceDir}${dryRun ? ' (dry-run)' : ''}`)
  const summary = await runBackfill({ sourceDir, dryRun })
  console.log(
    `Done. migrated=${summary.migrated} skipped=${summary.skipped} unrecoverable=${summary.unrecoverable.length}`,
  )
  if (summary.unrecoverable.length > 0) {
    console.log('Unrecoverable (no source file found):')
    for (const url of summary.unrecoverable) console.log(`  ${url}`)
  }
  await db.$disconnect()
}

const isDirectRun = process.argv[1]?.includes('backfill-uploads-to-s3')
if (isDirectRun) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
