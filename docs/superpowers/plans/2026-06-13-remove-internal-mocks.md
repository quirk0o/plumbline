# Remove Internal Mocks from the Test Suite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every test in `src/**` into compliance with the "Mock Only External Boundaries — Never Internal Code" rule in `.claude/rules/testing.md` by deleting mocks of our own components, helpers, wrappers, and design-system primitives, and rendering/calling the real thing instead.

**Architecture:** Each test file is fixed in isolation. The pattern is always the same: delete the internal `vi.mock(...)`, render the real module, and (a) for components, drive them through their real accessible UI; (b) for tRPC-backed children, extend the file's existing `@/trpc/client` mock with the procedures the now-real child calls; (c) for wrappers (`@/lib/auth`, `@/lib/storage`), mock the external library underneath. One small production change adds a `data-testid` to the milestone "derived" marker so its presence stays assertable.

**Tech Stack:** Vitest + React Testing Library (jsdom), `@testing-library/user-event`, MSW (network seam, configured in `src/test/setup.ts`), `aws-sdk-client-mock` for S3, cmdk-based `Combobox`, `@xyflow/react` (renders for real in jsdom via shims in `src/test/setup.ts`).

**Branch:** `chore/testing-rules-no-internal-mocks` (the rule commit `e8f40692` already lives here). Commit per task with conventional-commit messages via the `but` CLI (see `/but` skill) — **not** raw `git`.

---

## Ground Truth Established During Planning

These facts were verified against the codebase and underpin every task:

