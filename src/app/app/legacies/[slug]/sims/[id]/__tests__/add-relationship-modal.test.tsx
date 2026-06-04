// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { AddRelationshipModal } from '../add-relationship-modal'

vi.mock('@/app/components/create-sim-modal', () => ({
  CreateSimModal: ({
    onCreated,
    onClose,
  }: {
    onCreated: (sim: { id: string; firstName: string; lastName: string; imageUrl: null }) => void
    onClose: () => void
  }) => (
    <div role="dialog" aria-label="Create new sim mock">
      <button onClick={() => onCreated({ id: 'sim-new', firstName: 'Nina', lastName: 'Caliente', imageUrl: null })}>
        Confirm create
      </button>
      <button onClick={onClose}>Cancel create</button>
    </div>
  ),
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
    await openCombobox(user, /select sim/i)
    await user.click(screen.getByText(/create new sim/i))
    expect(screen.getByRole('dialog', { name: /create new sim mock/i })).toBeInTheDocument()
  })

  it('pre-selects the new sim in the combobox after creation', async () => {
    const user = userEvent.setup()
    renderModal()
    await openCombobox(user, /select sim/i)
    await user.click(screen.getByText(/create new sim/i))
    await user.click(screen.getByRole('button', { name: 'Confirm create' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Nina Caliente' })).toBeInTheDocument()
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

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
