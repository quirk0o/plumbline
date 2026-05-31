# S3 Image Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace working-directory-coupled image uploads with a portable, S3-compatible storage layer (MinIO in dev, Cloudflare R2 in prod), served via presigned redirects, and backfill existing dev images.

**Architecture:** A single S3 code path (`src/lib/storage.ts`) wraps the AWS SDK v3 client and presigner with `forcePathStyle: true`. The upload route writes objects and returns app-relative `/media/<key>` paths; a new `GET /media/[...key]` route does a cheap existence check then 302-redirects to a short-lived presigned URL so bytes never stream through the serverless function. A one-off idempotent backfill script reuploads files still present on disk and rewrites `/uploads/...` rows to `/media/...`, copying the owning userId from the related record.

**Tech Stack:** Next.js 16 (App Router, Node runtime), `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, Prisma 7 (`@prisma/adapter-pg`) on PostgreSQL, Vitest (`aws-sdk-client-mock`), `file-type`, MinIO via Docker Compose (dev/E2E only).

---

## File Structure

**Create:**
- `src/lib/storage.ts` — S3 client + `putObject`, `objectExists`, `presignGetUrl`. Single responsibility: the storage network boundary. The only module that imports the AWS SDK.
- `src/app/media/[...key]/route.ts` — `GET` handler: path-traversal guard → existence check → presigned 302 redirect.
- `src/lib/storage.test.ts` — unit-level tests for the storage wrapper (SDK mocked).
- `src/app/api/upload/route.test.ts` — integration tests for the upload route (SDK + auth mocked, real validation).
- `src/app/media/[...key]/route.test.ts` — integration tests for the media route (SDK mocked).
- `scripts/backfill-uploads-to-s3.ts` — one-off idempotent migration script.
- `scripts/backfill-uploads-to-s3.test.ts` — integration test (real DB, SDK mocked, temp source files).
- `docker-compose.yml` — `minio` + `createbucket` services for local dev / E2E.
**Modify:**
- `.env.example` — append the S3 block to the existing (already committed) file; do NOT overwrite it.
- `src/app/api/upload/route.ts` — replace the filesystem + Vercel Blob branches with a single `putObject` call returning `/media/<key>`.
- `src/proxy.ts:13` — add `media` to the matcher negative-lookahead.
- `.env` — add `S3_*` vars (MinIO values).
- `.env.test` — add `S3_*` vars (test bucket values).
- `package.json` — add deps + a `backfill:uploads` script.

**Unchanged (verified):**
- `src/app/components/image-upload.tsx` — already posts to `/api/upload` and consumes `{ url }`; the returned `/media/...` value flows through unchanged.
- `next.config.ts` — `/media/...` is same-origin for `next/image`; `localhost` is already in `images.remotePatterns` for the dev redirect target. No change.

---

## Task 1: Add dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime + dev dependencies**

Run:
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install --save-dev aws-sdk-client-mock
```

Expected: `package.json` gains `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` under `dependencies`, and `aws-sdk-client-mock` under `devDependencies`. `npm install` exits 0.

- [ ] **Step 2: Verify versions resolved**

Run:
```bash
node -e "console.log(require('@aws-sdk/client-s3/package.json').version, require('@aws-sdk/s3-request-presigner/package.json').version, require('aws-sdk-client-mock/package.json').version)"
```

