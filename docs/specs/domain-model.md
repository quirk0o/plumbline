# SimTrack Domain Model

Research findings and domain concepts for the SimTrack application. Describes what exists in The Sims 4 and how the application models it — not how it is stored.

---

## Application Layer

Users own one or more **legacies**, each representing a distinct multi-generational Sims 4 playthrough. A legacy begins with a **founding Sim** — the single Sim who starts the dynasty — and continues across multiple generations of descendants, potentially spanning many households over time. A user also tracks which **DLC packs** they have installed; this determines which traits, aspirations, skills, and careers are available to them.

---

## Households and Sims

A **household** is the playable unit in The Sims 4 — a group of up to eight Sims sharing a residential lot. All households and Sims belong to a legacy.

Because a legacy spans generations, it naturally spans multiple households: the founding family may still be alive when their grandchildren have moved out and formed households of their own. A **Sim** may belong to one household at a time, but household membership and family relationships are independent — the legacy's family tree connects Sims across all households. Sims without a household (townies, deceased Sims kept for record) are still part of the legacy.

Every Sim has a **life stage**: Newborn, Infant, Toddler, Child, Teen, Young Adult, Adult, or Elder. Life stage is central to almost every other piece of a Sim's data — it gates which traits can be assigned, which aspirations can be pursued, and which skills can be developed.

Each Sim has a **gender** and **pronouns**.

A Sim can optionally be an **occult type** — Vampire, Spellcaster, Mermaid, Werewolf, Fairy, Alien, Ghost, PlantSim, or Servo — but only one at a time. Some occult types override the normal aging system (Vampires and Servos do not age past Young Adult). When a Sim dies, the manner of death is recorded, which in the game determines how their ghost behaves.

---

## Traits

**Traits** are a core part of a Sim's personality. The game organises them into several distinct pools:

**Infant and Toddler traits** are unique to those life stages — they are not carried forward when aging up. Infants have one trait slot; Toddlers have one slot, drawn from a different pool. These traits shape early childhood behaviour but are replaced when the Sim ages.

**Adult personality traits** are first assigned at the Child stage and accumulate through adulthood. Children get one slot, Teens get two, and Young Adults and older get three. These traits persist for the rest of the Sim's life. Some of them can only be assigned at certain life stages and not before. With the *Growing Together* expansion, additional traits can be unlocked through a Self-Discovery system, raising the maximum to six personality traits.

Adult traits are organised into four categories: Emotional, Hobby, Lifestyle, and Social. These categories are informational but do not affect slot counting.

**Bonus traits** are awarded once when a Sim first selects an aspiration — the bonus comes from the aspiration's category, not the aspiration itself, and is retained even if the Sim later changes aspirations.

**Reward traits** are earned through gameplay: purchased from the Satisfaction Points store, earned by completing aspirations or child challenges, or unlocked through the Parenthood system's character values.

**Death traits** exist but are not player-assigned. Death traits govern ghost behaviour. Hidden traits are applied by the game engine based on lineage, occult status, or other gameplay events.

### Trait Conflicts

The game enforces mutual exclusion between certain trait pairs. A Sim cannot hold both traits in a conflicting pair simultaneously. Known base game conflicts: Good ↔ Evil, Neat ↔ Slob, Active ↔ Lazy, Cheerful ↔ Gloomy, Cheerful ↔ Hot-Headed, Gloomy ↔ Hot-Headed, Loner ↔ Outgoing, Vegetarian ↔ Glutton.

---

## Aspirations

**Aspirations** are long-term goals consisting of four milestones. A Sim can work on multiple aspirations over their lifetime — progress is saved when switching — but only one is active at a time. Completing all four milestones awards a unique reward trait.

Aspirations are grouped into **categories** (Athletic, Creativity, Deviance, Family, Food, Fortune, Knowledge, Love, Nature, Popularity, and pack-specific categories). When a Sim selects their very first aspiration, they receive the bonus trait associated with its category.

**Child aspirations** are a special category available only to the Child life stage. They cannot be selected by Teens or older, and adult aspirations cannot be selected by Children. Completing a child aspiration awards a reward trait (e.g. Creatively Gifted, Mentally Gifted) that persists into adulthood.

**Teen aspirations** are a special category available only to the Teen life stage. They cannot be selected by Children and Young Adults or older. Completing a teen aspiration awards a reward trait that persists into adulthood.

---

## Skills

**Skills** are developed through gameplay and capped at a maximum level. Most skills cap at level 10; minor skills cap at 5.

Skills are divided by life stage. **Toddler skills** (Communication, Imagination, Movement, Potty, Thinking) are exclusive to Toddlers. **Child skills** (Creativity, Mental, Motor, Social) are exclusive to Children but have a meaningful relationship with adult skills — a Child who maxes the Creativity skill enters the Teen stage predisposed toward skills like Painting, Guitar, and Violin. This unlock chain reflects real game mechanics where child skill progress influences adult skill starting levels.

**Adult skills** are available from Teen onwards and persist through the rest of a Sim's life.

---

## Careers

A **career** is a Sim's employment track. Most careers have two branches that diverge at level 5 — the Sim chooses one branch and follows a separate progression path from there. Active careers (Doctor, Detective, Scientist, Actor) are played in real time and do not branch. Part-time jobs are available to Teens; standard careers require Young Adult or older.

A Sim holds at most one career at a time, at a specific level and branch.

A Sim could also be Unemployed or Self-Emplyed. When they are Self-Employed, the user can define a custom career name and track progress toward a self-defined goal, but there are no game mechanics associated with this status.

---

## Relationships

### Family Relationships

The Sims 4 family tree supports a rich set of relationship labels: direct lineage (Parent, Child, Grandparent, Grandchild, Great-Grandparent, Great-Grandchild), sibling variants (Sibling, Half-Sibling, Step-Sibling), stepfamily (Stepparent, Stepchild), adoptive family (Adoptive Parent, Adopted Child), collateral relatives (Aunt/Uncle, Niece/Nephew, Cousin), and in-laws (Parent-in-Law, Child-in-Law, Sibling-in-Law). Both biological and adoptive parents can appear simultaneously.

A 2024 update to the family tree system expanded support for in-law and step-relative labels and now explicitly prevents autonomous romantic interactions between direct ancestors/descendants and step-relatives.

**How the application models family relationships:** Only direct parent-child edges are stored in the database, with a type of Biological, Adoptive, or Step. All other labels — grandparent, sibling, in-law, cousin, aunt/uncle — are derived at the application layer by traversing these edges. This avoids the maintenance burden of cascading updates when the family tree changes.

### Social Relationships

Separately from family bonds, every pair of Sims has a social relationship tracking friendship and romance as independent numeric scores, as well as a categorical romantic status (None through to Married, Ex-Partner, or Widowed).

The base game supports monogamy — one Married status at a time. The Romantic Boundaries system added in *High School Years* lets Sims configure individual jealousy tolerances, enabling functional polyamory without constant conflict, but does not create multiple simultaneous legal spouses.
