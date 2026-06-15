# Environment Validation & AUTH_TEST_MODE Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single Zod-validated environment module parsed at startup (fail fast) and make the E2E test-login provider impossible to enable in production.

**Architecture:** A new `src/server/env.ts` exports a `parseEnv()` function and a module-load `env` constant. The schema is a Zod discriminated union on `NODE_ENV` — a lenient development/test member and a strict production member — so each environment's requirements are expressed as their own schema rather than via cross-field refinement. S3 credentials are shared/required in every member; auth/email/OAuth secrets are required only in the production member, which also rejects `AUTH_TEST_MODE=true`. `db.ts`, `src/lib/storage.ts`, and `auth.ts` consume `env` instead of reading `process.env` with `?? ''` fallbacks — so a misconfiguration crashes at boot, not at request time. The root `auth.ts` registers the `test` credentials provider **only** when test mode is on, decided by a small pure `buildAuthProviders()` helper, replacing the old request-time `authorize` guard.

**Tech Stack:** TypeScript, Next.js 16, NextAuth (Auth.js v5), Zod 4.4, Vitest, `@aws-sdk/client-s3`.

---

## Background & Context (read before starting)

The finding (tech-debt H3):

- `src/lib/storage.ts` falls S3 credentials back to `''` (`accessKeyId: process.env.S3_ACCESS_KEY_ID ?? ''`), so a missing credential surfaces as a cryptic AWS error at upload time.
- `auth.ts` reads `RESEND_API_KEY`/`EMAIL_FROM`/`AUTH_SECRET` unchecked.
- The `test` Credentials provider is **always** registered in the providers array (`auth.ts:43`) and only neutralized by an `if (process.env.AUTH_TEST_MODE !== 'true') return null` inside `authorize` (`auth.ts:31`). One leaked env var in production turns it into passwordless login-as-anyone.

**Decisions locked in for this plan:**

1. **Validation scope:** S3_* required in *all* environments; `AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` required *in production only*. `AUTH_URL` optional. `AUTH_TEST_MODE` optional but forbidden in production.
2. **Fail-fast import points:** `db.ts`, `auth.ts`, and `src/lib/storage.ts` all consume `env`. `db.ts` is loaded on virtually every server request/RSC, giving the earliest possible startup failure; this also replaces its ad-hoc `DATABASE_URL` check.

**Codebase facts you need:**

- Zod is v4.4.2. Use the **top-level format validators** (`z.url()`), NOT the deprecated `z.string().url()`. Verified working: `z.url()`, `z.enum([...])`, `.superRefine()`, `.safeParse()`, and `ctx.addIssue({ code: 'custom', path: [...], message })`.
- `.env.test` (committed, used by Vitest and Playwright via `dotenv` in their configs) contains only `DATABASE_URL` and `S3_*` — **no** auth/email/OAuth secrets. The schema's production-only requirements MUST stay optional outside production or every test will fail to boot.
- Vitest sets `NODE_ENV=test`. The Playwright dev server (`npm run dev:test`) runs `next dev` → `NODE_ENV=development` with `AUTH_TEST_MODE=true`. `next build`/`start` → `NODE_ENV=production`.
- `src/lib/storage.test.ts` asserts the bucket is `simtrack-test`, which comes from `.env.test`'s `S3_BUCKET`. After the refactor the bucket comes from `env.S3_BUCKET`, which is parsed from the same `process.env`, so the value is unchanged.
- **No lint/TS suppressions are allowed** anywhere in this codebase (`// eslint-disable`, `// @ts-ignore`, `// @ts-expect-error`, etc.). Fix the root cause instead.
- **Never use `cd`** in commands; run from the working directory `/Users/beatka/Projects/simstrack-526` and pass paths directly.
- **Git/GitButler operations are the orchestrator's job, performed via the `/but` skill (GitButler `but`), never raw `git`, and never by a subagent.** Commit steps below say what to commit and the conventional-commit message; the orchestrator executes them.

## File Structure

