<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Key breaking change: middleware → proxy

In Next.js 16, `middleware.ts` was renamed to `proxy.ts`. The request-interception file in this project is **`src/proxy.ts`** and it exports a named `proxy` function (not `middleware`). Never suggest renaming it or creating a `middleware.ts`. See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

<!-- END:nextjs-agent-rules -->

# Version control

- Use GitButler (`but`) for version-control write operations, including
  branching, committing, pushing, and history edits.
- Assume multiple agents may be working in this repository. Do not move, amend,
  squash, discard, commit, push, or otherwise modify another agent's work unless
  the user asks.
- Use a dedicated GitButler branch for each agent session, unless the user asks
  for a different branch structure. Commit only changes that belong to that
  session.
- Do not push or open pull requests unless the user asks.
- Keep commit messages and pull request descriptions succinct: explain what
  changed, why it changed, and any important decision.

## Commits

**Use conventional commits.** Follow the Conventional Commits spec for all commit messages. This ensures clear, consistent history and enables automated tooling.

## Stacking

- If this session depends on another in-flight branch, stack its branch on top
  of that dependency instead of mixing the changes.
- If this session is working in a stack, put commits on the branch where they
  belong.
- Ask before moving commits onto lower, pushed, reviewed, or shared branches.
- Use `but move` for branch stacking and restacking. Do not recreate branches
  to simulate stacking.

## Merge Conflicts

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

# Subagent-driven development

Always use git butler when using sub-agent driven development. Never commit directly to the main branch. Each sub-agent project should have its own  branch, which can be merged into master when ready.

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
`/media/<key>` route, which streams the object's bytes from S3/MinIO. (It does
not redirect to a presigned URL — `next/image`'s optimizer does not follow such
redirects.) In development, `next.config.ts` sets `images.dangerouslyAllowLocalIP`
so the optimizer can fetch from local MinIO; production uses a public R2 host.

To migrate legacy `/uploads/...` rows from a previous local setup:

```bash
npm run backfill:uploads -- --dry-run   # preview
npm run backfill:uploads                # apply
# SOURCE_UPLOAD_DIR=/path/to/other/worktree/public/uploads npm run backfill:uploads
```
