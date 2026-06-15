---
name: romantic-status-qa
description: QA findings for end/reopen relationship feature (feat/romantic-status-model) tested 2026-06-09
metadata:
  type: project
---

End/Reopen relationship feature QA — 2026-06-09

**Key findings:**

1. CRITICAL (now fixed): `updateSocialRelationship` and `addSocialRelationship` used `z.date()` in the Zod schema, but tRPC `httpBatchLink` has no transformer — Dates arrive as ISO strings over the wire, causing 400 Bad Request on every Divorce/End click. Fixed in commit `088e859` with `z.coerce.date()`. Dev server may be stale on startup; always restart after schema changes.

2. The fix is verified working. Divorce, End relationship, and Reopen all work correctly (200 OK) when the dev server has the latest code loaded.

3. Silent error on mutation failure: when the API returns 400, no user-visible error/toast is shown. The optimistic update rolls back silently. No `onError` feedback shown.

4. Partner card links use `display: contents` — keyboard tabbing skips them; only mouse click navigates to partner's page. Tab order goes directly to combobox buttons.

5. Combobox component drops `aria-label` prop when a value is selected (line 139 of combobox.tsx): `aria-label={selectedLabel ? undefined : ariaLabel}`. This means "Romantic status with Bruno" is lost once a status is selected — screen reader sees "Married, button" with no partner context.

6. `Divorce Bruno` aria-label is inconsistent with `End relationship with Clara` / `Reopen relationship with Bruno` — missing "relationship" and "with" preposition. Minor but inconsistent.

7. Widowed state correctly hides the end control (no Divorce/End button). Combobox stays visible per intentional design comment in code.

8. Relationship list reorders on reload (active bonds first, then ended bonds). This appears intentional.

9. Contrast all passes: badges ~5.5:1 on parchment, buttons ~7.3:1. Dark mode: buttons ~6.3:1, badges ~6.3:1.

**Why:** This is the first QA of the romantic-status-model feature branch. The tRPC date serialization was a pre-existing known issue (comment in the code) that was fixed just before QA. The silent error and a11y issues remain.

**How to apply:** When testing mutation-heavy features with Date fields, always check that `z.coerce.date()` is used server-side (not `z.date()`). Always check for user-visible error feedback on mutation failures.