- **Create** `src/server/env.ts` — the Zod env schema + `parseEnv()` + the module-load `env` constant. One responsibility: validate and expose configuration.
- **Create** `src/server/env.test.ts` — unit tests for `parseEnv()` (genuinely complex isolated logic → a unit test is justified under the Testing Trophy).
- **Create** `src/server/auth-providers.ts` — a pure `buildAuthProviders()` helper that decides which providers are registered. Isolating it keeps the security-critical "test provider only in test mode" rule unit-testable without booting NextAuth.
- **Create** `src/server/auth-providers.test.ts` — unit tests for `buildAuthProviders()`.
- **Modify** `src/server/db.ts` — replace the inline `DATABASE_URL` check with `env.DATABASE_URL`.
- **Modify** `src/lib/storage.ts` — read S3 config from `env`, drop the `?? ''` fallbacks.
- **Modify** `auth.ts` — email provider secrets from `env`; register `test` provider via `buildAuthProviders()` only when `env.AUTH_TEST_MODE === 'true'`; remove the now-redundant request-time guard.

---

## Task 1: The environment module

**Files:**
- Create: `src/server/env.ts`
- Test: `src/server/env.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/env.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseEnv } from './env'

// A complete, valid production environment. Tests clone and mutate this to
// exercise one rule at a time.
function validProdEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    S3_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
    S3_REGION: 'auto',
    S3_ACCESS_KEY_ID: 'access-key',
    S3_SECRET_ACCESS_KEY: 'secret-key',
    S3_BUCKET: 'simtrack-prod',
    AUTH_SECRET: 'a-very-long-secret',
    AUTH_GOOGLE_ID: 'google-client-id',
    AUTH_GOOGLE_SECRET: 'google-client-secret',
    RESEND_API_KEY: 're_123',
    EMAIL_FROM: 'noreply@example.com',
  }
}

describe('parseEnv', () => {
  it('accepts a complete production environment', () => {
    const env = parseEnv(validProdEnv())
    expect(env.NODE_ENV).toBe('production')
    expect(env.S3_BUCKET).toBe('simtrack-prod')
    expect(env.AUTH_SECRET).toBe('a-very-long-secret')
  })

  it('defaults NODE_ENV to development when absent', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgresql://localhost/db',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'minioadmin',
      S3_SECRET_ACCESS_KEY: 'minioadmin',
      S3_BUCKET: 'simtrack-dev',
    })
    expect(env.NODE_ENV).toBe('development')
  })

  it('does NOT require auth/email/oauth secrets outside production', () => {
    // Mirrors .env.test: only DATABASE_URL + S3_* are set.
    expect(() =>
      parseEnv({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://localhost/test',
        S3_ENDPOINT: 'http://localhost:9000',
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY_ID: 'minioadmin',
        S3_SECRET_ACCESS_KEY: 'minioadmin',
        S3_BUCKET: 'simtrack-test',
      }),
    ).not.toThrow()
  })

  it('requires S3 credentials in every environment', () => {
    const env = validProdEnv()
    env.NODE_ENV = 'development'
    delete env.S3_BUCKET
    expect(() => parseEnv(env)).toThrow(/S3_BUCKET/)
  })

  it('rejects a missing DATABASE_URL', () => {
    const env = validProdEnv()
    delete env.DATABASE_URL
    expect(() => parseEnv(env)).toThrow(/DATABASE_URL/)
  })

  it('rejects an S3_ENDPOINT that is not a URL', () => {
    const env = validProdEnv()
    env.S3_ENDPOINT = 'not-a-url'
    expect(() => parseEnv(env)).toThrow(/S3_ENDPOINT/)
  })

  it('requires AUTH_SECRET in production', () => {
    const env = validProdEnv()
    delete env.AUTH_SECRET
    expect(() => parseEnv(env)).toThrow(/AUTH_SECRET/)
  })

  it('requires RESEND_API_KEY and EMAIL_FROM in production', () => {
    const noResend = validProdEnv()
    delete noResend.RESEND_API_KEY
    expect(() => parseEnv(noResend)).toThrow(/RESEND_API_KEY/)

    const noFrom = validProdEnv()
    delete noFrom.EMAIL_FROM
    expect(() => parseEnv(noFrom)).toThrow(/EMAIL_FROM/)
  })

  it('requires Google OAuth credentials in production', () => {
    const noId = validProdEnv()
    delete noId.AUTH_GOOGLE_ID
    expect(() => parseEnv(noId)).toThrow(/AUTH_GOOGLE_ID/)

    const noSecret = validProdEnv()
    delete noSecret.AUTH_GOOGLE_SECRET
    expect(() => parseEnv(noSecret)).toThrow(/AUTH_GOOGLE_SECRET/)
  })

  it('hard-fails when AUTH_TEST_MODE is enabled in production', () => {
    const env = validProdEnv()
    env.AUTH_TEST_MODE = 'true'
    expect(() => parseEnv(env)).toThrow(/AUTH_TEST_MODE/)
  })

  it('rejects ANY truthy AUTH_TEST_MODE form in production, not just "true"', () => {
    for (const truthy of ['1', 'yes', 'on']) {
      const env = validProdEnv()
      env.AUTH_TEST_MODE = truthy
      expect(() => parseEnv(env), `AUTH_TEST_MODE=${truthy}`).toThrow(/AUTH_TEST_MODE/)
    }
  })

  it('parses AUTH_TEST_MODE to a boolean and defaults it to false', () => {
    const enabled = parseEnv({
      NODE_ENV: 'development',
      AUTH_TEST_MODE: 'true',
      DATABASE_URL: 'postgresql://localhost/db',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'minioadmin',
      S3_SECRET_ACCESS_KEY: 'minioadmin',
      S3_BUCKET: 'simtrack-dev',
    })
    expect(enabled.AUTH_TEST_MODE).toBe(true)

    const unset = parseEnv({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost/db',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'minioadmin',
      S3_SECRET_ACCESS_KEY: 'minioadmin',
      S3_BUCKET: 'simtrack-dev',
    })
    expect(unset.AUTH_TEST_MODE).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/server/env.test.ts`
