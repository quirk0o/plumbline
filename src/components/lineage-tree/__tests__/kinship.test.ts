import { describe, it, expect } from 'vitest'
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
