// scripts/setup-test-db.ts
import { config } from 'dotenv'
// Load the test DB connection BEFORE anything reads process.env. Mirrors
// vitest.config.ts. dotenv does not override existing process.env, so the
// value below also takes precedence over Prisma's automatic .env load.
config({ path: '.env.test' })

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, relative } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const ROOT = process.cwd()
const PRISMA_DIR = join(ROOT, 'prisma')
const MIGRATIONS_DIR = join(PRISMA_DIR, 'migrations')
const STAMP_DIR = join(ROOT, 'node_modules', '.cache')

/** Database name parsed from the connection string (e.g. `simstrack_test`). */
function databaseName(connectionString: string): string {
  const name = decodeURIComponent(new URL(connectionString).pathname.replace(/^\//, '').split('/')[0])
  if (!name) throw new Error('Could not parse a database name from DATABASE_URL')
  return name
}

/** Per-database stamp file, so different test DBs never share a stamp. */
function stampFilePath(dbName: string): string {
  return join(STAMP_DIR, `test-db-${dbName}.json`)
}

/**
 * Standing consent so `prisma migrate reset` can run unattended against the
 * pinned test DB only (Prisma 7 AI-action guard). The DB name is taken from
 * DATABASE_URL, never hardcoded.
 */
function consentString(dbName: string): string {
  return `Standing user consent to reset the local ${dbName} database via this test-only script (pinned to .env.test).`
}

interface ResetDecisionInput {
  force: boolean
  stampHash: string | null
  currentHash: string
  seeded: boolean
}

/**
 * Decide whether the test DB needs a reset + reseed. Returns the list of
 * human-readable reasons; empty means skip. The empty-DB reason is only
 * considered when no cheaper reason already triggered a reset, so the caller
 * can avoid the (slower) DB probe.
 */
function decideReset(input: ResetDecisionInput): string[] {
  const reasons: string[] = []
  if (input.force) reasons.push('forced (--force)')
  if (input.stampHash === null) reasons.push('no previous test-db stamp')
  else if (input.stampHash !== input.currentHash) reasons.push('schema/migrations/seed changed')
  if (reasons.length === 0 && !input.seeded) reasons.push('test database is empty or unreachable')
  return reasons
}

function collectHashInputs(): string[] {
  const files = [join(PRISMA_DIR, 'schema.prisma'), join(PRISMA_DIR, 'seed.ts')]
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else files.push(full)
    }
  }
  if (existsSync(MIGRATIONS_DIR)) walk(MIGRATIONS_DIR)
  return files.filter(existsSync).sort()
}

function computeInputsHash(): string {
  const hash = createHash('sha256')
  for (const file of collectHashInputs()) {
    hash.update(relative(ROOT, file))
    hash.update('\0')
    hash.update(readFileSync(file))
    hash.update('\0')
  }
  return hash.digest('hex')
}

function readStampHash(stampFile: string): string | null {
  if (!existsSync(stampFile)) return null
  try {
    const parsed = JSON.parse(readFileSync(stampFile, 'utf8')) as { hash?: string }
    return parsed.hash ?? null
  } catch {
    return null
  }
}

function writeStamp(stampFile: string, hash: string): void {
  mkdirSync(STAMP_DIR, { recursive: true })
  writeFileSync(stampFile, `${JSON.stringify({ hash }, null, 2)}\n`)
}

/** Cheap probe: is the test DB reachable and does it have seeded reference data? */
async function isDbSeeded(connectionString: string): Promise<boolean> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  try {
    return (await prisma.pack.count()) > 0
  } catch {
    return false
  } finally {
    try {
      await prisma.$disconnect()
    } catch {
      // Ignore teardown errors — we only care whether the probe query succeeded.
    }
  }
}

function runResetAndSeed(consent: string): void {
  const prismaBin = join(ROOT, 'node_modules', '.bin', 'prisma')
  const env = { ...process.env, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: consent }
  execFileSync(prismaBin, ['migrate', 'reset', '--force'], { stdio: 'inherit', env })
  execFileSync(prismaBin, ['db', 'seed'], { stdio: 'inherit', env })
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set (expected from .env.test)')
  const dbName = databaseName(connectionString)
  // Safety net: this script runs a destructive `migrate reset`. Refuse any DB
  // whose name doesn't look like a test database, in case DATABASE_URL was
  // injected (e.g. in CI) to point somewhere other than `.env.test`.
  if (!dbName.includes('test')) {
    throw new Error(
      `Refusing to reset "${dbName}": setup-test-db only operates on test databases (name must contain "test").`,
    )
  }
  const stampFile = stampFilePath(dbName)

  const force = process.argv.includes('--force')
  const currentHash = computeInputsHash()
  const stampHash = readStampHash(stampFile)

  // Decide using cheap inputs first; only run the (slower) DB probe when no
  // cheaper reason already forces a reset.
  const needsResetWithoutProbe =
    decideReset({ force, stampHash, currentHash, seeded: true }).length > 0
  const seeded = needsResetWithoutProbe || (await isDbSeeded(connectionString))
  const reasons = decideReset({ force, stampHash, currentHash, seeded })

  if (reasons.length === 0) {
    console.log(`[test-db] ${dbName} up to date — skipping reset/seed`)
    return
  }

  console.log(`[test-db] resetting ${dbName}: ${reasons.join('; ')}`)
  runResetAndSeed(consentString(dbName))
  writeStamp(stampFile, currentHash)
  console.log(`[test-db] ${dbName} reset + seed complete`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
