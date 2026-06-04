# Test Suite Guideline Fixes — Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every accepted finding from the second four-reviewer batch (2026-06-04), under the user's blanket overrides.

**User overrides (binding, no exceptions except `src/app/__tests__/contrast.test.ts`):**
- NO `font-style` assertions anywhere in tests.
- NO `document.getElementById` in tests — use `getByTestId` (components gain `data-testid` where needed).
- NO opacity assertions.
- NO `toHaveStyle` assertions.
- The `<em>`-tag accent checks fall under the same purge (assert text content instead).

**Architecture:** Five tasks with disjoint file sets, executed sequentially by subagents with two-stage review, on the existing `worktree-test-guideline-fixes` branch (per AGENTS.md: subagent work stays on its worktree branch, never directly on master).

**Standing rules:** No suppressions; conventional commits staging exact files; `npx tsc --noEmit` + `npm run lint` clean after every task; full `npm test` + `npm run test:e2e` at the end.

---

### Task R1: Server tests + test infra

**Files:** `src/test/helpers.ts`, `src/server/lib/trackerComputation.test.ts`, `vitest.config.ts`, `src/server/routers/sims.test.ts`, `src/server/routers/challengeRuns.test.ts`, `src/app/app/legacies/[slug]/lib/__tests__/derive.test.ts`, `.claude/rules/testing.md` (worktree copy)

- [ ] Add `getSkills(count: number)` helper (mirrors `getPersonalityTraits`: `db.skill.findMany({ take: count })`, throw `Need ${count} skills, found ${n}. Is the DB seeded?`). Replace the two inline `db.skill.findMany({ take: 2 })` + throw blocks in `trackerComputation.test.ts` (~lines 172–173, 191–192).
- [ ] Backfill the lost `resolveThresholds` null-path coverage as ONE integration test in `trackerComputation.test.ts`: create a THRESHOLD tracker whose `goalConfig` is malformed (`{ start: 1, step: 1, count: 0 }`), give the legacy sims that cross any would-be threshold, run `recomputeLegacyTrackers`, assert `progress.value === null` and `progress.completedAt === null` (observable outcome of the null path; storedValue null / never auto-completes).
- [ ] `vitest.config.ts`: add `clearMocks: true` to the `test` config. Run the FULL `npm test` suite afterwards — if any file breaks because it relied on cross-test mock call history, fix that file's own setup (per-test arrangement), never revert the config.
- [ ] Weak matchers: `sims.test.ts` ~206–207 `toBeDefined()` → `toEqual([])` (sim seeded without traits/skills); `challengeRuns.test.ts` ~91 `progress).toBeDefined()` → assert the concrete shape used nearby; `derive.test.ts` — for each `.toBeDefined()` that is the ONLY assertion on a `.find()` result, tighten to assert an actual derived value (those followed by stronger assertions stay).
- [ ] `.claude/rules/testing.md` (worktree copy): in the Vitest Config section, replace the `environmentMatchGlobs` claim with the truth: jsdom is selected per-file via the `// @vitest-environment jsdom` pragma (note merge caution: root copy diverged; keep this edit scoped to that one sentence).
- [ ] Validate (tsc, lint, targeted + full vitest run), commit.

### Task R2: Component tests — behavior fixes

**Files:** `src/app/app/legacies/[slug]/_components/__tests__/succession.test.tsx`, `src/app/app/legacies/[slug]/_components/succession/__tests__/name-heir-dialog.test.tsx`, `src/app/components/__tests__/pack-grid.test.tsx`, `src/app/components/__tests__/create-sim-modal.test.tsx`, `src/app/app/legacies/[slug]/_components/__tests__/section-nav.test.tsx`, `src/app/components/__tests__/trait-picker.test.tsx`, `src/app/auth/signin/__tests__/sign-in-form.test.tsx`, `src/components/family-tree/SimNode.test.tsx`

