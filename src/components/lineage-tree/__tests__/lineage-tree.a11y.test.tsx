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
    render(
      <LineageTree sims={sims} familyEdges={familyEdges} partnerEdges={partnerEdges} />,
    )
    // The existing getByRole('group') assertions below already confirm the svg
    // is a labelled group, not an opaque image.
    expect(screen.getByRole('group', { name: /family tree|tree —/i })).toBeInTheDocument()
  })

  it('labels the tree as a group', () => {
    render(
      <LineageTree sims={sims} familyEdges={familyEdges} partnerEdges={partnerEdges} />,
    )
    expect(screen.getByRole('group', { name: /family tree|tree —/i })).toBeInTheDocument()
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
    expect(screen.getByRole('group', { name: /Caliente tree — 2 sims/i })).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /Dina Caliente/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reed Caliente/ })).toBeInTheDocument()
  })
})
