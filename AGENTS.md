<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Key breaking change: middleware → proxy

In Next.js 16, `middleware.ts` was renamed to `proxy.ts`. The request-interception file in this project is **`src/proxy.ts`** and it exports a named `proxy` function (not `middleware`). Never suggest renaming it or creating a `middleware.ts`. See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
<!-- END:nextjs-agent-rules -->

# Commits

**Use conventional commits.** Follow the Conventional Commits spec for all commit messages. This ensures clear, consistent history and enables automated tooling.

You must only include your specific changes in commits. Always list specific files to stage with `git add <file>`, never `git add .` or `git add -A`. This prevents accidental inclusion of unrelated changes.

# Merge Conflicts

Always resolve merge conflicts carefully using proper 3-way merge tooling. Never use `git checkout --ours` or `git checkout --theirs` — these silently discard the other side's changes entirely.

Use `git merge-file` with the merge base:

```bash
BASE=$(git merge-base <ours-ref> <theirs-ref>)
git show $BASE:path/to/file > /tmp/file-base
git show <ours-ref>:path/to/file > /tmp/file-ours
git show <theirs-ref>:path/to/file > /tmp/file-theirs
cp /tmp/file-ours /tmp/file-merged
git merge-file /tmp/file-merged /tmp/file-base /tmp/file-theirs
```

Then resolve each conflict hunk individually, choosing the better data from each side. Never blindly take one side.

# Code Quality Rules

**No lint or TypeScript suppressions — ever.** The following are illegal in this codebase:
- `// eslint-disable` (any form: next-line, line, block)
- `// @ts-ignore`
- `// @ts-expect-error`
- `// @ts-nocheck`
- `// tslint:disable`

If a suppression seems necessary, the correct fix is to resolve the underlying issue — change the code, fix the type, or update the config. Suppressions mask real problems and are never acceptable.

# Validation After Each Chunk of Work

After completing any meaningful chunk of work (a feature, a fix, a refactor), **always run both checks before moving on**:

```bash
npx tsc --noEmit   # TypeScript — must produce no errors
npm run lint      # ESLint — must produce no errors or warnings
```

Fix all issues before proceeding. Do not leave type errors or lint warnings and continue.

**At the very end, when all work is complete**, run the full test suite and E2E tests:

```bash
npm test
npm run test:e2e
```

All tests must pass before the work is considered done.

# Local Development: Signing In

Use the **magic link** flow:
1. Go to `http://localhost:3000/auth/signin`
2. Enter any email and click **Send magic link**
3. The link is printed to the server log — check `.next/dev/logs/next-development.log` and grep for `[Auth] Magic link`
4. Copy the `http://localhost:3000/api/auth/callback/email?...` URL and navigate to it
5. You'll be redirected to `/app/onboarding/packs` on first sign-in

Example grep: `grep "Magic link" .next/dev/logs/next-development.log`

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