- [ ] `succession.test.tsx`: delete the `data-label`/`data-candidates` assertions (mock-child prop spying). Keep slot presence/absence tests. The mock child may keep only `data-testid` for presence checks.
- [ ] `name-heir-dialog.test.tsx`: ensure the user-visible counterpart exists — given a `candidates` list, opening the dialog shows exactly those sims as options (add if missing). The "only next-gen candidates" rule must be observable: if `Succession` computes candidates, test the rendered outcome through the REAL dialog (render `Succession` without mocking `NameHeirDialog` for one test: open dialog, assert only gen-2 sim appears as an option) — choose whichever is feasible after reading the components; the requirement is the filtering is proven via visible options, not props.
- [ ] `pack-grid.test.tsx`: kill the transient-window assertion. Make the `packs.getAll` MSW handler stateful (after the toggle handler fires, getAll returns City Living `isOwned: true`), assert the SETTLED `aria-pressed="true"`. Remove the transient-window comment.
- [ ] `create-sim-modal.test.tsx`: add per-test mock hygiene (`beforeEach` resetting the hoisted mocks) so `mockReturnValueOnce`/`mockResolvedValueOnce` queues can't leak across tests (global `clearMocks` clears calls, not Once-queues).
- [ ] `section-nav.test.tsx`: delete the `'disconnects the observer on unmount'` test (internal-collaborator assertion); remove `disconnectSpy` if orphaned.
- [ ] userEvent consistency: convert bare `userEvent.click/keyboard` to `const user = userEvent.setup()` + `user.click/keyboard` in: trait-picker, sign-in-form, SimNode, section-nav (and the files in this task generally).
- [ ] Validate, commit.

### Task R3: Component tests — style/structure assertion purge

**Files:** `src/app/app/legacies/[slug]/_components/chronicle-sections/chronicle-sections.tsx` + its test, `src/app/app/legacies/[slug]/_components/__tests__/hero.test.tsx`, `src/components/ui/empty-state/__tests__/empty-state.test.tsx`, `src/components/lineage-tree/crest-node.tsx` + `__tests__/crest-node.test.tsx`, `src/components/lineage-tree/lineage-tree.tsx` (only if needed for data-dimmed plumbing) + `__tests__/lineage-tree.test.tsx`, `__tests__/lineage-tree.a11y.test.tsx`, `src/components/ui/ghost-circle/__tests__/ghost-circle.test.tsx`

