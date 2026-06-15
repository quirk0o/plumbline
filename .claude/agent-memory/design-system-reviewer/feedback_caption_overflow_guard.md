---
name: caption-overflow-guard
description: Absolutely-positioned caption spans in crest nodes need overflow guards — a recurring risk when label vocabulary expands
metadata:
  type: feedback
---

Absolutely-positioned text spans (like `.stage` in `crest-flow-node.module.css`) that sit inside fixed-size node bounding boxes need `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` even when current label vocabulary is short. Without these, expanding label sets (e.g. life-stage → kinship labels) cause multi-line wrap that bleeds outside the node bbox and collides with adjacent nodes and edges.

**Why:** The `.stage` caption was introduced with life-stage labels ("Young Adult", "Elder") that never exceeded 140 px at 8.5 px + 0.22 em letter-spacing. When kinship labels ("FIRST COUSIN ONCE REMOVED", "GREAT-GRANDDAUGHTER") were introduced the missing guard became a visible layout bug.

**How to apply:** When reviewing any absolutely-positioned text span with a fixed width, verify it has overflow containment. Also check that `text-align` is explicit — absolutely-positioned elements do not inherit `text-align` from ancestors. For clipped text, recommend a `title` attribute so the full string is discoverable on hover (the `aria-label` on the parent interactive element already carries the full value for screen readers, so `title` serves sighted users only).

See also: [[lineage-tree-token-patterns]]
