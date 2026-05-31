# S3-backed image storage (MinIO dev / R2 prod)

**Date:** 2026-05-31
**Status:** Approved — ready for implementation planning

## Problem

Image uploads in development are written to `process.cwd()/public/uploads/`
(`src/app/api/upload/route.ts`). Because the upload directory is resolved from
the current working directory and is gitignored, files land in whichever
worktree performed the upload. The development Postgres database, however, is
shared across all worktrees and stores URLs like `/uploads/<file>`. Running the
server from a different directory (e.g. another git worktree) therefore yields
broken images: the DB references a file that this worktree's `public/uploads/`
does not contain. The storage location is coupled to `process.cwd()`, while the
database that references it is global.

## Goals

- Decouple image storage from the working directory so uploads are stable across
  worktrees.
- Use a single, portable storage abstraction (the S3 API) for every environment,
  avoiding lock-in to any one provider.
- Keep the upload bucket private and keep infrastructure URLs out of the
  database.
- Avoid streaming image bytes through serverless functions in production.
- Backfill existing development data: reupload the physical files still present in
  `public/uploads/` to S3 and rewrite the `/uploads/...` rows to `/media/...`.

## Non-goals

- Wiring up the Resend magic-link email sender (separate prod-readiness item).
- Provisioning managed Postgres (e.g. Neon) for production (separate item).
- Changing the production deploy target beyond storage (Vercel is the chosen
  compute platform; see Context).

## Context: deployment platform

Production will run on **Vercel** (serverless functions, Node runtime). Storage
is intentionally decoupled from compute: the application talks to an
S3-compatible API and is pointed at a local **MinIO** instance in development and
**Cloudflare R2** in production. R2 is S3-compatible, has zero egress fees, and
works identically from Vercel. Because Vercel runs reads through serverless
functions, the read path must not stream bytes through the function (see
Architecture).

## Architecture

A single code path uses the S3 SDK in all environments. Only the `S3_*`
environment values differ between dev (MinIO) and prod (R2).

### Write path

1. `POST /api/upload` performs existing validation unchanged: authenticated
   session required; MIME allow-list (`image/jpeg|png|webp|gif`) and block-list
   (`svg`, `html`, `ico`); 5 MB size cap; magic-byte sniffing via `file-type`.
2. The validated bytes are written with `PutObjectCommand` under the key
   `uploads/<userId>/<timestamp>-<safeName>`.
3. The route returns `{ url: "/media/<key>" }` — an **app-relative** path. The
   database stores this relative path, never an infrastructure URL.

### Read path (byte streaming)

> **Revision (2026-05-31, post-implementation):** This section originally
> specified a `302` redirect to a short-lived presigned URL. That proved
> incompatible with `next/image`: the image optimizer does **not** follow 302
> redirects to presigned URLs (it reads the empty redirect body and reports
> "received null"). The read path was changed to stream the bytes through the
> route instead. The description below reflects the as-built behavior.

1. Images are rendered from the stored `/media/<key>` value (via `next/image`,
   same-origin).
2. `GET /media/[...key]` reconstructs the key, fetches the object from S3/MinIO
   via `getObject`, and streams the bytes back with the stored `Content-Type`
   (`404` if absent, `502` on a non-404 storage error).
3. Because the URL is a stable same-origin route returning real image bytes,
   `next/image` optimization works normally.

This keeps the bucket private and keeps infrastructure URLs out of the database.
Bytes pass through the serverless function, but `next/image` caches optimized
results so origin fetches are infrequent, and R2 egress is free in production. In
development, `next.config.ts` enables `images.dangerouslyAllowLocalIP` so the
optimizer can fetch from local MinIO (`localhost:9000`); production uses a public
R2 host, where the flag stays off.

## Components

### `src/lib/storage.ts` (new)

A thin S3 wrapper. Dependencies: `@aws-sdk/client-s3`,
`@aws-sdk/s3-request-presigner`.

- One `S3Client` configured from env with `forcePathStyle: true` (required by
  MinIO; harmless for R2).
- `putObject(key: string, body: Buffer, contentType: string): Promise<void>`
- `presignGetUrl(key: string, expiresInSeconds: number): Promise<string>`

The module reads `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`, and `S3_BUCKET`.

### `src/app/api/upload/route.ts` (edit)

- Keep all current validation logic verbatim.
- Replace both the filesystem branch and the `@vercel/blob` branch with a single
  `putObject` call.
- Build key `uploads/${session.user.id}/${Date.now()}-${safeName}`.
- Return `{ url: "/media/" + key }`.
- Remove imports of `@vercel/blob`, `fs/promises`, and `path`.

### `src/app/media/[...key]/route.ts` (new)

- `GET` handler. In Next.js 16 dynamic params are async: `const { key } = await
  params`, then `key.join("/")`.
- Reject any segment containing `..` → `400` (path-traversal guard).
- Generate a presigned URL (TTL e.g. 300s) and return `NextResponse.redirect(url,
  302)`.
- On a missing object / S3 `NoSuchKey`, return `404`.
- Unauthenticated: the route returns only a redirect to a short-lived signed URL,
  and `next/image` must be able to fetch it same-origin.

### `src/proxy.ts` (edit)

Add `media` to the matcher's negative-lookahead so the auth middleware does not
intercept image requests (mirrors the existing `uploads` exclusion):

```
matcher: ['/((?!auth|api/auth|_next/static|_next/image|favicon.ico|uploads|media).+)']
```

### `docker-compose.yml` (new)

- `minio` service: image `minio/minio`, command
  `server /data --console-address ":9001"`, ports `9000` (S3 API) and `9001`
  (web console), root user/password from env, named volume mounted at `/data` so
  uploads survive restarts.