- [ ] `chronicle-sections.tsx`: add `data-testid="section-<id>"` to each of the four `<section>` elements (ids/data-section stay — they're the live anchor contract). Test: replace `document.getElementById(...)` with `screen.getByTestId('section-hero')` etc.; assert each still carries its `id` (`toHaveAttribute('id', 'hero')` — the anchor contract); treeSlot containment via `within(screen.getByTestId('section-hero')).getByRole('button', { name: /view family tree/i })`. Add `{ level: 2 }` to the section-heading assertions (pins the h2 outline the deleted e2e test used to cover).
- [ ] `hero.test.tsx` + `empty-state.test.tsx`: delete the `querySelector('em')` assertions; assert the full visible text instead (`toHaveTextContent('The Caliente Legacy')` / the empty-state headline). Negative cases stay text-based.
- [ ] `crest-node.test.tsx`: delete the `font-style="italic"` assertion; the monogram test keeps only the user-visible fact (`RC` renders for a portraitless sim — via getByText, not querySelectorAll('text')).
- [ ] `lineage-tree` dimming: in `crest-node.tsx` (or wherever `isDimmed` lands on the interactive element), add `data-dimmed` (empty-string when dimmed, absent otherwise) to the SAME element that has `role="button"`. Test: replace the `.closest('[data-tree-node]')` + `style.opacity` assertions with `expect(screen.getByRole('button', { name: /Dina Caliente/ })).toHaveAttribute('data-dimmed')` and the Reed counterpart `not.toHaveAttribute`. The opacity styling itself stays in the component — only the assertion changes.
- [ ] `lineage-tree.a11y.test.tsx`: drop the `container.querySelector('svg')` + raw `role` attribute check (the `getByRole('group', ...)` assertions already express it); replace `.toBeTruthy()` on query results with `toBeInTheDocument()` here and in `crest-node.test.tsx`.
- [ ] `ghost-circle.test.tsx`: delete the two `toHaveStyle` size tests (size is visual; per user override). The icon-wrapping test stays.
- [ ] Sweep check: `grep -rn "toHaveStyle\|font-style\|style.opacity\|getElementById\|querySelector('em')" src --include='*.test.*'` → only contrast.test.ts-adjacent matches allowed (and contrast.test.ts itself untouched).
- [ ] Validate, commit.

### Task R4: E2E round 2 + wizard component test

**Files:** `e2e/add-sims-to-legacy.spec.ts`, `e2e/legacy-wizard.spec.ts`, `e2e/sim-detail.spec.ts`, `e2e/auth.spec.ts`, `e2e/add-relationship-modal.spec.ts`, `e2e/packs.spec.ts`, NEW `e2e/helpers.ts`, `e2e/setup/auth.setup.ts`, NEW `src/app/app/legacies/new/__tests__/legacy-wizard.test.tsx`

- [ ] NEW `src/app/app/legacies/new/__tests__/legacy-wizard.test.tsx`: component test for the wizard (`src/app/app/legacies/new/legacy-wizard.tsx`) covering the validations being removed from e2e: (a) Continue with empty name → `'Legacy name is required'` visible, still step 1; (b) fill name → Continue → step 2 (Founder Sim); (c) Back → step 1 with the name value intact. Mock router/tRPC boundaries as the component requires (read it first); founder-field validation stays in sim-form.test.tsx (already covered — don't duplicate).
- [ ] `legacy-wizard.spec.ts`: strip the validation steps and back-preservation step from the founder journey (now component-covered); journey becomes the clean happy path. In the skip-founder journey, drop the empty-state-heading assertion (roster.test.tsx owns it) — keep URL + legacy-name-heading assertions.
- [ ] `add-sims-to-legacy.spec.ts`: collapse 3 tests → ONE journey `'user adds a sim to an existing legacy'` with test.step(): create legacy with founder → add a second sim via the Add sim flow → assert both sims in the roster. The founder-render and empty-state tests are deleted (covered by wizard journey + roster.test.tsx).
- [ ] `sim-detail.spec.ts`: complete the deceased step into a real milestone — confirm the death (pick/keep default cause, click Confirm), then in the reload step assert the persisted deceased state (read the component to learn what deceased looks like — death section/cause shown). The breadcrumb step STAYS (decided coverage for breadcrumb behavior; no separate component test).
- [ ] `auth.spec.ts`: drop the Send-magic-link/Google-button presence asserts (keep the email-input interaction itself) and the redundant `test.use({ storageState: ... })` (the chromium-unauthed project already has no storageState — verify, then remove).
- [ ] `add-relationship-modal.spec.ts`: drop the standalone `expect(dialog).toBeVisible()` after open; add a one-line comment at the waitForResponse noting batch `r.ok()` reflects HTTP status, and the reload-verify step is the true commit assertion.
- [ ] `packs.spec.ts`: remove the `getAttribute('aria-label')` + `label!.replace(...)` munging; capture the first unowned pack locator, click it, assert `aria-pressed` flips to `'true'` on that same locator (`toHaveAttribute('aria-pressed', 'true')`), scoped to the Expansion Packs section if needed for stability.
- [ ] NEW `e2e/helpers.ts`: extract the duplicated legacy-creation helpers (`createLegacyWithSim`, `createLegacyWithTwoSims`) used by sim-detail/add-relationship/add-sims specs; parameterize the legacy-name prefix. Update the three specs to import from it.
- [ ] `e2e/setup/auth.setup.ts`: move the credentials-POST console.log lines inside the failure branch (log only when `!hasSession`).
- [ ] Run `npm run test:e2e` (all green, repeat the changed specs once for stability); validate tsc/lint; commit.

### Task R5: Final validation

- [ ] `npx tsc --noEmit` && `npm run lint` clean.
- [ ] `npm test` — all passing.
- [ ] `npm run test:e2e` — all passing.
- [ ] Sweeps: no `toHaveStyle`/`font-style`/`style.opacity`/`getElementById` in any test except `contrast.test.ts`; no `") return$"` stealth skips; no `waitForTimeout`/`networkidle` in e2e/; no suppressions.
- [ ] Report verbatim outputs. No commit.
