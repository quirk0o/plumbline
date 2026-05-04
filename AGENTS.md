<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Key breaking change: middleware → proxy

In Next.js 16, `middleware.ts` was renamed to `proxy.ts`. The request-interception file in this project is **`src/proxy.ts`** and it exports a named `proxy` function (not `middleware`). Never suggest renaming it or creating a `middleware.ts`. See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
<!-- END:nextjs-agent-rules -->

# Local Development: Signing In

Use the **magic link** flow:
1. Go to `http://localhost:3000/auth/signin`
2. Enter any email and click **Send magic link**
3. The link is printed to the server log — check `.next/dev/logs/next-development.log` and grep for `[Auth] Magic link`
4. Copy the `http://localhost:3000/api/auth/callback/email?...` URL and navigate to it
5. You'll be redirected to `/app/onboarding/packs` on first sign-in

Example grep: `grep "Magic link" .next/dev/logs/next-development.log`