Expected: FAIL — `Failed to resolve import "./env"` (the module does not exist yet).

- [ ] **Step 3: Write the env module**

Create `src/server/env.ts`.

The schema is a **discriminated union on `NODE_ENV`**: each environment gets its own object schema, so the per-environment requirements live in the type system rather than in a cross-field `superRefine`. The shared fields (database + S3, required everywhere) are factored into one base schema, and each member is built with `.extend()`. Production additionally requires the auth/email/OAuth secrets (non-optional) and rejects any truthy `AUTH_TEST_MODE` via a field-level `.refine`.

`AUTH_TEST_MODE` is parsed with `z.stringbool()`, so `env.AUTH_TEST_MODE` is a real `boolean` (defaulting to `false` when unset). This is deliberate: exposing a string would let a downstream truthiness check (`if (env.AUTH_TEST_MODE)`) treat `"false"` — or any non-empty string — as enabled. Casting to a boolean removes that footgun, and because `z.stringbool()` recognizes every common truthy form (`true`/`1`/`yes`/`on`), the production `.refine` rejects all of them, not just the literal `"true"`.

```ts
import { z } from 'zod'

// Required in every environment: the database and S3-compatible object storage
// (MinIO in dev, R2 in prod). Image uploads work in all environments, so the
// S3 credentials are never optional.
const sharedEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  AUTH_URL: z.url().optional(),
})

// Development and test are lenient: auth/email/OAuth secrets are absent from
// local setups and from .env.test, and AUTH_TEST_MODE may be enabled.
const developmentEnvSchema = sharedEnvSchema.extend({
  NODE_ENV: z.literal('development'),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  // Parsed to a real boolean (defaults to false when unset) so downstream
  // truthiness checks can't be fooled by a stray string like "false".
  AUTH_TEST_MODE: z.stringbool().optional().default(false),
})

// Test is identical to development except for the discriminator.
const testEnvSchema = developmentEnvSchema.extend({
  NODE_ENV: z.literal('test'),
})

// Production is strict: every auth/email/OAuth secret is required, and the
// passwordless E2E login flag must never be enabled.
const productionEnvSchema = sharedEnvSchema.extend({
  NODE_ENV: z.literal('production'),
  AUTH_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  // Reject ANY truthy form ("true", "1", "yes", "on", …), not just "true".
  AUTH_TEST_MODE: z
    .stringbool()
    .optional()
    .default(false)
    .refine((enabled) => enabled === false, {
      message: 'AUTH_TEST_MODE must never be enabled in production',
    }),
})

const envSchema = z.discriminatedUnion('NODE_ENV', [
  developmentEnvSchema,
  testEnvSchema,
  productionEnvSchema,
])

export type Env = z.infer<typeof envSchema>

/**
 * Validates a raw environment record against the schema, throwing a readable
 * aggregate error if anything is missing or malformed. Exported separately
 * from `env` so it can be unit-tested with crafted inputs.
 *
 * NODE_ENV is normalized to 'development' when absent before discrimination —
 * a discriminated union needs the discriminator present to pick a member.
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse({
    ...source,
    NODE_ENV: source.NODE_ENV ?? 'development',
  })
  if (result.success) return result.data

  const details = result.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid environment variables:\n${details}`)
}

