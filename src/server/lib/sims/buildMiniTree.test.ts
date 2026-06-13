import { describe, it, expect } from 'vitest'
import { Gender, LifeStage, RomanticStatus } from '@prisma/client'
import { assembleMiniTree, type FocusedSim } from './buildMiniTree'

function simStub(id: string) {
  return {
    id,
    firstName: id,
    lastName: 'Test',
    imageUrl: null,
    generationNumber: 1,
    lifeStage: LifeStage.YOUNG_ADULT,
    isHeir: false,
    gender: Gender.FEMALE,
    causeOfDeath: null,
  }
}

function rel(simAId: string, simBId: string) {
  return { simAId, simBId, romanticStatus: RomanticStatus.MARRIED, endedAt: null }
}

describe('assembleMiniTree', () => {
  it('normalizes partner edges to sorted id order and dedupes the two relationship sides', () => {
    const focused: FocusedSim = {
      ...simStub('b'),
      legacy: { slug: 'test-legacy' },
      childOf: [],
      parentsOf: [],
      socialRelationshipsA: [rel('b', 'a')],
      socialRelationshipsB: [rel('b', 'a')],
    }
    const graph = assembleMiniTree(focused)
    expect(graph.partnerEdges).toEqual([
      { simAId: 'a', simBId: 'b', romanticStatus: RomanticStatus.MARRIED, endedAt: null },
    ])
  })

  it('dedupes a shared grandparent reached through both parents and keeps hrefs on the focused legacy', () => {
    const grandparent = { ...simStub('gp') }
    const parentOf = (parentId: string) => ({
      parentId,
      parent: {
        ...simStub(parentId),
        childOf: [{ parentId: 'gp', parent: grandparent }],
        socialRelationshipsA: [],
        socialRelationshipsB: [],
      },
    })
    const focused: FocusedSim = {
      ...simStub('child'),
      legacy: { slug: 'test-legacy' },
      childOf: [parentOf('p1'), parentOf('p2')],
      parentsOf: [],
      socialRelationshipsA: [],
      socialRelationshipsB: [],
    }
    const graph = assembleMiniTree(focused)
    expect([...graph.simMap.keys()].sort()).toEqual(['child', 'gp', 'p1', 'p2'])
    expect(graph.familyEdges).toContainEqual({ parentId: 'gp', childId: 'p1' })
    expect(graph.familyEdges).toContainEqual({ parentId: 'gp', childId: 'p2' })
    expect(graph.simMap.get('gp')?.href).toBe('/app/legacies/test-legacy/sims/gp')
  })

  it('adds children from parentsOf with an edge from the focused sim', () => {
    const focused: FocusedSim = {
      ...simStub('parent'),
      legacy: { slug: 'test-legacy' },
      childOf: [],
      parentsOf: [{ childId: 'kid', child: simStub('kid') }],
      socialRelationshipsA: [],
      socialRelationshipsB: [],
    }
    const graph = assembleMiniTree(focused)
    expect([...graph.simMap.keys()].sort()).toEqual(['kid', 'parent'])
    expect(graph.familyEdges).toEqual([{ parentId: 'parent', childId: 'kid' }])
    expect(graph.simMap.get('kid')?.href).toBe('/app/legacies/test-legacy/sims/kid')
  })
})