Expected: three version strings printed, no error.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add AWS S3 SDK, presigner, and aws-sdk-client-mock"
```

---

## Task 2: Configuration (env vars + example file)

**Files:**
- Modify: `.env`
- Modify: `.env.test`
- Modify: `.env.example` (append only — the file already exists and is committed)

- [ ] **Step 1: Add S3 vars to `.env`**

Append to `/Users/beatka/Projects/simstrack-526/.env`:
```
# Local object storage (MinIO via docker-compose)
S3_ENDPOINT="http://localhost:9000"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
S3_BUCKET="simtrack-dev"
```

- [ ] **Step 2: Add S3 vars to `.env.test`**

Append to `/Users/beatka/Projects/simstrack-526/.env.test`:
```
S3_ENDPOINT="http://localhost:9000"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
S3_BUCKET="simtrack-test"
```

Note: tests mock the SDK, so these values are never dialed — they only satisfy module initialization in `src/lib/storage.ts`.

- [ ] **Step 3: Append the S3 block to the existing `.env.example`**

The file `/Users/beatka/Projects/simstrack-526/.env.example` already exists and is
committed (it documents `DATABASE_URL`, `AUTH_*`, `RESEND_API_KEY`, `EMAIL_FROM`).
**Do not overwrite it.** Append only:
```

# Object storage (S3-compatible: MinIO in dev, Cloudflare R2 in prod)
S3_ENDPOINT="http://localhost:9000"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
S3_BUCKET="simtrack-dev"
```

- [ ] **Step 4: Verify `.env.example` is tracked (not ignored)**

Run:
```bash
git check-ignore .env.example; echo "exit=$?"
```

Expected: prints `exit=1` (NOT ignored — `.gitignore` has `!.env.example`).

- [ ] **Step 5: Commit**

```bash
git add .env.example .env.test
git commit -m "docs: document S3 env vars in .env.example and .env.test"
```

Note: `.env` is gitignored and will NOT be committed (expected). `.env.test` IS whitelisted in `.gitignore` (`!.env.test`), so its S3 additions are committed.

---

## Task 3: Docker Compose for MinIO

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Write `docker-compose.yml`**

Create `/Users/beatka/Projects/simstrack-526/docker-compose.yml`:
```yaml
services:
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio-data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

  createbucket:
    image: minio/mc:latest
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      until (mc alias set local http://minio:9000 minioadmin minioadmin) do echo 'waiting for minio...' && sleep 1; done;
      mc mb --ignore-existing local/simtrack-dev;
      mc mb --ignore-existing local/simtrack-test;
      echo 'buckets ready';
      "

volumes:
  minio-data:
```

The buckets are **private** (no anonymous policy set) — reads go through presigned URLs.

- [ ] **Step 2: Start MinIO and verify buckets**

Run:
```bash
docker compose up -d
docker compose logs createbucket | grep "buckets ready"
```

Expected: `buckets ready` appears. MinIO console reachable at `http://localhost:9001` (login `minioadmin`/`minioadmin`).

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "build: add MinIO docker-compose for local object storage"
```

---

## Task 4: Storage module — `putObject`

**Files:**
- Create: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/beatka/Projects/simstrack-526/src/lib/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { putObject } from './storage'

const s3Mock = mockClient(S3Client)

beforeEach(() => {
  s3Mock.reset()
})

describe('putObject', () => {
  it('sends a PutObjectCommand with key, body, content type, and configured bucket', async () => {
    s3Mock.on(PutObjectCommand).resolves({})

    await putObject('uploads/user-1/file.png', Buffer.from('bytes'), 'image/png')

    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input).toMatchObject({
      Bucket: 'simtrack-test',
      Key: 'uploads/user-1/file.png',
      ContentType: 'image/png',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL — `putObject` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `/Users/beatka/Projects/simstrack-526/src/lib/storage.ts`:
```ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

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

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: add S3 storage module with putObject"
```

---

## Task 5: Storage module — `objectExists`

**Files:**
- Modify: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

- [ ] **Step 1: Add the failing test**

Append inside `src/lib/storage.test.ts` (add imports `HeadObjectCommand` to the `@aws-sdk/client-s3` import and `objectExists` to the `./storage` import):
```ts
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { objectExists } from './storage'

describe('objectExists', () => {
  it('returns true when HeadObject resolves', async () => {
    s3Mock.on(HeadObjectCommand).resolves({})
    expect(await objectExists('uploads/user-1/file.png')).toBe(true)
  })

  it('returns false when HeadObject rejects with NotFound', async () => {
    s3Mock.on(HeadObjectCommand).rejects({ name: 'NotFound' })
    expect(await objectExists('uploads/user-1/missing.png')).toBe(false)
  })
})
```

Note: keep one `mockClient(S3Client)` instance and one `beforeEach(reset)` at top of file; do not redeclare.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL — `objectExists` is not exported.

- [ ] **Step 3: Implement `objectExists`**

In `src/lib/storage.ts`, add `HeadObjectCommand` to the import and append:
```ts
export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
}
```

Update the import line to:
```ts
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: add objectExists to S3 storage module"
```

---

## Task 6: Storage module — `presignGetUrl`

**Files:**
- Modify: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

- [ ] **Step 1: Add the failing test**

The presigner is a separate function (`getSignedUrl` from `@aws-sdk/s3-request-presigner`); mock it with `vi.mock`. Add at the TOP of `src/lib/storage.test.ts` (after imports, before `mockClient`):
```ts
import { vi } from 'vitest'

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://signed.example/url'),
}))
```

Add `presignGetUrl` to the `./storage` import and add this describe block:
```ts
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { presignGetUrl } from './storage'

