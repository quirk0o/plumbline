# Memory Index

- [Legacy Chronicle QA — known issues](project_legacy_chronicle_qa.md) — XYFlow tree: Fit button broken (zoom never changes), aria-roledescription violation, inspector focus not returned on close
- [Sim detail page visual QA](project_sim_detail_page.md) — findings from 2026-05-15 review: portrait ring, name gap, chip casing, pip shape, dark mode card issue
- [Households QA — 2026-06-05](project_households_qa.md) — founding dialog is right panel not centered modal; avatar text missing space; compact card focus ring; behavior tests passed
- [Repartner tree QA — 2026-06-07](project_repartner_tree_qa.md) — descent-line fix verified: two lines from individual parents when re-partnered; combobox listRef HMR crash found (unrelated)
- [Lineage layout d3-dag QA — 2026-06-08](project_lineage_layout_qa.md) — hanging unions/co-parents pass; diamond rule passes; Fit button still broken (100% not viewport-fit); Gen I clipped by toolbar; focus-return bug persists; application role missing aria-label
- [Lineage-relationships QA — 2026-06-08](project_lineage_relationships_qa.md) — All 7 checks PASS after fresh server start; cross-gen bond layout constraint documented; pre-existing a11y issues unchanged
- [Romantic status end/reopen QA — 2026-06-09](project_romantic_status_qa.md) — Divorce/End/Reopen work after z.coerce.date fix; silent error on failure; partner links not keyboard-reachable; Combobox drops aria-label when value selected
- [Kinship labels QA — 2026-06-10](project_kinship_labels_qa.md) — Feature works in Atlas + mini tree; bug: Elias→Alma label differs (HALF-BROTHER in Atlas, GRANDFATHER in mini tree) due to graph-subset difference
- [Editable sim generation QA — 2026-06-10](project_editable_sim_generation_qa.md) — Core feature works; combobox search label empty; editable chip drops "Generation" label when value set
- [Cross-gen co-parent junction QA — 2026-06-13](project_cross_gen_coparent_qa.md) — fix VERIFIED: Sam(Gen II)+Eva(Gen IV) route to single diamond; no line through Leo(Gen III); bond rectangle grazes Leo/Eva edges (non-critical)
