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

## Non-goals

- Migrating existing development `/uploads/...` rows (they are already broken
  across worktrees; re-uploading is acceptable in dev).
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

### Read path (presigned redirect)

1. Images are rendered from the stored `/media/<key>` value (via `next/image`,
   same-origin).
2. `GET /media/[...key]` reconstructs the key, generates a short-lived presigned
   GET URL, and returns a `302` redirect to it.
3. The browser (or the Next image optimizer) follows the redirect and fetches
   the bytes **directly from MinIO/R2** — not through the serverless function.

This keeps the bucket private, keeps infrastructure URLs out of the database, and
avoids routing image bytes through Vercel functions. It works identically in dev
(MinIO at `localhost:9000`) and prod (R2).

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

## Error handling

- Upload validation failures return the existing status codes (401/400/413).
- `putObject` failure → `500` with a generic error message.
- Media route: `..` in key → `400`; missing object → `404`; presign failure →
  `500`.

## Testing (Testing Trophy — integration-first)

Run against a MinIO instance (the compose service locally; a service container in
CI), using a throwaway test bucket configured via `.env.test`.

- **Upload route (integration):** POST a valid image → assert response URL
  matches `/media/...` and the object exists in S3. Assert validation paths
  (unauthorized, disallowed MIME, oversize, magic-byte mismatch) still return
  their status codes.
- **Media route (integration):** seed an object → `GET /media/<key>` returns
  `302` to a presigned URL whose host is the configured endpoint; `..` in key →
  `400`; unknown key → `404`.
- Existing component tests (`create-sim-modal`, `sim-form`) mock
  `fetch('/api/upload')` and are unaffected.
- E2E (`npm run test:e2e`): existing flow unchanged; requires MinIO running.

## Accepted trade-offs

- Production storage moves from Vercel Blob to Cloudflare R2 (intended).
- Existing development `/uploads/...` rows will `404`; no migration is provided.
- One presign + redirect per image view (cheap; R2 egress is free).
- The local dev workflow now requires Docker (MinIO) to be running.