describe('presignGetUrl', () => {
  it('returns a presigned URL for the key', async () => {
    const url = await presignGetUrl('uploads/user-1/file.png', 300)
    expect(url).toBe('https://signed.example/url')
    expect(getSignedUrl).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL — `presignGetUrl` is not exported.

- [ ] **Step 3: Implement `presignGetUrl`**

In `src/lib/storage.ts`, add the imports and function:
```ts
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export async function presignGetUrl(
  key: string,
  expiresInSeconds = 300,
): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  })
}
```

Consolidate the `@aws-sdk/client-s3` import to:
```ts
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Validate types + lint**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: no errors, no warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: add presignGetUrl to S3 storage module"
```

---

## Task 7: Rewrite the upload route to use S3

**Files:**
- Modify: `src/app/api/upload/route.ts`
- Test: `src/app/api/upload/route.test.ts`

The current route (`src/app/api/upload/route.ts`) validates auth, MIME allow/block list, 5 MB cap, and magic-byte sniff, then branches on `BLOB_READ_WRITE_TOKEN` between `writeFile` and Vercel Blob. We keep all validation and replace both storage branches with one `putObject` call.

- [ ] **Step 1: Write the failing test**

Create `/Users/beatka/Projects/simstrack-526/src/app/api/upload/route.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { POST } from './route'

const s3Mock = mockClient(S3Client)
const mockedAuth = vi.mocked(auth)

// A 1x1 PNG (valid magic bytes for file-type sniffing).
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
)

function makeRequest(file: File) {
  const form = new FormData()
  form.append('file', file)
  return new Request('http://localhost/api/upload', { method: 'POST', body: form })
}

beforeEach(() => {
  s3Mock.reset()
  mockedAuth.mockReset()
})

describe('POST /api/upload', () => {
  it('stores a valid image and returns a /media URL', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never)
    s3Mock.on(PutObjectCommand).resolves({})
    const file = new File([PNG_BYTES], 'My Pic.png', { type: 'image/png' })

    const res = await POST(makeRequest(file))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.url).toMatch(/^\/media\/uploads\/user-1\/\d+-My_Pic\.png$/)
    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input.Key).toMatch(/^uploads\/user-1\/\d+-My_Pic\.png$/)
    expect(calls[0].args[0].input.ContentType).toBe('image/png')
  })

  it('rejects unauthenticated requests with 401 and does not store', async () => {
    mockedAuth.mockResolvedValue(null as never)
    const file = new File([PNG_BYTES], 'pic.png', { type: 'image/png' })

    const res = await POST(makeRequest(file))

    expect(res.status).toBe(401)
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0)
  })

  it('rejects a disallowed MIME type with 400 and does not store', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never)
    const file = new File(['<svg></svg>'], 'x.svg', { type: 'image/svg+xml' })

    const res = await POST(makeRequest(file))

    expect(res.status).toBe(400)
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0)
  })

  it('rejects a non-image whose bytes do not match an allowed image with 400', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never)
    // Declares image/png but bytes are plain text → magic-byte sniff fails.
    const file = new File([Buffer.from('not really a png')], 'fake.png', { type: 'image/png' })

    const res = await POST(makeRequest(file))

    expect(res.status).toBe(400)
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/upload/route.test.ts`
Expected: FAIL — the route still returns `/uploads/...` (or writes to disk), so the `/media/...` assertion fails.

- [ ] **Step 3: Rewrite the route**

Replace the entire contents of `/Users/beatka/Projects/simstrack-526/src/app/api/upload/route.ts` with:
```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { fileTypeFromBuffer } from 'file-type'
import { putObject } from '@/lib/storage'

const BLOCKED_TYPES = ['image/svg+xml', 'image/svg', 'text/html', 'image/x-icon']
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!file.type.startsWith('image/') || BLOCKED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be under 5 MB' }, { status: 413 })
  }

  const bytes = await file.arrayBuffer()
  const detected = await fileTypeFromBuffer(bytes)
  if (!detected || !ALLOWED_MIME.includes(detected.mime)) {
    return NextResponse.json({ error: 'Unsupported image format' }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `uploads/${session.user.id}/${Date.now()}-${safeName}`

  await putObject(key, Buffer.from(bytes), detected.mime)

  return NextResponse.json({ url: `/media/${key}` })
}
```

This removes the `@vercel/blob`, `fs/promises`, and `path` imports and both storage branches.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/upload/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Validate types + lint**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: no errors. (If `@vercel/blob` is now unused project-wide, that's removed in Task 11.)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/upload/route.ts src/app/api/upload/route.test.ts
git commit -m "feat: store uploads in S3 and return app-relative /media URLs"
```

---

## Task 8: Media serving route (presigned redirect)

**Files:**
- Create: `src/app/media/[...key]/route.ts`
- Test: `src/app/media/[...key]/route.test.ts`

The route reconstructs the key from the catch-all segments, rejects `..` (path traversal), 404s on missing objects via `objectExists`, then 302-redirects to a presigned URL. Bytes never pass through the function.

- [ ] **Step 1: Write the failing test**

Create `/Users/beatka/Projects/simstrack-526/src/app/media/[...key]/route.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/storage', () => ({
  objectExists: vi.fn(),
  presignGetUrl: vi.fn(),
}))

import { objectExists, presignGetUrl } from '@/lib/storage'
import { GET } from './route'

const mockedExists = vi.mocked(objectExists)
const mockedPresign = vi.mocked(presignGetUrl)

function ctx(key: string[]) {
  return { params: Promise.resolve({ key }) }
}

beforeEach(() => {
  mockedExists.mockReset()
  mockedPresign.mockReset()
})

describe('GET /media/[...key]', () => {
  it('302-redirects to the presigned URL for an existing object', async () => {
    mockedExists.mockResolvedValue(true)
    mockedPresign.mockResolvedValue('https://signed.example/obj')

    const res = await GET(new Request('http://localhost/media/uploads/user-1/a.png'), ctx(['uploads', 'user-1', 'a.png']))

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://signed.example/obj')
    expect(mockedPresign).toHaveBeenCalledWith('uploads/user-1/a.png')
  })

  it('returns 400 for a key containing .. without calling storage', async () => {
    const res = await GET(new Request('http://localhost/media/uploads/..%2Fsecret'), ctx(['uploads', '..', 'secret']))

    expect(res.status).toBe(400)
    expect(mockedExists).not.toHaveBeenCalled()
    expect(mockedPresign).not.toHaveBeenCalled()
  })

  it('returns 404 when the object does not exist', async () => {
    mockedExists.mockResolvedValue(false)

    const res = await GET(new Request('http://localhost/media/uploads/user-1/missing.png'), ctx(['uploads', 'user-1', 'missing.png']))

    expect(res.status).toBe(404)
    expect(mockedPresign).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/media/[...key]/route.test.ts"`
Expected: FAIL — module/`GET` not found.

- [ ] **Step 3: Implement the route**

Create `/Users/beatka/Projects/simstrack-526/src/app/media/[...key]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { objectExists, presignGetUrl } from '@/lib/storage'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params

  if (key.some((segment) => segment.includes('..'))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const objectKey = key.join('/')

  if (!(await objectExists(objectKey))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const url = await presignGetUrl(objectKey)
  return NextResponse.redirect(url, 302)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/media/[...key]/route.test.ts"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/media/[...key]/route.ts" "src/app/media/[...key]/route.test.ts"
git commit -m "feat: add /media route serving uploads via presigned redirect"
```

---

## Task 9: Exclude `/media` from auth middleware

**Files:**
- Modify: `src/proxy.ts:13`

The matcher currently excludes `uploads`; add `media` so image requests are not redirected to sign-in.

- [ ] **Step 1: Update the matcher**

In `/Users/beatka/Projects/simstrack-526/src/proxy.ts`, change line 13 from:
```ts
  matcher: ['/((?!auth|api/auth|_next/static|_next/image|favicon.ico|uploads).+)'],
```
to:
```ts
  matcher: ['/((?!auth|api/auth|_next/static|_next/image|favicon.ico|uploads|media).+)'],
```

- [ ] **Step 2: Validate types + lint**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "fix: exclude /media from auth middleware matcher"
```

---

## Task 10: Backfill script

**Files:**
- Create: `scripts/backfill-uploads-to-s3.ts`
- Test: `scripts/backfill-uploads-to-s3.test.ts`
- Modify: `package.json` (add `backfill:uploads` script)

The script migrates `Pack`/`Legacy`/`Sim` rows whose `imageUrl` starts with `/uploads/`. It resolves the owning userId (`Legacy.userId`; `Sim` via `legacy.userId`; `Pack` → `unknown`), reads the file from a source dir (default `./public/uploads`, override `SOURCE_UPLOAD_DIR`), sniffs the content type, uploads to `uploads/<userId>/<filename>`, and rewrites the row to `/media/uploads/<userId>/<filename>`. Rows already at `/media/...` are skipped (idempotent). `--dry-run` reports without writing.

The migration logic lives in an exported `runBackfill` function so it can be unit-tested; the file also runs it when executed directly.

- [ ] **Step 1: Write the failing test**

Create `/Users/beatka/Projects/simstrack-526/scripts/backfill-uploads-to-s3.test.ts`:
```ts
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

// Minimal valid PNG bytes for file-type sniffing.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
)

let sourceDir: string

async function cleanupDb() {
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/backfill-uploads-to-s3.test.ts`
Expected: FAIL — `runBackfill` not found.

- [ ] **Step 3: Implement the script**

Create `/Users/beatka/Projects/simstrack-526/scripts/backfill-uploads-to-s3.ts`:
```ts
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
    const newUrl = await migrateRow(row.imageUrl!, row.userId, options, summary)
    if (newUrl) {
      await db.legacy.update({ where: { id: row.id }, data: { imageUrl: newUrl } })
    }
  }

  const sims = await db.sim.findMany({
    where: { imageUrl: { startsWith: OLD_PREFIX } },
    select: { id: true, imageUrl: true, legacy: { select: { userId: true } } },
  })
  for (const row of sims) {
    const newUrl = await migrateRow(row.imageUrl!, row.legacy.userId, options, summary)
    if (newUrl) {
      await db.sim.update({ where: { id: row.id }, data: { imageUrl: newUrl } })
    }
  }

  const packs = await db.pack.findMany({
    where: { imageUrl: { startsWith: OLD_PREFIX } },
    select: { id: true, imageUrl: true },
  })
  for (const row of packs) {
    const newUrl = await migrateRow(row.imageUrl!, 'unknown', options, summary)
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/backfill-uploads-to-s3.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Add npm script**

In `/Users/beatka/Projects/simstrack-526/package.json`, add to `"scripts"`:
```json
    "backfill:uploads": "tsx scripts/backfill-uploads-to-s3.ts",
```

- [ ] **Step 6: Validate types + lint**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add scripts/backfill-uploads-to-s3.ts scripts/backfill-uploads-to-s3.test.ts package.json
git commit -m "feat: add idempotent backfill script for /uploads -> /media migration"
```

---

## Task 11: Remove Vercel Blob dependency

**Files:**
- Modify: `package.json`

`@vercel/blob` is no longer imported anywhere after Task 7 (the only importer was the upload route).

- [ ] **Step 1: Confirm no remaining imports**

Run:
```bash
grep -rn "@vercel/blob" src scripts || echo "no references"
```
Expected: `no references`.

- [ ] **Step 2: Uninstall**

Run:
```bash
npm uninstall @vercel/blob
```
Expected: `package.json` no longer lists `@vercel/blob`; exits 0.

- [ ] **Step 3: Validate types + lint**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: remove unused @vercel/blob dependency"
```

---

## Task 12: Documentation — dev setup note

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add a storage section to `AGENTS.md`**

Append to `/Users/beatka/Projects/simstrack-526/AGENTS.md`:
```markdown
# Local Object Storage (image uploads)

Image uploads use S3-compatible storage. Locally this is **MinIO**, run via Docker:

```bash
docker compose up -d
```

This starts MinIO (API `localhost:9000`, console `localhost:9001`, login
`minioadmin`/`minioadmin`) and creates the `simtrack-dev` and `simtrack-test`
buckets. The dev server reads `S3_*` vars from `.env`; see `.env.example`.

Uploaded files are stored under `uploads/<userId>/<file>` and served via the
`/media/<key>` route, which 302-redirects to a short-lived presigned URL.

To migrate legacy `/uploads/...` rows from a previous local setup:

```bash
npm run backfill:uploads -- --dry-run   # preview
npm run backfill:uploads                # apply
# SOURCE_UPLOAD_DIR=/path/to/other/worktree/public/uploads npm run backfill:uploads
```
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: document MinIO local storage and backfill workflow"
```

---

## Task 13: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check and lint the whole project**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: no errors, no warnings.

- [ ] **Step 2: Run the full unit/integration suite**

Run:
```bash
npm test
```
Expected: all tests pass, including the new `storage`, upload route, media route, and backfill suites. (The `pretest` hook resets/seeds the test DB.)

- [ ] **Step 3: Run E2E (requires MinIO running)**

Run:
```bash
docker compose up -d
npm run test:e2e
```
Expected: all E2E tests pass. The upload flow exercises the real `/api/upload` → MinIO → `/media` redirect path.

- [ ] **Step 4: Manual smoke test (optional but recommended)**

Sign in via the magic-link flow (see `AGENTS.md`), upload a Sim portrait, and confirm the image renders and its URL is `/media/uploads/<userId>/...`. Restart the dev server from a different worktree and confirm the same image still loads (the original bug is fixed).

- [ ] **Step 5: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "chore: verification fixups for S3 image storage"
```
(Skip if nothing changed.)

---

## Self-Review Notes (resolved during planning)

- **Spec reconciliation:** the spec's read-path describes a presigned redirect, but its earlier test note mentioned `GetObjectCommand` for the 404 case. Streaming-free 404 semantics require an existence probe, so the media route uses `objectExists` (a `HeadObjectCommand`) before presigning. This keeps bytes off the function while still returning a real `404`/`400` from our origin.
- **Backfill key layout:** migrated objects use `uploads/<userId>/<file>` (userId copied from the related `Legacy`/`Sim`; `Pack` → `unknown`), matching fresh uploads, per the latest spec revision.
- **Scope:** Neon Postgres, the Resend magic-link sender, and R2 bucket provisioning remain out of scope (separate prod-readiness follow-ups). `.env.example` documents `RESEND_API_KEY` and the `S3_*` prod values as a pointer only.
