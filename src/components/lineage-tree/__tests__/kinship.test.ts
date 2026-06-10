import { describe, it, expect } from 'vitest'
import type { RomanticStatus } from '@prisma/client'
import { computeKinshipLabels, type KinshipSim } from '../kinship'
import type { LineageFamilyEdge, LineagePartnerEdge } from '../layout-shared'

// Genealogy (M=male, F=female):
//   gen1: GF(m) — GM(f)            [F's paternal grandparents]
//   gen2: DAD(m) — MUM(f)          DAD is child of GF+GM; UNCLE(m) is DAD's brother
//   gen3: F(f, focus) — SIB(m, F's full brother, child of DAD+MUM)
//         COUSIN(f) is UNCLE's child
//   gen4: KID(f) is F's child
const sims: KinshipSim[] = [
  { id: 'GF', gender: 'MALE', isDeceased: false },
  { id: 'GM', gender: 'FEMALE', isDeceased: false },
  { id: 'DAD', gender: 'MALE', isDeceased: false },
  { id: 'MUM', gender: 'FEMALE', isDeceased: false },
  { id: 'UNCLE', gender: 'MALE', isDeceased: false },
  { id: 'F', gender: 'FEMALE', isDeceased: false },
  { id: 'SIB', gender: 'MALE', isDeceased: false },
  { id: 'COUSIN', gender: 'FEMALE', isDeceased: false },
  { id: 'KID', gender: 'FEMALE', isDeceased: false },
]
const familyEdges: LineageFamilyEdge[] = [
  { parentId: 'GF', childId: 'DAD' }, { parentId: 'GM', childId: 'DAD' },
  { parentId: 'GF', childId: 'UNCLE' }, { parentId: 'GM', childId: 'UNCLE' },
  { parentId: 'DAD', childId: 'F' }, { parentId: 'MUM', childId: 'F' },
  { parentId: 'DAD', childId: 'SIB' }, { parentId: 'MUM', childId: 'SIB' },
  { parentId: 'UNCLE', childId: 'COUSIN' },
  { parentId: 'F', childId: 'KID' },
]
const noPartners: LineagePartnerEdge[] = []

describe('computeKinshipLabels — blood relations (focus F)', () => {
  const labels = computeKinshipLabels('F', sims, familyEdges, noPartners)

  it('labels direct ancestors with gender', () => {
    expect(labels.get('DAD')).toBe('Father')
    expect(labels.get('MUM')).toBe('Mother')
    expect(labels.get('GF')).toBe('Grandfather')
    expect(labels.get('GM')).toBe('Grandmother')
  })
  it('labels descendants', () => {
    expect(labels.get('KID')).toBe('Daughter')
  })
  it('labels a full sibling, aunt/uncle, and first cousin', () => {
    expect(labels.get('SIB')).toBe('Brother')
    expect(labels.get('UNCLE')).toBe('Uncle')
    expect(labels.get('COUSIN')).toBe('First cousin')
  })
  it('omits the focus sim itself', () => {
    expect(labels.has('F')).toBe(false)
  })
})