- **`src/test/setup.ts`** provides: MSW `server` (with `onUnhandledRequest: 'error'`), `ResizeObserver`, `scrollIntoView`, `matchMedia`, Pointer Capture no-ops, and the full `@xyflow/react` jsdom shim set (`DOMMatrixReadOnly`, `offsetHeight/Width`, `getBBox`, d3-zoom `view` fix). So **real `LineageFlow` and real cmdk `Combobox` render in jsdom**.
- **`src/components/lineage-tree/__tests__/lineage-flow.test.tsx`** is the reference: it renders the real `LineageFlow` inside `<ReactFlowProvider>` with **no `@xyflow/react` mock**, and queries nodes as `getByRole('button', { name: 'Bella Goth, Adult' })`. Node click → `onSelectSim(id)`.
- **`src/components/ui/combobox/__tests__/combobox.test.tsx`** is the reference for driving the real `Combobox`: click the trigger button (named by placeholder or current value), type into `getByPlaceholderText('Search…')`, click an item by its visible text; `onChange` fires with the item `value`.
- **`src/components/plumbob.tsx`** renders a decorative `aria-hidden` span with **no testid** — invisible to RTL role/text queries.
- Child-component external dependencies (the procedures to add to each file's `@/trpc/client` mock):
  - `SimInspector` → `trpc.sims.getById.useQuery({ id })`
  - `NameHeirDialog` → `trpc.sims.update.useMutation()` + `useRouter().refresh()`
  - `CreateSimModal` → `trpc.traits.getAll`, `trpc.aspirations.getAll`, `trpc.careers.getAll`, `trpc.households.listByLegacy`, `trpc.sims.create` (mutation)
  - `TraitPicker` is pure (props `traits`, `selected`, `onChange`, `lifeStage`); renders a `<button>` per trait, plus `aria-label={`Remove ${trait.name}`}` for selected ones
  - `ImageUpload` only calls `fetch('/api/upload')` on file-select; rendering it idle needs no network
- **`@/lib/auth`** = `cache(rawAuth)` where `rawAuth` comes from the root `auth.ts` `NextAuth(...)` instance → mock `next-auth`.
- **`@/lib/storage`** wraps `@aws-sdk/client-s3` (`S3Client` + `GetObjectCommand`/`PutObjectCommand`) → mock with `aws-sdk-client-mock`. `src/app/api/upload/route.test.ts` already does this for `PutObjectCommand`; copy that shape.

**Per-task verification** (run after each task, before its commit):
```bash
npx tsc --noEmit
npm run lint
npx vitest run <the-file-under-test>
```
**Final verification** (after the last task): `npm test`.

---

## Task 1: media route — mock S3Client, not `@/lib/storage`

**Files:**
- Modify/Test: `src/app/media/[...key]/route.test.ts`

- [ ] **Step 1: Read the current test and the route + helper it covers**

Read `src/app/media/[...key]/route.test.ts`, `src/app/media/[...key]/route.ts`, and `src/lib/storage.ts` (`getObject` returns `null` on `NoSuchKey`/404 and rethrows other errors). Note every assertion that depends on `getObject` being a `vi.fn()`.

- [ ] **Step 2: Replace the wrapper mock with an S3 client mock**

Delete:
```ts
vi.mock('@/lib/storage', () => ({ getObject: vi.fn() }))
import { getObject } from '@/lib/storage'
const mockedGetObject = vi.mocked(getObject)
```
Add (mirroring `src/app/api/upload/route.test.ts:1-11`):
```ts
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const s3Mock = mockClient(S3Client)
beforeEach(() => s3Mock.reset())
```
Drive the three real `getObject` branches through the S3 client:
- **Hit:** `s3Mock.on(GetObjectCommand).resolves({ Body: { transformToByteArray: async () => new Uint8Array(PNG_BYTES) }, ContentType: 'image/png' })` — assert the route streams the bytes + content-type.
- **Missing → 404:** `s3Mock.on(GetObjectCommand).rejects(Object.assign(new Error('nope'), { name: 'NoSuchKey' }))` — assert the route's not-found response.
- **Transient failure → rethrow:** `s3Mock.on(GetObjectCommand).rejects(Object.assign(new Error('boom'), { $metadata: { httpStatusCode: 500 } }))` — assert the route's error response.

Reuse the `PNG_BYTES` buffer pattern from `upload/route.test.ts`. Read `route.ts` to match the exact status codes/headers it returns.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint && npx vitest run "src/app/media/[...key]/route.test.ts"`
Expected: PASS. The real `getObject` (including its missing-vs-error branching) now executes.

- [ ] **Step 4: Commit** (via `/but` skill)

`test(media): mock S3Client instead of the @/lib/storage wrapper`

---

## Task 2: upload route — mock `next-auth`, not `@/lib/auth`

**Files:**
- Modify/Test: `src/app/api/upload/route.test.ts`

- [ ] **Step 1: Inspect the auth chain**

Read `src/app/api/upload/route.test.ts`, `src/lib/auth.ts` (`export const auth = cache(rawAuth)`), and the root `auth.ts` (`export const { auth: rawAuth, ... } = NextAuth(config)` — confirm the exact export names). The S3 side already uses `aws-sdk-client-mock` — leave it untouched.

- [ ] **Step 2: Replace the wrapper mock with a `next-auth` mock**

Delete:
```ts
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
import { auth } from '@/lib/auth'
const mockedAuth = vi.mocked(auth)
```
Add a `next-auth` mock whose returned `auth()` is controllable, leaving `src/lib/auth.ts` and the root `auth.ts` real:
```ts
const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }))
vi.mock('next-auth', () => ({
  default: () => ({
    auth: mockAuth,
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))
```
> If the root `auth.ts` also imports `next-auth/providers/*` at module load, add matching `vi.mock('next-auth/providers/<x>', ...)` stubs returning a no-op provider so the config builds. Confirm by reading the root `auth.ts` imports.

Replace `mockedAuth.mockResolvedValue(...)` calls with `mockAuth.mockResolvedValue(...)` (authed: a session object; unauthed: `null`). `beforeEach(() => mockAuth.mockReset())`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint && npx vitest run src/app/api/upload/route.test.ts`
Expected: PASS. The real `cache(rawAuth)` wrapper now runs; only `next-auth` is faked.

- [ ] **Step 4: Commit** — `test(upload): mock next-auth instead of the @/lib/auth wrapper`

---

## Task 3: sign-in-form — render the real Plumbob

**Files:**
- Modify/Test: `src/app/auth/signin/__tests__/sign-in-form.test.tsx:16`

- [ ] **Step 1: Delete the stub**

Remove `vi.mock('@/components/plumbob', () => ({ Plumbob: () => null }))`. Keep the `next-auth/react` and `next/navigation` mocks (external). No assertion references the plumbob, so nothing else changes — the real decorative `aria-hidden` span renders harmlessly.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint && npx vitest run src/app/auth/signin/__tests__/sign-in-form.test.tsx`
Expected: PASS (unchanged assertions).

- [ ] **Step 3: Commit** — `test(sign-in): render real Plumbob instead of stubbing it`

---

## Task 4: milestone "derived" marker — add a test ID, render real Plumbob

**Files:**
- Modify: `src/app/app/legacies/[slug]/_components/milestones/milestone-row.tsx:43-52`
- Test: `src/app/app/legacies/[slug]/_components/__tests__/milestone-row.test.tsx`

- [ ] **Step 1: Add a symmetric `data-testid` to the derived marker (production)**

The authored branch already carries `data-testid="milestone-authored-marker"`. Give the derived branch a parallel hook by wrapping the real `Plumbob` (keep it decorative):
```tsx
) : (
  <span data-testid="milestone-derived-marker" aria-hidden="true">
    <Plumbob size={10} />
  </span>
)}
```
(The wrapper inherits no layout role; if `styles.marker` already centers its child this is visually inert. Confirm against `milestone-row.module.css` and, if the marker relied on the Plumbob being the direct flex child, move the testid onto an existing element instead of adding a wrapper.)

- [ ] **Step 2: Update the test — drop the Plumbob stub, assert the new testid**

Delete:
```ts
vi.mock('@/components/plumbob', () => ({
  Plumbob: ({ size }: { size?: number }) => (
    <span data-testid="plumbob" data-size={size} aria-hidden="true" />
  ),
}))
```
Change the assertion at line 77:
```ts
expect(screen.getByTestId('milestone-derived-marker')).toBeInTheDocument()
```
Keep `next/image` and `next/link` mocks (external). The real Plumbob now renders inside the marker.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint && npx vitest run "src/app/app/legacies/[slug]/_components/__tests__/milestone-row.test.tsx"`
Expected: PASS — derived rows expose `milestone-derived-marker`, authored rows expose `milestone-authored-marker`.

- [ ] **Step 4: Commit** — `test(milestones): assert real derived marker via testid, drop Plumbob stub`

> This is a UI-adjacent production change (a decorative wrapper). Per AGENTS.md, run the design-system-reviewer + web-qa-tester only if any visual regression is suspected; a wrapper around an existing decorative span is inert, so a visual diff check is sufficient.

---

## Task 5: TraitPicker — render real in sim-form and create-sim-modal

**Files:**
- Test: `src/app/components/__tests__/sim-form.test.tsx:8-13`
- Test: `src/app/components/__tests__/create-sim-modal.test.tsx:24-25`

- [ ] **Step 1: sim-form — delete the trait-picker stub, drive the real one**

Read `src/app/components/__tests__/sim-form.test.tsx` fully and `src/app/components/trait-picker.tsx`. Remove:
```ts
vi.mock('../trait-picker', () => ({
  TraitPicker: ({ onChange }) => (<button ... onClick={() => onChange(['trait-1'])}>Pick trait</button>),
}))
```
The form already passes a `traits` prop containing `{ id: 'trait-1', name: 'Outgoing', ... }`. Replace the synthetic `'Pick trait'` click with a click on the real trait button. From `trait-picker.tsx`, an unselected trait renders a `<button>` whose label includes the trait name; assert/await it and click it:
```ts
await userEvent.click(screen.getByRole('button', { name: /Outgoing/ }))
```
Then assert the form's observable result (the submit payload includes `traitIds: ['trait-1']`), exactly as before. If `TraitPicker` filters by `lifeStage`, ensure the rendered sim's life stage admits the fixture trait (the fixture trait has `minLifeStage: null, maxLifeStage: null`, so it always shows).

- [ ] **Step 2: create-sim-modal — delete the trait-picker stub the same way**

In `src/app/components/__tests__/create-sim-modal.test.tsx`, remove `vi.mock('../trait-picker', ...)`. Keep the `@/trpc/client` and `../image-upload` lines for now (image-upload handled in Task 6). Replace any `'Pick trait'`-style click with a real trait-button click as in Step 1, using whatever trait the test's `traits.getAll` mock returns.

- [ ] **Step 3: Verify each file**

Run: `npx vitest run src/app/components/__tests__/sim-form.test.tsx src/app/components/__tests__/create-sim-modal.test.tsx` (after `tsc`/`lint`).
Expected: PASS.

- [ ] **Step 4: Commit** — `test(sims): drive the real TraitPicker instead of stubbing it`

---

## Task 6: ImageUpload — render real (idle) everywhere it was stubbed

**Files:**
- Test: `src/app/components/__tests__/sim-form.test.tsx:8`
- Test: `src/app/components/__tests__/create-sim-modal.test.tsx:24`
- Test: `src/app/app/legacies/new/__tests__/legacy-wizard.test.tsx:32`
- Test: `src/app/app/legacies/[slug]/sims/[id]/__tests__/identity-section.test.tsx:17`

- [ ] **Step 1: Read `src/app/components/image-upload.tsx`**

Confirm it renders idle (a file input + a trigger button) with no network call until a file is selected. Confirm none of the four tests actually exercises an upload (they stub it only to avoid rendering it).

- [ ] **Step 2: Delete each `image-upload` mock**

Remove these lines (exact strings vary slightly per file):
- `sim-form.test.tsx`: `vi.mock('../image-upload', () => ({ ImageUpload: () => null }))`
- `create-sim-modal.test.tsx`: `vi.mock('../image-upload', () => ({ ImageUpload: () => null }))`
- `legacy-wizard.test.tsx`: `vi.mock('@/app/components/image-upload', () => ({ ImageUpload: () => null }))`
- `identity-section.test.tsx`: `vi.mock('@/app/components/image-upload', () => ({ ImageUpload: () => <div data-testid="image-upload" /> }))`

For `identity-section.test.tsx`, if any assertion referenced `data-testid="image-upload"`, replace it with a query for the real control (from `image-upload.tsx`, e.g. `getByRole('button', { name: /change portrait|upload/i })` — confirm the real label).

- [ ] **Step 3: Add an MSW handler only if a test triggers an upload**

No current test uploads, so no handler is needed. If a future edit selects a file, add to the test (not global setup):
```ts
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
server.use(http.post('/api/upload', () => HttpResponse.json({ url: '/media/uploads/x.png' })))
```

- [ ] **Step 4: Verify each file**

Run `tsc`/`lint`, then `npx vitest run` on all four files. Expected: PASS, with no "unhandled request" MSW errors (because nothing uploads).

- [ ] **Step 5: Commit** — `test(uploads): render the real ImageUpload idle instead of stubbing it`

---

## Task 7: identity-section — render the real cmdk Combobox

**Files:**
- Test: `src/app/app/legacies/[slug]/sims/[id]/__tests__/identity-section.test.tsx:23-47`

- [ ] **Step 1: Delete the `@/components/ui` Combobox stub**

Read the full test and `src/app/app/legacies/[slug]/sims/[id]/identity-section.tsx` (Gender/Life stage/Occult/Generation comboboxes, each with an `aria-label`; `onChange(v)` then `trpc.sims.update` mutation). Remove the entire `vi.mock('@/components/ui', () => { ... Combobox ... })` block. Keep the `@/trpc/client` and `next/image` mocks (external/transport). Keep the real `ImageUpload` from Task 6.

- [ ] **Step 2: Rewrite combobox interactions using the proven cmdk pattern**

Replace `selectOptions(getByLabelText('Gender'), 'MALE')`-style calls (which only worked against the `<select>` stub) with the real flow from `combobox/__tests__/combobox.test.tsx`. The trigger is a button labelled by the current value (or placeholder); open it, then click the option text:
```ts
const user = userEvent.setup()
// open the Gender combobox (trigger button currently shows the selected value/placeholder)
await user.click(screen.getByRole('button', { name: /gender/i }))   // confirm accessible name from identity-section.tsx
await user.click(screen.getByText('Male'))
// observable result: the update mutation fires with { gender: 'MALE' }
await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ gender: 'MALE' })))
```
> The combobox trigger's accessible name comes from the value/placeholder, not the `aria-label` alone — read `combobox.tsx` to confirm how the trigger exposes its name, and mirror the reference test's `getByRole('button', { name: ... })`. If two comboboxes share an ambiguous name, scope with `within()` over the field's container queried by its visible label.

- [ ] **Step 3: Verify**

Run `tsc`/`lint`, then `npx vitest run "src/app/app/legacies/[slug]/sims/[id]/__tests__/identity-section.test.tsx"`.
Expected: PASS. Real cmdk Combobox drives the real update mutation.

- [ ] **Step 4: Commit** — `test(identity): drive the real Combobox instead of stubbing @/components/ui`

---

## Task 8: succession — render the real NameHeirDialog

**Files:**
- Test: `src/app/app/legacies/[slug]/_components/__tests__/succession.test.tsx:29-31`

- [ ] **Step 1: Delete the dialog stub, mock its real boundaries**

Read the full test and `src/app/app/legacies/[slug]/_components/succession/name-heir-dialog.tsx`. Remove:
```ts
vi.mock('../succession/name-heir-dialog', () => ({ NameHeirDialog: () => <div data-testid="name-heir-dialog" /> }))
```
The dialog uses `trpc.sims.update.useMutation()` and `useRouter().refresh()`. Add the external/transport mocks the file doesn't already have:
```ts
const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }))
vi.mock('@/trpc/client', () => ({
  trpc: { sims: { update: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) } } },
}))
```

- [ ] **Step 2: Rewrite presence assertions against the real dialog**

The current tests assert the *presence/absence* of the `name-heir-dialog` testid (the "Name an heir" slot shows for eligible rows). Against the real dialog, assert the real trigger instead — from `name-heir-dialog.tsx` the closed dialog renders a trigger `<button>` (read it for the exact label, e.g. "Name an heir"):
```ts
expect(screen.getByRole('button', { name: /name an heir/i })).toBeInTheDocument()   // slot present
expect(screen.queryByRole('button', { name: /name an heir/i })).not.toBeInTheDocument() // slot absent
```
Do **not** re-test candidate filtering / option labels here — that already lives in `name-heir-dialog.test.tsx`. Keep the existing `next/image` + `next/link` mocks.

- [ ] **Step 3: Verify**

Run `tsc`/`lint`, then `npx vitest run "src/app/app/legacies/[slug]/_components/__tests__/succession.test.tsx"`.
Expected: PASS.

- [ ] **Step 4: Commit** — `test(succession): render real NameHeirDialog, mock only its tRPC/router`

---

## Task 9: family-tree-mini — render the real LineageFlow

**Files:**
- Test: `src/app/app/legacies/[slug]/sims/[id]/__tests__/family-tree-mini.test.tsx:12-35`

- [ ] **Step 1: Delete the xyflow + LineageFlow mocks**

Read the full test. Remove both:
```ts
vi.mock('@xyflow/react', () => ({ ReactFlowProvider: ({ children }) => <>{children}</> }))
vi.mock('@/components/lineage-tree/lineage-flow', () => ({ LineageFlow: ({ ... }) => (...) }))
```
Keep the `next/navigation` and `@/trpc/client` mocks (external/transport). Import the real `ReactFlowProvider` from `@xyflow/react`; if `FamilyTreeMini` already wraps its own provider, no wrapper is needed (confirm by reading the component).

- [ ] **Step 2: Query the real tree**

Replace `getByTestId('lineage-flow')` and the synthetic click with the reference pattern from `lineage-flow.test.tsx`:
```ts
// group label (LineageFlow derives it from legacyName + sim count)
expect(screen.getByRole('group', { name: /tree — \d+ sims/i })).toBeInTheDocument()
// node click → navigation
await userEvent.click(screen.getByRole('button', { name: /Reed Caliente/ }))   // a node from the mock data
expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/sims/'))        // confirm the real nav target from the component
```
Use sim fixtures whose shape matches `LineageFlowSim` (see `lineage-flow.test.tsx`: `id, firstName, lastName, imageUrl, generationNumber, lifeStage, isHeir, isDeceased, gender`). Adjust the `getMiniTreeData` mock's returned shape to the real `LineageFlow` props if needed.

- [ ] **Step 3: Verify**

Run `tsc`/`lint`, then `npx vitest run "src/app/app/legacies/[slug]/sims/[id]/__tests__/family-tree-mini.test.tsx"`.
Expected: PASS.

- [ ] **Step 4: Commit** — `test(family-tree-mini): render the real LineageFlow instead of stubbing it`

---

## Task 10: tree-atlas — render the real LineageFlow + SimInspector (coverage decision)

**Files:**
- Test: `src/app/app/legacies/[slug]/_components/tree-atlas/__tests__/tree-atlas.test.tsx`

This is the highest-effort file. It currently mocks two **internal** modules (`@/components/lineage-tree/lineage-flow`, `../sim-inspector`) — both violations — plus a minimal `@xyflow/react` mock kept only so three tests can assert `mockFitView`/`mockZoomIn`/`mockZoomOut` were called.

**Coverage decision (resolve before editing):** Rendering the real `LineageFlow` requires the real `@xyflow/react` (the minimal mock has no `ReactFlow` component), which removes the `mockFitView`/zoom spies. Those three assertions — "fitView was called with FIT_VIEW_OPTIONS + 200ms", zoom-in/out called — are **implementation-detail tests** (asserting an internal collaborator was called) and are disallowed by the same rule we're enforcing. **Recommended resolution:** drop the call-spies and assert only the *observable* control state (the Fit/zoom controls render when there are visible sims and disappear when the filtered set is empty — already partly covered by the "hides the zoom bar" test). The actual viewport change is xyflow's behavior and is not observable in jsdom, so it is not ours to assert. If product wants the wiring guarded, that belongs in a focused test of the zoom-bar component with a real provider, not here.

- [ ] **Step 1: Delete the internal mocks and the xyflow mock**

Remove:
```ts
vi.mock('@xyflow/react', () => ({ ... mockZoomIn/mockZoomOut/mockFitView ... }))
vi.mock('@/components/lineage-tree/lineage-flow', () => ({ LineageFlow: ... }))
vi.mock('../sim-inspector', () => ({ SimInspector: ... }))
```
and the `vi.hoisted` block creating `mockZoomIn/mockZoomOut/mockFitView`. Keep `next/link` (external) and the `@/trpc/client` mock (transport). Keep the `FIT_VIEW_OPTIONS` real import only if still referenced after Step 4.

- [ ] **Step 2: Wrap render in the real provider and extend the tRPC mock for SimInspector**

`TreeAtlas` uses `useReactFlow()` for its zoom bar, so it must render under a real `<ReactFlowProvider>`. Add a render helper:
```ts
import { ReactFlowProvider } from '@xyflow/react'
function renderAtlas(props = defaultProps) {
  return render(
    <ReactFlowProvider>
      <div style={{ width: 800, height: 600 }}>
        <TreeAtlas {...props} />
      </div>
    </ReactFlowProvider>,
  )
}
```
Extend the `@/trpc/client` mock so the now-real `SimInspector` can fetch — it calls `trpc.sims.getById.useQuery({ id })`:
```ts
const { mockTreeQuery, mockGetById } = vi.hoisted(() => ({ mockTreeQuery: vi.fn(), mockGetById: vi.fn() }))
vi.mock('@/trpc/client', () => ({
  trpc: {
    sims: {
      getTreeData: { useQuery: mockTreeQuery },
      getById: { useQuery: mockGetById },
    },
  },
}))
```
Default `mockGetById` in `beforeEach` to a resolved sim matching `s2` so the inspector renders its detail view.

- [ ] **Step 3: Swap testid assertions for accessible queries**

- Tree presence (`getByTestId('lineage-flow')` → a real node button): `screen.getByRole('button', { name: /Dina Caliente/ })`. Absence checks become `queryByRole(...)`.
- Node selection opens the **real** inspector: click a real node button (`/Reed Caliente/`) and assert the inspector's real region: `screen.getByRole('complementary' | 'dialog' | ...)` — confirm from `sim-inspector.tsx` (it sets `aria-label={`${first} ${last} details`}`), so:
  ```ts
  await userEvent.click(screen.getByRole('button', { name: /Reed Caliente/ }))
  expect(await screen.findByRole('region', { name: /Reed Caliente details/i })).toBeInTheDocument()
  ```
  (Use the actual landmark role the inspector renders — read its root element.)
- The `getTreeData` mock data already matches the real `LineageFlow` props shape used elsewhere; if `LineageFlow` needs `partnerEdges`/`familyEdges`/`gender`/`isDeceased`, extend the fixtures to the `LineageFlowSim` shape from `lineage-flow.test.tsx`.

- [ ] **Step 4: Apply the coverage decision to the three zoom/fit tests**

Delete the `mockFitView`-args assertion and the zoom-in/out call assertions. Replace the Fit test with an observable check that the control exists when there are visible sims:
```ts
it('shows the fit-to-view control when the tree has sims', () => {
  renderAtlas()
  expect(screen.getByRole('button', { name: /fit tree to view/i })).toBeInTheDocument()
})
```
Keep the existing "hides the zoom bar when a gen filter has no sims" test, updating its tree-presence checks to the accessible queries from Step 3.

- [ ] **Step 5: Verify**

Run `tsc`/`lint`, then `npx vitest run "src/app/app/legacies/[slug]/_components/tree-atlas/__tests__/tree-atlas.test.tsx"`.
Expected: PASS. If real xyflow throws in jsdom, confirm `src/test/setup.ts` shims are loading (they are global) and that the provider wrapper has explicit width/height.

- [ ] **Step 6: Commit** — `test(tree-atlas): render real LineageFlow + SimInspector; drop fitView wiring asserts`

---

## Task 11: add-relationship-modal — render the real CreateSimModal

**Files:**
- Test: `src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx:8-23`

- [ ] **Step 1: Read both the test and the real CreateSimModal**

Read the full test and `src/app/components/create-sim-modal.tsx`. The modal calls `trpc.traits.getAll`, `trpc.aspirations.getAll`, `trpc.careers.getAll`, `trpc.households.listByLegacy`, and `trpc.sims.create` (mutation). It also renders the real `TraitPicker` and `ImageUpload` (both fine now). Identify which assertions depended on the stub's synthetic "Confirm create"/"Cancel create" buttons and `onCreated` payload.

- [ ] **Step 2: Delete the CreateSimModal stub, mock its tRPC**

Remove:
```ts
vi.mock('@/app/components/create-sim-modal', () => ({ CreateSimModal: ({ onCreated, onClose }) => (...) }))
```
Add (or extend the file's existing) `@/trpc/client` mock to supply the modal's queries + create mutation:
```ts
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))
vi.mock('@/trpc/client', () => ({
  trpc: {
    traits: { getAll: { useQuery: () => ({ data: [], isLoading: false }) } },
    aspirations: { getAll: { useQuery: () => ({ data: [], isLoading: false }) } },
    careers: { getAll: { useQuery: () => ({ data: [], isLoading: false }) } },
    households: { listByLegacy: { useQuery: () => ({ data: [], isLoading: false }) } },
    sims: { create: { useMutation: () => ({ mutateAsync: mockCreate, isPending: false }) },
            /* keep any procedures AddRelationshipModal itself already needed */ },
  },
}))
```

- [ ] **Step 3: Drive the real create flow**

Where the old test clicked the synthetic "Confirm create", instead open the real modal, fill its required fields through the real UI (first/last name inputs by label, life stage/gender via the real Combobox per Task 7's pattern), set `mockCreate.mockResolvedValue({ id: 'sim-new', firstName: 'Nina', lastName: 'Caliente', imageUrl: null })`, and submit by the modal's real submit button. Then assert the **observable** outcome AddRelationshipModal produces (the new sim appears as the selected partner / the relationship row reflects "Nina Caliente") — read `add-relationship-modal.tsx` to confirm the post-create UI. For the cancel path, click the modal's real Cancel/close affordance and assert the dialog closes.

> This is the heaviest single task. If the real create form is large, keep the journey minimal: fill only required fields, rely on the `mockCreate` resolution to drive `onCreated`, and assert the one observable result. Do not re-test CreateSimModal's own field validation here — that belongs in `create-sim-modal.test.tsx`.

- [ ] **Step 4: Verify**

Run `tsc`/`lint`, then `npx vitest run "src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx"`.
Expected: PASS.

- [ ] **Step 5: Commit** — `test(relationships): render real CreateSimModal, mock only its tRPC`

---

## Task 12: layout a11y — wrap in the real ThemeProvider

**Files:**
- Test: `src/app/app/__tests__/layout.a11y.test.tsx:18-22`

- [ ] **Step 1: Delete the theme-provider stub, render the real provider**

Read the full test and `src/components/theme-provider.tsx`. Remove:
```ts
vi.mock('@/components/theme-provider', () => ({ ThemeProvider: ..., ThemeToggle: () => null, useTheme: ... }))
```
Keep the `next/navigation` (`usePathname`) and `next-auth/react` (`signOut`) mocks (external). Wrap the render in the real provider so `useTheme()` reads real context and the real `ThemeToggle` renders:
```ts
import { ThemeProvider } from '@/components/theme-provider'
function renderShell() {
  return render(
    <ThemeProvider>
      <AppShell name="Ada" email="ada@example.com" image={null}>
        <div>Page content</div>
      </AppShell>
    </ThemeProvider>,
  )
}
```
`src/test/setup.ts` already provides `matchMedia` and `localStorage` is jsdom-native, so the provider initializes cleanly. If the real `ThemeToggle` adds a new accessible control, the a11y assertions still hold (it's a labelled button); confirm the axe/landmark assertions remain green.

- [ ] **Step 2: Verify**

Run `tsc`/`lint`, then `npx vitest run src/app/app/__tests__/layout.a11y.test.tsx`.
Expected: PASS.

- [ ] **Step 3: Commit** — `test(layout): wrap in the real ThemeProvider instead of stubbing it`

---

## Task 13: Final sweep + full suite

- [ ] **Step 1: Confirm no internal mocks remain**

Run:
```bash
grep -rnE "vi\.mock\('(\.\.?/|@/(components|app|lib|server)/)" src --include="*.test.ts" --include="*.test.tsx"
```
Expected: **no matches** except `@/trpc/client` (the sanctioned transport exception) and `@/test/*` helpers. Investigate anything else.

- [ ] **Step 2: Full unit/integration suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 3: Targeted visual check for Task 4's marker (UI-adjacent)**

Since Task 4 touched a rendered component, eyeball the milestones list (dev server, magic-link sign-in per AGENTS.md) or run the design-system-reviewer on `milestone-row.tsx` to confirm the derived plumbob marker is visually unchanged.

- [ ] **Step 4: Commit any sweep fixes** — `test: remove last internal-module mocks; full suite green`

---

## Self-Review Notes

- **Spec coverage:** every internal `vi.mock` site found in analysis (route ×2, plumbob ×2 [sign-in + milestone], trait-picker ×2, image-upload ×4, combobox ×1, name-heir-dialog ×1, lineage-flow ×2, sim-inspector ×1, create-sim-modal ×1, theme-provider ×1) maps to Tasks 1–12; Task 13 is the backstop grep.
- **Sanctioned exception preserved:** `@/trpc/client` mocks are intentionally kept (rule's one in-browser-transport exception).
- **Risk ordering:** Tasks 1–6 are low risk; 7–9 medium; 10–11 highest (tree-atlas coverage decision; full create flow). Stop and consult if a medium/high task can't reach green without re-introducing an internal mock — that is a signal to reconsider the component boundary, not to revert.
- **Type consistency:** child-procedure names (`sims.getById`, `sims.update`, `sims.create`, `traits.getAll`, `aspirations.getAll`, `careers.getAll`, `households.listByLegacy`) are used verbatim from the components; fixture shapes follow `LineageFlowSim` from `lineage-flow.test.tsx`.