- `createbucket` init service: image `minio/mc`, waits for MinIO, runs
  `mc alias set` + `mc mb --ignore-existing <bucket>`. Bucket stays **private**
  (no public read policy — reads go through presigned URLs).

Document `docker compose up -d` as a prerequisite for development in
`AGENTS.md`/README.

### Configuration

Add to `.env`, `.env.test`, and `.env.example`:

```
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1            # MinIO ignores it; the SDK requires a value
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=simtrack-dev
```

Production sets the same variables to R2's endpoint, credentials, and bucket.

No `next.config.ts` change is required: `/media/<key>` is same-origin for
`next/image`, and `localhost` is already in `images.remotePatterns` for the dev
redirect target.

## Data backfill

A one-off, idempotent script (`scripts/backfill-uploads-to-s3.ts`, run via `tsx`,
matching the existing seed tooling) migrates existing development data from the
old filesystem paths to S3.

Three columns can hold an uploaded image URL: **`Pack.imageUrl`**,
**`Legacy.imageUrl`**, and **`Sim.imageUrl`**. In practice only `Sim` and
`Legacy` receive user uploads (`Pack` images are seeded from EA, and
`User.image` holds OAuth avatar URLs), but filtering by the `/uploads/` prefix
scopes the backfill to user-uploaded rows correctly regardless of model, so all
three columns are scanned for safety.

Algorithm:

1. Resolve a source directory for the legacy files. Default `./public/uploads`;
   overridable via `SOURCE_UPLOAD_DIR` for the case where the files live in a
   different worktree.
2. For each of the three columns, select rows whose `imageUrl` begins with
   `/uploads/`.
3. For each such row, resolve the owning user id so migrated keys match the
   fresh-upload layout (`uploads/<userId>/...`):
   - `Legacy` rows use `Legacy.userId` directly.
   - `Sim` rows resolve via the `legacy` relation → `legacy.userId`.
   - `Pack` rows have no owner (Pack images are seeded, never user uploads); on
     the off chance one matches, fall back to the literal segment `unknown`.
4. For each such row:
   - `filename = basename(imageUrl)`; look for `<sourceDir>/<filename>`.
   - If found: read the bytes, sniff the content type with `file-type`, upload via
     `storage.putObject` under key `uploads/<userId>/<filename>`, then update the
     row's `imageUrl` to `/media/uploads/<userId>/<filename>`.
   - If not found: leave the row unchanged and record it as unrecoverable.
5. Print a summary: counts migrated, skipped (already `/media/...`), and
   unrecoverable (with the offending URLs).

Properties:

- **Idempotent:** rows already starting with `/media/` are skipped, so the script
  is safe to re-run.
- **Dry-run:** a `--dry-run` flag reports the planned changes without writing to
  S3 or the database.
- **Reuses** `src/lib/storage.ts`, so it targets whatever S3 endpoint the `S3_*`
  env points at (MinIO for dev). MinIO must be running.

This is a development data migration. Files genuinely lost (present in no
worktree) cannot be recovered and are reported for manual follow-up.

## Error handling

- Upload validation failures return the existing status codes (401/400/413).
- `putObject` failure → `500` with a generic error message.
- Media route: `..` in key → `400`; missing object → `404`; presign failure →
  `500`.

## Testing (Testing Trophy — integration-first)

The S3 SDK is **mocked** in tests via `aws-sdk-client-mock` (dev dependency); the
test suite does **not** require a running MinIO/Docker container. Mocking is
confined to the network boundary — the `S3Client` and the presigner. Everything
else stays real: tests run against the existing Postgres test database
(`.env.test`, prepared by the `pretest` hook), and the route/DB/validation logic
is exercised genuinely.

Mocking strategy:

- Intercept `PutObjectCommand` on the mocked `S3Client` to capture the key, body,
  and content type, returning a success response.
- Stub the presigner (`getSignedUrl`) to return a deterministic fake URL so
  redirect assertions are stable.
- `GetObjectCommand` resolves to a fixture stream for found keys and rejects with
  a `NoSuchKey`-shaped error for missing keys.

Tests:

- **Upload route:** POST a valid image → assert the response URL matches
  `/media/...` and that `PutObjectCommand` was called once with the expected key
  prefix, byte length, and sniffed content type. Assert validation paths
  (unauthorized, disallowed MIME, oversize, magic-byte mismatch) still return
  their status codes and that no `PutObjectCommand` is issued on rejection.
- **Media route:** `GET /media/<key>` returns `302` to the stubbed presigned URL;
  `..` in the key → `400` (and no presign/SDK call); a key whose `GetObject`
  rejects with `NoSuchKey` → `404`.
- **Backfill script:** seed `Sim`/`Legacy` rows with `/uploads/<file>` URLs and
  create matching temp source files on disk → run the script → assert
  `PutObjectCommand` was called per file under `uploads/<userId>/<file>` (the
  userId copied from the related `Legacy`/`Sim`) and the rows now point at
  `/media/uploads/<userId>/<file>`; assert a row whose source file is absent is
  reported and left unchanged; assert re-running is a no-op (rows already at
  `/media/...` are skipped, no further `PutObjectCommand`).
- Existing component tests (`create-sim-modal`, `sim-form`) mock
  `fetch('/api/upload')` and are unaffected.
- E2E (`npm run test:e2e`): existing flow unchanged; runs against the real dev
  stack and therefore requires MinIO running (`docker compose up -d`).

## Accepted trade-offs

- Production storage moves from Vercel Blob to Cloudflare R2 (intended).
- Existing development `/uploads/...` rows are migrated by the backfill script;
  any files present in no worktree are unrecoverable and reported for manual
  follow-up.
- One presign + redirect per image view (cheap; R2 egress is free).
- The local dev workflow now requires Docker (MinIO) to be running.