describe('half-sibling detection', () => {
  it('labels a half-sibling when only one parent is shared', () => {
    const half: KinshipSim[] = [
      { id: 'DAD', gender: 'MALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'STEPMUM', gender: 'FEMALE', isDeceased: false },
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'HALF', gender: 'MALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [
      { parentId: 'DAD', childId: 'F' }, { parentId: 'MUM', childId: 'F' },
      { parentId: 'DAD', childId: 'HALF' }, { parentId: 'STEPMUM', childId: 'HALF' },
    ]
    expect(computeKinshipLabels('F', half, edges, []).get('HALF')).toBe('Half-brother')
  })
})

describe('non-binary and distant forms', () => {
  it('uses neutral terms for NON_BINARY sims', () => {
    const s: KinshipSim[] = [
      { id: 'P', gender: 'NON_BINARY', isDeceased: false },
      { id: 'F', gender: 'FEMALE', isDeceased: false },
    ]
    expect(computeKinshipLabels('F', s, [{ parentId: 'P', childId: 'F' }], []).get('P')).toBe('Parent')
  })
  it('compacts deep ancestors and second cousins', () => {
    expect(greatChain(6)).toBe('4× great-grandmother') // up = 6
  })
})

describe('cousin degrees and removal', () => {
  // Two gen-1 siblings (A1, A2) share parents GA+GB. Each has a child in gen-2
  // (B1 from A1, B2 from A2), and each of those has a child in gen-3 (F from B1,
  // C3 from B2). The lowest common ancestors are GA/GB, three generations up
  // from each of F and C3, so F (focus) ↔ C3 is (3,3) → second cousins.
  it('labels a second cousin (3,3)', () => {
    const sims: KinshipSim[] = [
      { id: 'GA', gender: 'MALE', isDeceased: false },
      { id: 'GB', gender: 'FEMALE', isDeceased: false },
      { id: 'A1', gender: 'MALE', isDeceased: false },
      { id: 'A2', gender: 'FEMALE', isDeceased: false },
      { id: 'B1', gender: 'MALE', isDeceased: false },
      { id: 'B2', gender: 'FEMALE', isDeceased: false },
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'C3', gender: 'MALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [
      { parentId: 'GA', childId: 'A1' }, { parentId: 'GB', childId: 'A1' },
      { parentId: 'GA', childId: 'A2' }, { parentId: 'GB', childId: 'A2' },
      { parentId: 'A1', childId: 'B1' },
      { parentId: 'A2', childId: 'B2' },
      { parentId: 'B1', childId: 'F' },
      { parentId: 'B2', childId: 'C3' },
    ]
    expect(computeKinshipLabels('F', sims, edges, []).get('C3')).toBe('Second cousin')
  })

  it('labels a first cousin once removed (2,3): the focus first cousin\'s child', () => {
    // GA+GB are grandparents. DAD and UNCLE are their children (gen-2).
    // F is DAD's child; COUSIN is UNCLE's child (F's first cousin).
    // COUSIN_KID is COUSIN's child. F ↔ COUSIN_KID is up=2 (to GA/GB),
    // down=3 (GA→UNCLE→COUSIN→COUSIN_KID) → first cousin once removed.
    const sims: KinshipSim[] = [
      { id: 'GA', gender: 'MALE', isDeceased: false },
      { id: 'GB', gender: 'FEMALE', isDeceased: false },
      { id: 'DAD', gender: 'MALE', isDeceased: false },
      { id: 'UNCLE', gender: 'MALE', isDeceased: false },
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'COUSIN', gender: 'FEMALE', isDeceased: false },
      { id: 'COUSIN_KID', gender: 'MALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [
      { parentId: 'GA', childId: 'DAD' }, { parentId: 'GB', childId: 'DAD' },
      { parentId: 'GA', childId: 'UNCLE' }, { parentId: 'GB', childId: 'UNCLE' },
      { parentId: 'DAD', childId: 'F' },
      { parentId: 'UNCLE', childId: 'COUSIN' },
      { parentId: 'COUSIN', childId: 'COUSIN_KID' },
    ]
    expect(computeKinshipLabels('F', sims, edges, []).get('COUSIN_KID')).toBe('First cousin once removed')
  })
})

describe('intermarriage — closest relationship wins', () => {
  // F and X are related by two distinct blood paths:
  //
  // PATERNAL (first cousins, total 4):
  //   PG1+PG2 → FD (F's father) and XD (X's father) are siblings.
  //   F→FD→PG1/PG2←XD←X  ⇒  up=2, down=2  (total 4)
  //
  // MATERNAL (second cousins, total 6):
  //   MG1+MG2 → MFP (FM's parent) and XFP (XM's parent) are siblings.
  //   FM is MFP's child; XM is XFP's child.
  //   F→FM→MFP→MG1/MG2←XFP←XM←X  ⇒  up=3, down=3  (total 6)
  //
  // The (2,2) path has total 4 < 6, so X should be labelled "First cousin".
  const sims: KinshipSim[] = [
    // Paternal grandparents
    { id: 'PG1', gender: 'MALE',   isDeceased: false },
    { id: 'PG2', gender: 'FEMALE', isDeceased: false },
    // F's father and X's father (paternal-side brothers)
    { id: 'FD',  gender: 'MALE',   isDeceased: false },
    { id: 'XD',  gender: 'MALE',   isDeceased: false },
    // Maternal great-grandparents
    { id: 'MG1', gender: 'MALE',   isDeceased: false },
    { id: 'MG2', gender: 'FEMALE', isDeceased: false },
    // FM's parent and XM's parent (maternal-side siblings)
    { id: 'MFP', gender: 'FEMALE', isDeceased: false },
    { id: 'XFP', gender: 'FEMALE', isDeceased: false },
    // F's mother and X's mother (first cousins to each other)
    { id: 'FM',  gender: 'FEMALE', isDeceased: false },
    { id: 'XM',  gender: 'FEMALE', isDeceased: false },
    // Focus sim and target
    { id: 'F',   gender: 'FEMALE', isDeceased: false },
    { id: 'X',   gender: 'FEMALE', isDeceased: false },
  ]
  const edges: LineageFamilyEdge[] = [
    // Paternal grandparents → FD and XD
    { parentId: 'PG1', childId: 'FD' }, { parentId: 'PG2', childId: 'FD' },
    { parentId: 'PG1', childId: 'XD' }, { parentId: 'PG2', childId: 'XD' },
    // Maternal great-grandparents → MFP and XFP
    { parentId: 'MG1', childId: 'MFP' }, { parentId: 'MG2', childId: 'MFP' },
    { parentId: 'MG1', childId: 'XFP' }, { parentId: 'MG2', childId: 'XFP' },
    // MFP → FM; XFP → XM
    { parentId: 'MFP', childId: 'FM' },
    { parentId: 'XFP', childId: 'XM' },
    // FD+FM → F; XD+XM → X
    { parentId: 'FD', childId: 'F' }, { parentId: 'FM', childId: 'F' },
    { parentId: 'XD', childId: 'X' }, { parentId: 'XM', childId: 'X' },
  ]

  it('picks the closer (first-cousin) path over the farther (second-cousin) path', () => {
    expect(computeKinshipLabels('F', sims, edges, []).get('X')).toBe('First cousin')
  })
})

// Helper: a straight maternal line F ← m1 ← m2 ← ... of length `up`, all female.
function greatChain(up: number): string | undefined {
  const sims: KinshipSim[] = [{ id: 'F', gender: 'FEMALE', isDeceased: false }]
  const edges: LineageFamilyEdge[] = []
  let child = 'F'
  for (let i = 1; i <= up; i++) {
    const id = `a${i}`
    sims.push({ id, gender: 'FEMALE', isDeceased: false })
    edges.push({ parentId: id, childId: child })
    child = id
  }
  return computeKinshipLabels('F', sims, edges, []).get(`a${up}`)
}

function partner(a: string, b: string, status: RomanticStatus, endedAt: Date | null = null): LineagePartnerEdge {
  const [simAId, simBId] = [a, b].sort()
  return { simAId, simBId, romanticStatus: status, endedAt }
}

describe('partner layer (focus F, female)', () => {
  const base: KinshipSim[] = [
    { id: 'F', gender: 'FEMALE', isDeceased: false },
    { id: 'HUS', gender: 'MALE', isDeceased: false },
    { id: 'GF2', gender: 'FEMALE', isDeceased: false }, // girlfriend (other relationship)
    { id: 'EX', gender: 'MALE', isDeceased: false },
    { id: 'DEAD', gender: 'MALE', isDeceased: true },
  ]

  it('labels the focus current spouse by bond and gender', () => {
    const l = computeKinshipLabels('F', base, [], [partner('F', 'HUS', 'MARRIED')])
    expect(l.get('HUS')).toBe('Husband')
  })
  it('labels a deceased spouse as the late partner', () => {
    const l = computeKinshipLabels('F', base, [], [partner('F', 'DEAD', 'MARRIED')])
    expect(l.get('DEAD')).toBe('Late husband')
  })
  it('distinguishes an ex-spouse (divorce) from a girlfriend break-up', () => {
    const l = computeKinshipLabels('F', base, [], [
      partner('F', 'EX', 'MARRIED', new Date('2026-01-01')),
      partner('F', 'GF2', 'DATING'),
    ])
    expect(l.get('EX')).toBe('Ex-husband')
    expect(l.get('GF2')).toBe('Girlfriend')
  })
})

describe('in-laws (marriage only, one hop)', () => {
  const sims: KinshipSim[] = [
    { id: 'F', gender: 'FEMALE', isDeceased: false },
    { id: 'HUS', gender: 'MALE', isDeceased: false },
    { id: 'HMUM', gender: 'FEMALE', isDeceased: false }, // husband's mother
    { id: 'HSIS', gender: 'FEMALE', isDeceased: false }, // husband's sister
    { id: 'SON', gender: 'MALE', isDeceased: false },     // F's son
    { id: 'SONWIFE', gender: 'FEMALE', isDeceased: false },
    { id: 'BF', gender: 'MALE', isDeceased: false },      // F's fiancé (not a marriage)
    { id: 'BFMUM', gender: 'FEMALE', isDeceased: false },
  ]
  const edges: LineageFamilyEdge[] = [
    { parentId: 'HMUM', childId: 'HUS' },
    { parentId: 'HMUM', childId: 'HSIS' },
    { parentId: 'F', childId: 'SON' },
    { parentId: 'BFMUM', childId: 'BF' },
  ]
  const partners: LineagePartnerEdge[] = [
    partner('F', 'HUS', 'MARRIED'),
    partner('SON', 'SONWIFE', 'MARRIED'),
    partner('F', 'BF', 'ENGAGED'),
  ]
  const l = computeKinshipLabels('F', sims, edges, partners)

  it('derives mother- and sister-in-law through a marriage', () => {
    expect(l.get('HMUM')).toBe('Mother-in-law')
    expect(l.get('HSIS')).toBe('Sister-in-law')
  })
  it('derives a daughter-in-law (child\'s spouse)', () => {
    expect(l.get('SONWIFE')).toBe('Daughter-in-law')
  })
  it('does NOT derive in-laws through a non-marriage bond', () => {
    expect(l.get('BF')).toBe('Fiancé')      // direct partner labelled…
    expect(l.has('BFMUM')).toBe(false)       // …but the fiancé's mother is not
  })
  it('blood relations win over in-law derivation', () => {
    expect(l.get('SON')).toBe('Son')         // not relabelled by SONWIFE's marriage
  })
})

describe('partner layer — edge cases', () => {
  it('labels a non-binary spouse with the neutral term', () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'NB', gender: 'NON_BINARY', isDeceased: false },
    ]
    const l = computeKinshipLabels('F', sims, [], [partner('F', 'NB', 'MARRIED')])
    expect(l.get('NB')).toBe('Spouse')
  })

  it('keeps in-laws through a widowed marriage (death does not sever them)', () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'HUS', gender: 'MALE', isDeceased: true }, // deceased spouse, no endedAt → widowed
      { id: 'HMUM', gender: 'FEMALE', isDeceased: false }, // husband's mother
    ]
    const edges: LineageFamilyEdge[] = [{ parentId: 'HMUM', childId: 'HUS' }]
    const l = computeKinshipLabels('F', sims, edges, [partner('F', 'HUS', 'MARRIED')])
    expect(l.get('HUS')).toBe('Late husband')
    expect(l.get('HMUM')).toBe('Mother-in-law')
  })
})

