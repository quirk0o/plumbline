# App Nav & Redirects — Design Spec

**Date:** 2026-05-04

## Problem

The app has no navigation and no authenticated home. After sign-in, users land on the public marketing page with no way to reach app pages except by typing URLs directly.

## Solution

Introduce an `/app` route prefix for all authenticated pages, with a shared top-bar nav in its layout. Move existing app pages under this prefix. Add a minimal dashboard as the authenticated landing.

---

## Route Structure

```
/                           public marketing landing
/auth/signin                sign-in page
/auth/error                 auth error page

/app                        dashboard (authenticated home)
/app/onboarding/packs       pack selection onboarding (first login)
/app/settings/packs         pack settings (returning users)
```

### File layout

```
src/app/
├── page.tsx                (marketing landing — unchanged)
├── layout.tsx              (root layout — unchanged)
├── auth/                   (unchanged)
└── app/
    ├── layout.tsx          ← new: top nav + auth guard
    ├── page.tsx            ← new: dashboard
    ├── onboarding/
    │   └── packs/
    │       ├── page.tsx    ← moved from /onboarding/packs/
    │       └── page.module.css
    └── settings/
        └── packs/
            ├── page.tsx    ← moved from /settings/packs/
            └── page.module.css
```

Old routes `/onboarding/packs` and `/settings/packs` are deleted; their directories removed.

---

## Nav (top bar)

A server component rendered in `app/app/layout.tsx`. Reads session server-side to get user name/email for the avatar.

**Layout:**
- Left: plumbob SVG + "SimsTrack" wordmark → links to `/app`
- Centre: nav links — "Dashboard" (`/app`) · "Settings" (`/app/settings/packs`)
- Right: avatar (user initial, or image if available) + "Sign out" button

**Active state:** link matching the current pathname gets `color: var(--green)` highlight. Use `usePathname()` in a thin client wrapper for the links only.

**Sign out:** calls `signOut()` from `next-auth/react` client-side, redirects to `/`.

**Styles:** CSS Module. Dark top bar (`background: var(--bg)`), `border-bottom: 1px solid var(--border)`, 48px height, same font/palette as rest of app. No green text — active link uses `--green` for the link only (not labels/chrome).

---

## Auth Guard

`app/app/layout.tsx` is a server component. It calls `auth()` and redirects to `/auth/signin?callbackUrl=/app` if no session. All pages under `/app/*` are protected this way — individual pages no longer need their own redirect.

---

## Dashboard (`/app`)

Minimal authenticated landing. Server component.

Contents:
- Greeting: "Welcome back, [name]." (or "Welcome." if name is null)
- Pack summary card: "X packs selected · [Manage →](/app/settings/packs)"
- Placeholder copy: "Your legacies will appear here." (future home for legacy list)

---

## Redirect Logic

| Scenario | Redirect to |
|---|---|
| First sign-in (new user) | `/app/onboarding/packs` |
| Returning sign-in | `/app` |
| Unauthenticated access to `/app/*` | `/auth/signin?callbackUrl=/app` |
| Onboarding "Continue" | `/app` |
| Sign out | `/` |

**First sign-in:** `auth.config.ts` already has `pages.newUser: '/onboarding/packs'` — update to `/app/onboarding/packs`.

**Returning sign-in:** Sign-in page (`SignInForm.tsx`) currently passes `callbackUrl` from the query string. Update the default (when no `callbackUrl` is present) to `/app` instead of whatever NextAuth defaults to.

---

## What Changes In Moved Pages

Pages moved under `/app/` no longer need their own `if (!session) redirect(...)` guards — the layout handles it. Remove those checks from the moved `onboarding/packs/page.tsx` and `settings/packs/page.tsx`. They still call `auth()` to get `session.user.id` for the DB query.

---

## What Does Not Change

- Root layout (`src/app/layout.tsx`) — no nav added here; marketing page keeps its own inline nav
- Marketing landing page (`/`) — unchanged
- `auth.ts`, `auth.config.ts` — only `newUser` path changes
- `PackGrid` component — no changes needed
- tRPC router — no changes needed