// Parsed once at module load. Importing this module anywhere in the server
// boot path turns a misconfiguration into an immediate startup crash instead
// of a cryptic runtime error later.
export const env = parseEnv(process.env)
```

Note: `Env` is now a union of three member types. The fields the consumers touch (`NODE_ENV`, `DATABASE_URL`, `S3_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `AUTH_TEST_MODE`) exist on every member, so they are accessible on the union. A bonus of the union: inside the `env.NODE_ENV === 'production'` branch in `auth.ts` (Task 4), TypeScript narrows `env` to the production member, so `env.RESEND_API_KEY`/`env.EMAIL_FROM` are typed as `string` (not `string | undefined`) exactly where they're guaranteed present.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/env.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors, no warnings.

- [ ] **Step 6: Commit** *(orchestrator only, via the `/but` skill — never raw git, never a subagent)*

Commit `src/server/env.ts` and `src/server/env.test.ts` with message:

```
feat(env): add fail-fast Zod environment validation module
```

---

## Task 2: Consume `env` in the Prisma client (earliest fail-fast point)

**Files:**
- Modify: `src/server/db.ts:8-10`

`db.ts` is imported on nearly every server request and RSC, so validating env here gives the earliest startup failure.

- [ ] **Step 1: Replace the inline DATABASE_URL check**

In `src/server/db.ts`, change the imports and `createPrismaClient`.

Current `db.ts`:

```ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

declare global {
  var prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL environment variable is not set')
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const db = global.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = db
```

Replace with:

```ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { env } from './env'

declare global {
  var prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const db = global.prisma ?? createPrismaClient()

if (env.NODE_ENV !== 'production') global.prisma = db
```

- [ ] **Step 2: Run the integration tests that exercise the DB client**

Run: `npx vitest run src/server/routers/packs.test.ts`
Expected: PASS — the DB client still connects using `env.DATABASE_URL` from `.env.test`.

(If this errors with a connection failure, ensure Postgres is up and `npm run db:test:setup` has run — that is environment setup, not a code defect.)

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors, no warnings.

- [ ] **Step 4: Commit** *(orchestrator only, via the `/but` skill)*

Commit `src/server/db.ts` with message:

```
refactor(db): source DATABASE_URL from validated env module
```

---

## Task 3: Consume `env` in the storage wrapper (drop the `?? ''` fallbacks)

**Files:**
- Modify: `src/lib/storage.ts:1-17`
- Test (existing, must still pass): `src/lib/storage.test.ts`

- [ ] **Step 1: Confirm the existing storage tests pass before the change**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS (baseline — these tests mock the S3 client and assert bucket `simtrack-test`).

- [ ] **Step 2: Refactor storage.ts to read from `env`**

In `src/lib/storage.ts`, change the top of the file (lines 1-17).

Current:

```ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  },
})

const bucket = process.env.S3_BUCKET ?? ''
```

Replace with:

```ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { env } from '../server/env'

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
})

const bucket = env.S3_BUCKET
```

Leave everything below line 17 (`putObject`, `getObject`, the doc comments) unchanged.

- [ ] **Step 3: Run the storage tests to verify they still pass**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS — `env.S3_BUCKET` resolves to `simtrack-test` from `.env.test`, so the bucket assertions are unchanged; `accessKeyId`/`secretAccessKey` are now guaranteed non-empty strings.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors, no warnings.

- [ ] **Step 5: Commit** *(orchestrator only, via the `/but` skill)*

Commit `src/lib/storage.ts` with message:

```
refactor(storage): require S3 credentials via env, drop empty-string fallbacks
```

---

## Task 4: Register the E2E test provider only in test mode

**Files:**
- Create: `src/server/auth-providers.ts`
- Create: `src/server/auth-providers.test.ts`
- Modify: `auth.ts` (repo root)

The security fix has two halves: (a) `env` already hard-fails if `AUTH_TEST_MODE=true` in production (Task 1), and (b) the `test` provider is now only *registered* when test mode is on — decided by a pure, unit-tested helper — replacing the old request-time `authorize` guard.

- [ ] **Step 1: Write the failing test for the provider helper**