describe('step relations (marriage-derived, focus F female)', () => {
  it("labels a stepfather (mother's husband, not a bio parent) and a stepmother", () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'DAD', gender: 'MALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'STEPDAD', gender: 'MALE', isDeceased: false },
      { id: 'STEPMUM', gender: 'FEMALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [
      { parentId: 'DAD', childId: 'F' }, { parentId: 'MUM', childId: 'F' },
    ]
    const l = computeKinshipLabels('F', sims, edges, [
      partner('MUM', 'STEPDAD', 'MARRIED'),
      partner('DAD', 'STEPMUM', 'MARRIED'),
    ])
    expect(l.get('STEPDAD')).toBe('Stepfather')
    expect(l.get('STEPMUM')).toBe('Stepmother')
  })

  it("labels a stepchild (spouse's child that is not F's child)", () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'HUS', gender: 'MALE', isDeceased: false },
      { id: 'SCHILD', gender: 'FEMALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [{ parentId: 'HUS', childId: 'SCHILD' }]
    const l = computeKinshipLabels('F', sims, edges, [partner('F', 'HUS', 'MARRIED')])
    expect(l.get('SCHILD')).toBe('Stepdaughter')
  })

  it("labels a step-sibling (stepparent's child by another, sharing no parent with F)", () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'STEPDAD', gender: 'MALE', isDeceased: false },
      { id: 'OTHERWOMAN', gender: 'FEMALE', isDeceased: false },
      { id: 'STEPBRO', gender: 'MALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [
      { parentId: 'MUM', childId: 'F' },
      { parentId: 'STEPDAD', childId: 'STEPBRO' },
      { parentId: 'OTHERWOMAN', childId: 'STEPBRO' },
    ]
    const l = computeKinshipLabels('F', sims, edges, [partner('MUM', 'STEPDAD', 'MARRIED')])
    expect(l.get('STEPBRO')).toBe('Step-brother')
  })

  it('drops the step label once the connecting marriage is divorced (endedAt set)', () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'EXSTEP', gender: 'MALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [{ parentId: 'MUM', childId: 'F' }]
    const l = computeKinshipLabels('F', sims, edges, [
      partner('MUM', 'EXSTEP', 'MARRIED', new Date('2026-01-01')),
    ])
    expect(l.has('EXSTEP')).toBe(false)
  })

  it('keeps the step label through widowhood (deceased stepparent, no divorce)', () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'STEPDAD', gender: 'MALE', isDeceased: true }, // widowed marriage, no endedAt
    ]
    const edges: LineageFamilyEdge[] = [{ parentId: 'MUM', childId: 'F' }]
    const l = computeKinshipLabels('F', sims, edges, [partner('MUM', 'STEPDAD', 'MARRIED')])
    expect(l.get('STEPDAD')).toBe('Stepfather')
  })

  it('does NOT derive a step relation through a non-marriage bond (DATING)', () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'BOYF', gender: 'MALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [{ parentId: 'MUM', childId: 'F' }]
    const l = computeKinshipLabels('F', sims, edges, [partner('MUM', 'BOYF', 'DATING')])
    expect(l.has('BOYF')).toBe(false)
  })

  it("lets a blood relation win over a step relation (mother's husband who is also F's uncle)", () => {
    // UNCLE is DAD's brother (F's blood uncle) AND married to MUM (F's mother).
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'DAD', gender: 'MALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'GF', gender: 'MALE', isDeceased: false },
      { id: 'GM', gender: 'FEMALE', isDeceased: false },
      { id: 'UNCLE', gender: 'MALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [
      { parentId: 'GF', childId: 'DAD' }, { parentId: 'GM', childId: 'DAD' },
      { parentId: 'GF', childId: 'UNCLE' }, { parentId: 'GM', childId: 'UNCLE' },
      { parentId: 'DAD', childId: 'F' }, { parentId: 'MUM', childId: 'F' },
    ]
    const l = computeKinshipLabels('F', sims, edges, [partner('MUM', 'UNCLE', 'MARRIED')])
    expect(l.get('UNCLE')).toBe('Uncle')
  })

  it('uses neutral terms for a NON_BINARY stepparent', () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'NBSTEP', gender: 'NON_BINARY', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [{ parentId: 'MUM', childId: 'F' }]
    const l = computeKinshipLabels('F', sims, edges, [partner('MUM', 'NBSTEP', 'MARRIED')])
    expect(l.get('NBSTEP')).toBe('Stepparent')
  })
})
