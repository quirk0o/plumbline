// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LineageTree, type LineageTreeSim } from '../lineage-tree'

const makeSim = (overrides: Partial<LineageTreeSim> & { id: string }): LineageTreeSim => ({
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
  makeSim({ id: 'founder', firstName: 'Dina', lastName: 'Caliente', generationNumber: 1 }),
  makeSim({ id: 'partner', firstName: 'Mortimer', lastName: 'Goth', generationNumber: 1 }),
  makeSim({
    id: 'heir',
    firstName: 'Reed',
    lastName: 'Caliente',
    generationNumber: 2,
    isHeir: true,
    imageUrl: '/uploads/reed.png',
  }),
]
const familyEdges = [
  { parentId: 'founder', childId: 'heir' },
  { parentId: 'partner', childId: 'heir' },
]
const partnerEdges = [{ simAId: 'founder', simBId: 'partner' }]

describe('LineageTree', () => {
  it('renders an <svg> as a labelled group (not an opaque image)', () => {
    render(<LineageTree sims={sims} familyEdges={familyEdges} partnerEdges={partnerEdges} />)
    const svg = screen.getByRole('group', { name: /Family tree —/ })
    expect(svg.tagName.toLowerCase()).toBe('svg')
  })

  it('renders one node group per sim', () => {
    render(
      <LineageTree
        sims={sims}
        familyEdges={familyEdges}
        partnerEdges={partnerEdges}
        onSelectSim={() => {}}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(sims.length)
  })

  it('renders a heir crown for the heir', () => {
    const { getAllByTestId } = render(
      <LineageTree sims={sims} familyEdges={familyEdges} partnerEdges={partnerEdges} />,
    )
    expect(getAllByTestId('heir-crown')).toHaveLength(1)
  })

  it('renders monogram initials for a sim without a portrait', () => {
    render(<LineageTree sims={sims} familyEdges={familyEdges} partnerEdges={partnerEdges} />)
    expect(screen.getByText('DC')).toBeInTheDocument()
  })

  it('renders an SVG <image> for a sim with a portrait', () => {
    const { getAllByTestId } = render(
      <LineageTree sims={sims} familyEdges={familyEdges} partnerEdges={partnerEdges} />,
    )
    const portraits = getAllByTestId('crest-portrait')
    expect(portraits).toHaveLength(1)
    expect(portraits[0].tagName.toLowerCase()).toBe('image')
  })

  it('calls onSelectSim with the sim id when a node is clicked', () => {
    const onSelectSim = vi.fn()
    render(
      <LineageTree
        sims={sims}
        familyEdges={familyEdges}
        partnerEdges={partnerEdges}
        onSelectSim={onSelectSim}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Reed Caliente/ }))
    expect(onSelectSim).toHaveBeenCalledWith('heir')
  })

  it('renders nothing when there are no sims', () => {
    const { container } = render(
      <LineageTree sims={[]} familyEdges={[]} partnerEdges={[]} />,
    )
    expect(container.querySelector('svg')).toBeNull()
  })

  it('sizes the <svg> to its intrinsic viewBox (pan/zoom scales it, CSS does not stretch it)', () => {
    render(<LineageTree sims={sims} familyEdges={familyEdges} partnerEdges={partnerEdges} />)
    const svg = screen.getByRole('group', { name: /Family tree —/ })
    const viewBox = svg.getAttribute('viewBox')!.split(' ')
    expect(svg.getAttribute('width')).toBe(viewBox[2])
    expect(svg.getAttribute('height')).toBe(viewBox[3])
  })

  it('fades nodes whose id is in dimmedIds (search highlight)', () => {
    render(
      <LineageTree
        sims={sims}
        familyEdges={familyEdges}
        partnerEdges={partnerEdges}
        dimmedIds={new Set(['founder'])}
      />,
    )
    const dina = screen.getByText('Dina Caliente').closest('[data-tree-node]') as HTMLElement
    const reed = screen.getByText('Reed Caliente').closest('[data-tree-node]') as HTMLElement
    expect(dina.style.opacity).toBe('0.25')
    expect(reed.style.opacity).toBe('')
  })
})
