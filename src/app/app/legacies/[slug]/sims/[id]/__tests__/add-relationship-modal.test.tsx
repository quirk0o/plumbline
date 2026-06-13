// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { AddRelationshipModal } from '../add-relationship-modal'

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock('@/trpc/client', () => ({
  trpc: {
    traits: { getAll: { useQuery: () => ({ data: [], isLoading: false }) } },
    aspirations: { getAll: { useQuery: () => ({ data: [], isLoading: false }) } },
    careers: { getAll: { useQuery: () => ({ data: [], isLoading: false }) } },
    households: { listByLegacy: { useQuery: () => ({ data: [], isLoading: false }) } },
    sims: { create: { useMutation: () => ({ mutateAsync: mockCreate, isPending: false }) } },
  },
}))

const partnerAvailable = [
  { id: 'sim-a', firstName: 'Aria', lastName: 'Bell', imageUrl: null },
  { id: 'sim-b', firstName: 'Bob', lastName: 'Stone', imageUrl: null },
]
const familyAvailable = [
  { id: 'sim-c', firstName: 'Clara', lastName: 'Day', imageUrl: null },
]

function renderModal(overrides?: Partial<React.ComponentProps<typeof AddRelationshipModal>>) {
  const props = {
    legacyId: 'leg-1',
    partnerAvailable,
    familyAvailable,
    onAddPartner: vi.fn(),
    onAddFamily: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<AddRelationshipModal {...props} />)
  return props
}

async function openCombobox(user: ReturnType<typeof userEvent.setup>, label: RegExp | string) {
  await user.click(screen.getByRole('button', { name: label }))
}

async function openCreateSimModal(user: ReturnType<typeof userEvent.setup>) {
  await openCombobox(user, /select sim/i)
  await user.click(screen.getByText(/create new sim/i))
  return screen.getByRole('dialog', { name: 'Create new sim' })
}

describe('AddRelationshipModal', () => {
  it('renders as a dialog with the title "Add relationship"', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Add relationship' })).toBeInTheDocument()
  })

  it('lists available partner sims in the combobox', async () => {
    const user = userEvent.setup()
    renderModal()
    await openCombobox(user, /select sim/i)
    expect(screen.getByText('Aria Bell')).toBeVisible()
    expect(screen.getByText('Bob Stone')).toBeVisible()
  })

  it('includes "Create new sim…" in the combobox', async () => {
    const user = userEvent.setup()
    renderModal()
    await openCombobox(user, /select sim/i)
    expect(screen.getByText(/create new sim/i)).toBeVisible()
  })

  it('opens CreateSimModal when "Create new sim…" is selected', async () => {
    const user = userEvent.setup()
    renderModal()
    const createDialog = await openCreateSimModal(user)
    expect(createDialog).toBeInTheDocument()
  })

  it('pre-selects the newly created sim in the combobox after creation', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue({ id: 'sim-new', firstName: 'Nina', lastName: 'Caliente', imageUrl: null })
    renderModal()
    const createDialog = await openCreateSimModal(user)

    await user.type(within(createDialog).getByLabelText(/first name/i), 'Nina')
    await user.type(within(createDialog).getByLabelText(/last name/i), 'Caliente')
    await user.click(within(createDialog).getByRole('button', { name: 'Create sim' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Nina Caliente' })).toBeInTheDocument()
    })
  })

  it('closes CreateSimModal when its Back affordance is clicked', async () => {
    const user = userEvent.setup()
    renderModal()
    const createDialog = await openCreateSimModal(user)
    await user.click(within(createDialog).getByRole('button', { name: /back/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Create new sim' })).not.toBeInTheDocument()
    })
  })

  it('calls onAddPartner with SimMini and romantic status on confirm', async () => {
    const user = userEvent.setup()
    const { onAddPartner } = renderModal()
    await openCombobox(user, /select sim/i)
    await user.click(screen.getByText('Aria Bell'))
    await user.click(screen.getByRole('button', { name: /add/i }))
    expect(onAddPartner).toHaveBeenCalledWith(
      { id: 'sim-a', firstName: 'Aria', lastName: 'Bell', imageUrl: null },
      RomanticStatus.DATING,
    )
  })

  it('calls onAddFamily with SimMini, role, and relType on confirm', async () => {
    const user = userEvent.setup()
    const { onAddFamily } = renderModal()
    await user.click(screen.getByRole('button', { name: /family/i }))
    await openCombobox(user, /select sim/i)
    await user.click(screen.getByText('Clara Day'))
    await user.click(screen.getByRole('button', { name: /add/i }))
    expect(onAddFamily).toHaveBeenCalledWith(
      { id: 'sim-c', firstName: 'Clara', lastName: 'Day', imageUrl: null },
      'child',
      FamilyRelationshipType.BIOLOGICAL,
    )
  })

  it('does not offer a "Step" relationship type (step is derived from marriage)', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /family/i }))
    await openCombobox(user, /relationship type/i)
    expect(screen.getByRole('option', { name: 'Biological', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Adoptive', hidden: true })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Step', hidden: true })).not.toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('offers a "Partner" option in the Romantic status combobox', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /romantic status/i }))
    expect(screen.getByRole('option', { name: 'Partner', hidden: true })).toBeInTheDocument()
  })
})