Create `src/server/auth-providers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildAuthProviders } from './auth-providers'

describe('buildAuthProviders', () => {
  it('registers base providers and the email provider, but not the test provider, when test mode is off', () => {
    const providers = buildAuthProviders({
      baseProviders: ['google'],
      emailProvider: 'email',
      testProvider: 'test',
      isTestMode: false,
    })
    expect(providers).toEqual(['google', 'email'])
  })

  it('appends the test provider when test mode is on', () => {
    const providers = buildAuthProviders({
      baseProviders: ['google'],
      emailProvider: 'email',
      testProvider: 'test',
      isTestMode: true,
    })
    expect(providers).toEqual(['google', 'email', 'test'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/server/auth-providers.test.ts`
Expected: FAIL — `Failed to resolve import "./auth-providers"`.

- [ ] **Step 3: Write the provider helper**

Create `src/server/auth-providers.ts`:

```ts
/**
 * Decides which auth providers are registered. The `test` credentials provider
 * is passwordless login-as-anyone, so it is included ONLY when test mode is on.
 * Combined with the env module's hard-fail on `AUTH_TEST_MODE=true` in
 * production, this makes it impossible for the test provider to reach a
 * production deployment.
 */
export function buildAuthProviders<TProvider>(params: {
  baseProviders: TProvider[]
  emailProvider: TProvider
  testProvider: TProvider
  isTestMode: boolean
}): TProvider[] {
  const providers = [...params.baseProviders, params.emailProvider]
  if (params.isTestMode) providers.push(params.testProvider)
  return providers
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/auth-providers.test.ts`
Expected: PASS — both cases green.

- [ ] **Step 5: Refactor `auth.ts` to use `env` and the helper**

Edit the repo-root `auth.ts`.

Current `auth.ts`:

```ts
import NextAuth from 'next-auth'
import Resend from 'next-auth/providers/resend'
import Credentials from 'next-auth/providers/credentials'
import type { EmailConfig } from '@auth/core/providers'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from './src/server/db'
import { authConfig } from './auth.config'

const devEmailProvider: EmailConfig = {
  id: 'email',
  type: 'email',
  name: 'Email',
  from: 'dev@localhost',
  maxAge: 24 * 60 * 60,
  sendVerificationRequest({ identifier, url }) {
    console.log(`\n[Auth] Magic link for ${identifier}:\n${url}\n`)
  },
  options: {},
}

const emailProvider =
  process.env.NODE_ENV === 'production'
    ? Resend({ apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM })
    : devEmailProvider

// Only active when AUTH_TEST_MODE=true — never set this in production or .env.test
const testProvider = Credentials({
  id: 'test',
  credentials: { email: { type: 'text' } },
  authorize: async ({ email }) => {
    if (process.env.AUTH_TEST_MODE !== 'true') return null
    return db.user.upsert({
      where: { email: email as string },
      update: {},
      create: { email: email as string, name: 'E2E Test User' },
    })
  },
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [...authConfig.providers, emailProvider, testProvider],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
})
```

Replace the entire file with:

```ts
import NextAuth from 'next-auth'
import Resend from 'next-auth/providers/resend'
import Credentials from 'next-auth/providers/credentials'
import type { EmailConfig } from '@auth/core/providers'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from './src/server/db'
import { env } from './src/server/env'
import { authConfig } from './auth.config'
import { buildAuthProviders } from './src/server/auth-providers'

const devEmailProvider: EmailConfig = {
  id: 'email',
  type: 'email',
  name: 'Email',
  from: 'dev@localhost',
  maxAge: 24 * 60 * 60,
  sendVerificationRequest({ identifier, url }) {
    console.log(`\n[Auth] Magic link for ${identifier}:\n${url}\n`)
  },
  options: {},
}

const emailProvider =
  env.NODE_ENV === 'production'
    ? Resend({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM })
    : devEmailProvider

// Passwordless login-as-anyone for E2E. Registered ONLY when test mode is on
// (see buildAuthProviders); the env module additionally hard-fails if
// AUTH_TEST_MODE=true in production, so it can never reach a real deployment.
const testProvider = Credentials({
  id: 'test',
  credentials: { email: { type: 'text' } },
  authorize: async ({ email }) =>
    db.user.upsert({
      where: { email: email as string },
      update: {},
      create: { email: email as string, name: 'E2E Test User' },
    }),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: buildAuthProviders({
    baseProviders: authConfig.providers,
    emailProvider,
    testProvider,
    isTestMode: env.AUTH_TEST_MODE,
  }),
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
})
```

