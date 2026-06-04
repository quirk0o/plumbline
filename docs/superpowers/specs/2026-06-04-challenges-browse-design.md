# Challenges Browse & Detail — Design

**Date:** 2026-06-04
**Status:** Approved

## Purpose

The first challenges UI: a browse + manage hub at `/app/challenges` where users
discover public challenges and see their own, plus a read-only detail page from
which they can start a challenge run on one of their legacies.

The backend already exists (Prisma models, tRPC routers for challenges and
challenge runs). This work adds no schema changes.

## Scope

**In scope**

- List page at `/app/challenges`: search + tab filtering (All / Mine / Public)
- Read-only detail page at `/app/challenges/[id]`: description, phases, goals
- "Start run" action on the detail page (dialog: pick legacy, name the run)
- "Challenges" link in the app nav

**Out of scope**

- Creating or editing challenges (authoring UI is a later project)
- Tags, difficulty, categories, or any new challenge metadata
- Pagination (dataset is small: public + own challenges)
- "Start run" from list cards

## Routes & Navigation

- `/app/challenges` — server component. Reads `searchParams` (a Promise in
  Next.js 16 — must be awaited): `q` (search text) and `tab`
  (`all | mine | public`, default `all`).
- `/app/challenges/[id]` — server component. Unknown or inaccessible IDs call
  `notFound()`.
- "Challenges" entry added to the app nav (`src/app/app/components/app-nav.tsx`).

Tabs render as links (`?tab=mine`), preserving `q`. The search input is a small
client component that debounces ~300ms and updates the URL via
`router.replace` + `useTransition`, so typing stays smooth and search state is
shareable/bookmarkable. The input keeps focus across URL updates; only the
server-rendered grid changes.

## Data Layer

Both pages fetch with Prisma directly in the server component (dashboard
pattern). No new tRPC procedures for reading.

**List query** — one `findMany` combining:

- Access (always applied): `OR: [{ isPublic: true }, { ownerId: userId }]`.
  Another user's private challenge is never visible, regardless of tab/search.
- Tab: `mine` adds `ownerId: userId`; `public` adds `isPublic: true`; `all`
  adds nothing.
- Search: when `q` is non-empty after trimming,
  `OR: [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }]`.

Plus `_count: { select: { phases: true } }`, ordered by `name asc`. Invalid
`tab` values (or array params) coerce to `all`; empty `q` means no search
filter.

**Detail query** — `findFirst` with the same access `OR`, including `phases`
(ordered by `sortOrder`) with their `trackers` (ordered by `sortOrder`).
`null` → `notFound()`.

No new indexes: the access filter uses the existing `ownerId` index and the
dataset is small enough for `contains` search.

## List Page UI

- Header row: page title ("Challenges") with the search input on the right.
- Tab bar below: All / Mine / Public as underlined links, forest-green active
  state.
- Responsive card grid (3 columns desktop → 1 on mobile) using the shared
  `Card` component (`hoverable`). Each card links to the detail page and shows:
  - Challenge name (Cormorant display face)
  - Description excerpt, line-clamped to 2 lines
  - Meta line: phase count (singular/plural handled) + ownership badge —
    green **Public** or amber **Yours**. A challenge that is both yours and
    public shows **Yours** (amber is the personal accent).
- Empty states (shared `EmptyState`):
  - No challenges for the current tab — tab-aware copy (e.g. Mine: "You
    haven't created any challenges yet."). No call-to-action button, since
    authoring is out of scope.
  - No search matches — "No challenges match '⟨q⟩'" with a clear-search action
    that resets the URL.

## Detail Page UI

- Header: challenge name, meta line (ownership badge + phase count), full
  description, and a primary green **Start run** button.
- Phases: open list, all expanded, in `sortOrder`. Each phase card shows:
  - Title: phase `title`, else "Generation ⟨n⟩" when only `generationNumber`
    is set, else "Legacy-wide goals" when both are null.
  - Phase description, if present.
  - Goals: one line per tracker, in `sortOrder` — the tracker's `name`
    (a required field on `TrackerDefinition`) — with a decorative
    plumbob-style ◆ bullet (`aria-hidden`).
- Zero phases: quiet inline note ("This challenge has no phases yet"), not a
  full empty state.

## Start Run Flow

**Start run** opens a shared `Dialog` (client island):

- `Combobox` to pick one of the user's legacies (existing tRPC legacies
  listing).
- Run name input, pre-filled with the challenge name, editable.
- Confirm calls the existing `challengeRuns` create/link tRPC mutation, then
  navigates to that legacy's page.
- No legacies: the dialog shows a short message linking to the dashboard to
  create one first.
- Mutation errors render inline in the dialog; the dialog stays open.

## Error Handling & Edge Cases

- Unknown ID and private-but-not-yours both produce the same `notFound()` 404,
  so private challenge IDs leak nothing.
- Unauthenticated users are redirected by the existing `/app` auth guard.
- Malformed query params coerce to defaults; never an error.
- `ownerId: null` (system/orphaned challenges): just public challenges; badge
  logic only checks `ownerId === userId`.
- Long names/descriptions: clamped on cards, wrap freely on detail.

## Testing

Testing Trophy — mostly integration:

- **Integration (Vitest, test DB):** list query access control (others'
  private challenges never returned), tab filtering, case-insensitive search
  over name + description; detail access check. Start-run mutation is already
  covered by router tests — extend only if gaps exist.
- **Component/integration:** list page cards, badges, both empty states;
  detail page phase title fallbacks. Assert rendered output/roles; use
  `getByTestId` where needed; no CSS-source assertions.
- **E2E (Playwright):** one happy path — sign in → Challenges nav → search →
  switch tab → open detail → start run on a legacy → land on the legacy page.
  Locators scoped with `getByTestId`.
