# Unified Relationships Editor — Design Spec

**Date:** 2026-05-18
**Status:** Approved

---

## Context

The sim detail page currently renders two separate relationship editors — `FamilyEditor` and `SocialEditor` — each with its own add-card trigger. This creates two visual rows in the Relationships section and two separate "Add" buttons. The goal is a single flat grid with one unified add trigger, partners displayed first, and a single tabbed modal for choosing the relationship type.

---

## Layout Change

Replace the two separate `<FamilyEditor>` and `<SocialEditor>` components in `sim-detail-client.tsx` with a single `<RelationshipsEditor>` component.

The single `.simCards` grid renders cards in this order:
1. **Add card** (always first, dashed circle, existing `.addCard` style)
2. **Partners** (social relationships with romanticStatus ≠ NONE)
3. **Family members** (parents and children)

The add-card is always visible (no `available.length > 0` guard needed — the modal itself will handle the empty-list case).

---

## New Components

### `relationships-editor.tsx`

Merges state and display logic from both editors into one component.

**Props:** same combined shape that `sim-detail-client.tsx` already passes to both editors:
```ts
{
  sim: SimProp  // includes parentsOf, childOf, socialRelationshipsA, socialRelationshipsB
  slug: string
  legacySims: SimMini[]
}
```

**State:**
- `partners: SocialRel[]` — initialised from `socialRelationshipsA` + `socialRelationshipsB`, filtered to exclude `NONE`
- `members: FamilyMember[]` — initialised from `parentsOf` + `childOf`
- `adding: boolean` — controls the add modal

**Available sets** (computed per tab inside the modal):
- Partner tab: exclude sims already in `partners` + `sim.id`
- Family tab: exclude sims already in `members` + `sim.id`

**Mutations:** holds all five mutations from the two current editors (`addSocialRelationship`, `updateSocialRelationship`, `removeSocialRelationship`, `addFamilyRelationship`, `removeFamilyRelationship`).

**Render order:** add-card → partners map → members map. All in one `.simCards` div.

Partner cards keep the existing `simPortraitPartner` border and `partnerBadge` treatment from `social-editor.tsx`. Family cards keep the existing label format (`Parent · Biological` etc.) from `family-editor.tsx`.

### `add-relationship-modal.tsx`

Replaces both per-editor `<SimPickerModal>` usages with a single modal that has a tab toggle at the top.

**Props:**
```ts
{
  familyAvailable: SimMini[]
  partnerAvailable: SimMini[]
  onAddFamily: (pickedId: string, role: 'parent' | 'child', relType: FamilyRelationshipType) => void
  onAddPartner: (pickedId: string, status: RomanticStatus) => void
  onClose: () => void
}
```

**Internal state:**
- `tab: 'partner' | 'family'` — defaults to `'partner'`
- `pickedId: string | null`
- `role: 'parent' | 'child'` — defaults to `'child'`
- `relType: FamilyRelationshipType` — defaults to `BIOLOGICAL`
- `romanticStatus: RomanticStatus` — defaults to `DATING`

Reset `pickedId` when `tab` changes.

**Structure:**
```
[modal overlay]
  [modal panel]
    [tab row]  Partner | Family          ← two pill/tab buttons
    [sim picker grid]                    ← shows familyAvailable or partnerAvailable per tab
    [fields row]
      Partner tab: romantic status <select>
      Family tab:  role <select> + relationship type <select>
    [actions row]  Cancel | Add
```

Reuse `.simCards`, `.simPortraitWrap`, `.editableChip`, `.modalOverlay`, `.modal`, `.modalTitle`, `.modalActions`, `.modalCancelBtn` from `page.module.css`. Add minimal new styles for the tab row only (two adjacent pill buttons, active tab gets green background).

**Confirm disabled** when `pickedId` is null.

---

## Files Changed

| File | Action |
|---|---|
| `src/app/app/legacies/[slug]/sims/[id]/relationships-editor.tsx` | **Create** |
| `src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx` | **Create** |
| `src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx` | **Edit** — swap `FamilyEditor` + `SocialEditor` for `RelationshipsEditor` |
| `src/app/app/legacies/[slug]/sims/[id]/family-editor.tsx` | **Delete** |
| `src/app/app/legacies/[slug]/sims/[id]/social-editor.tsx` | **Delete** |
| `src/app/app/legacies/[slug]/sims/[id]/page.module.css` | **Edit** — add tab row styles |

`SimPickerModal` and `sim-picker-modal.tsx` are **not changed** — the new modal does not use `SimPickerModal` (it inlines the picker grid directly, giving it full control over layout).

---

## Verification

1. Open a sim detail page that has at least one partner and one family member — confirm they appear in a single grid, partner(s) first.
2. Click the add-card — confirm a single modal opens with Partner tab active by default.
3. Toggle to Family tab — confirm the sim list refreshes and the family fields (role + relationship type) appear.
4. Add a partner — confirm it appears immediately in the grid, before family members.
5. Add a family member — confirm it appears after partners.
6. Remove a partner and a family member — confirm the optimistic remove + rollback on error still works.
7. Check a sim with no existing relationships — add-card still shows; modal opens correctly with no pre-selected sim.
8. Run `npx tsc --noEmit` and `npm run lint` — no errors.