Note: in the `env.NODE_ENV === 'production'` ternary branch, the discriminated union narrows `env` to the production member, so `env.RESEND_API_KEY`/`env.EMAIL_FROM` are typed as `string` (not `string | undefined`) — they pass to `Resend({ apiKey, from })` cleanly with no non-null assertion and no suppression.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors, no warnings. (If `tsc` complains that `authConfig.providers` is not assignable to the helper's `TProvider[]`, the helper is generic and infers `TProvider` from `baseProviders`, so the email/test providers must be assignable to the same union — they are, since all are NextAuth provider configs. No change should be needed; if it does surface, widen by typing the call site `buildAuthProviders<(typeof authConfig.providers)[number] | typeof emailProvider | typeof testProvider>({...})` rather than suppressing.)

- [ ] **Step 7: Commit** *(orchestrator only, via the `/but` skill)*

Commit `src/server/auth-providers.ts`, `src/server/auth-providers.test.ts`, and `auth.ts` with message:

```
fix(auth): register E2E test provider only in test mode

The test credentials provider was always registered and only neutralized by a
request-time check, so one leaked env var in production meant passwordless
login-as-anyone. It is now registered only when AUTH_TEST_MODE=true, and the
env module hard-fails if that flag is set in production.
```

---

## Task 5: Full validation & review

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit/integration suite**

Run: `npm test`
Expected: All tests pass. (Requires Postgres up and the test DB set up — `pretest` runs `db:test:setup` automatically.)

- [ ] **Step 2: Run the E2E suite**

Run: `npm run test:e2e`
Expected: All E2E journeys pass. The Playwright dev server boots with `AUTH_TEST_MODE=true` and `NODE_ENV=development`, so the `test` provider is registered and `env` validation passes (no production-only secrets required in dev).

> If E2E fails to authenticate, confirm no stray server is holding port 3737 (`lsof -i :3737`) and that the worktree has a `.env` — both are known environment gotchas, not defects in this change.

- [ ] **Step 3: Final type-check and lint across the whole repo**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors, no warnings.

- [ ] **Step 4: Run the code review**

Invoke the `/code-review` skill on the branch diff. This change has no UI surface, so the design-system-reviewer and web-qa-tester agents are not required. Address any findings; if any are false positives, document the reasoning in the review and ask for a second opinion.

- [ ] **Step 5: Manual production-guard sanity check (optional but recommended)**

Confirm the headline security guarantee fails fast. Run:

```bash
NODE_ENV=production AUTH_TEST_MODE=true \
  DATABASE_URL=postgres://x AUTH_SECRET=x AUTH_GOOGLE_ID=x AUTH_GOOGLE_SECRET=x \
  RESEND_API_KEY=x EMAIL_FROM=x@y.z S3_ENDPOINT=https://x.y S3_REGION=auto \
  S3_ACCESS_KEY_ID=x S3_SECRET_ACCESS_KEY=x S3_BUCKET=x \
  npx tsx -e "import('./src/server/env').then(() => console.log('LOADED — BUG')).catch((e) => { console.log('THREW as expected:'); console.error(e.message) })"
```

Expected: prints `THREW as expected:` followed by `Invalid environment variables:` mentioning `AUTH_TEST_MODE`. It must NOT print `LOADED — BUG`.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- "Central env module, Zod, parsed at module load (fail fast)" → Task 1 (`src/server/env.ts`, `export const env = parseEnv(process.env)`).
- "storage.ts falls back S3 credentials to ''" → Task 3 removes the `?? ''` fallbacks.
- "RESEND_API_KEY/EMAIL_FROM unchecked; AUTH_SECRET unvalidated" → Task 1 schema (production-required) + Task 4 reads them from `env`.
- "Conditionally include testProvider in the providers array at module scope" → Task 4 `buildAuthProviders` + `isTestMode`.
- "Hard-throw if NODE_ENV === 'production' && AUTH_TEST_MODE === 'true'" → Task 1 production member's `AUTH_TEST_MODE` field-level `.refine` (which rejects any truthy form, not just `"true"`); verified by Task 5 Step 5.

**Placeholder scan:** No TBD/TODO/"add validation"/"handle edge cases" — every code step contains complete code.

**Type consistency:** `parseEnv(source)`/`env`/`Env` used consistently across Tasks 1-4. `buildAuthProviders({ baseProviders, emailProvider, testProvider, isTestMode })` — identical shape in the helper (Task 4 Step 3), its test (Step 1), and the call site in `auth.ts` (Step 5). `isTestMode: env.AUTH_TEST_MODE` is a `boolean` (from `z.stringbool().optional().default(false)`), matching `buildAuthProviders`'s `isTestMode: boolean` parameter.
