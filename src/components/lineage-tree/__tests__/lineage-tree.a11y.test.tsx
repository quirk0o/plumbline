// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LineageTree, type LineageTreeSim } from '../lineage-tree'

const makeSim = (
  overrides: Partial<LineageTreeSim> & { id: string },
): LineageTreeSim => ({
  firstName: 'First',
  lastName: 'Last',
  imageUrl: null,
  generationNumber: 1,
  lifeStage: 'ADULT',
  isHeir: false,
  href: `/app/legacies/goth/sims/${overrides.id}`,
  ...overrides,
})

const sims: LineageTreeSim[] = [
  makeSim({ id: 'a', firstName: 'Dina', lastName: 'Caliente', generationNumber: 1 }),
  makeSim({
    id: 'b',
    firstName: 'Reed',
    lastName: 'Caliente',
    generationNumber: 2,
    isHeir: true,
  }),
]
const familyEdges = [{ parentId: 'a', childId: 'b' }]
const partnerEdges: { simAId: string; simBId: string }[] = []

describe('LineageTree accessibility', () => {
  it('is not exposed as a single opaque image', () => {
    const { container } = render(
      <LineageTree sims={sims} familyEdges={familyEdges} partnerEdges={partnerEdges} />,
    )
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('role')).not.toBe('img')
  })

  it('labels the tree as a group', () => {
    render(
      <LineageTree sims={sims} familyEdges={familyEdges} partnerEdges={partnerEdges} />,
    )
    const group = screen.getByRole('group', { name: /family tree|tree —/i })
    expect(group).toBeTruthy()
  })

  it('uses the legacy name in the group label when provided', () => {
    render(
      <LineageTree
        sims={sims}
        familyEdges={familyEdges}
        partnerEdges={partnerEdges}
        legacyName="Caliente"
      />,
    )
    expect(screen.getByRole('group', { name: /Caliente tree — 2 sims/i })).toBeTruthy()
  })

  it('exposes each sim as a button with its name when selectable', () => {
    render(
      <LineageTree
        sims={sims}
        familyEdges={familyEdges}
        partnerEdges={partnerEdges}
        onSelectSim={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /Dina Caliente/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Reed Caliente/ })).toBeTruthy()
  })
})
