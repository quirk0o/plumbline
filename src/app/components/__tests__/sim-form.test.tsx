// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Gender, LifeStage } from '@prisma/client'
import { SimForm } from '../sim-form'

vi.mock('../image-upload', () => ({ ImageUpload: () => null }))

const traits = [{ id: 'trait-1', name: 'Outgoing', category: 'SOCIAL', minLifeStage: null, maxLifeStage: null, conflictsWith: [] }]
const aspirations = [{ id: 'asp-1', name: 'Popularity', category: 'SOCIAL', minLifeStage: null, maxLifeStage: null }]
const careers = [{ id: 'car-1', name: 'Journalist', type: 'STANDARD' }]

function renderForm(props?: Partial<React.ComponentProps<typeof SimForm>>) {
  const onSubmit = vi.fn()
  render(
    <SimForm
      traits={traits}
      aspirations={aspirations}
      careers={careers}
      onSubmit={onSubmit}
      {...props}
    />
  )
  return { onSubmit }
}

/**
 * Open a Combobox by clicking its trigger (found via aria label), then click
 * the option with the given visible text.
 */
async function selectComboboxOption(
  user: ReturnType<typeof userEvent.setup>,
  triggerLabel: RegExp | string,
  optionText: string,
) {
  await user.click(screen.getByLabelText(triggerLabel))
  await user.click(screen.getByRole('option', { name: optionText }))
}

describe('SimForm', () => {
  it('renders identity fields and a submit button', () => {
    renderForm()
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/gender/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('shows validation errors when submitted with required fields empty', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('First name is required')).toBeInTheDocument()
    expect(screen.getByText('Last name is required')).toBeInTheDocument()
    expect(screen.getByText('Gender is required')).toBeInTheDocument()
  })

  it('calls onSubmit with trimmed, typed data when required fields are filled', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.type(screen.getByLabelText(/first name/i), 'Alice ')
    await user.type(screen.getByLabelText(/last name/i), ' Smith')
    await selectComboboxOption(user, /gender/i, 'Female')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Alice',
        lastName: 'Smith',
        gender: Gender.FEMALE,
        lifeStage: LifeStage.YOUNG_ADULT,
        personalityTraitIds: [],
      })
    )
  })

  it('passes optional fields through to onSubmit when provided', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.type(screen.getByLabelText(/first name/i), 'Bob')
    await user.type(screen.getByLabelText(/last name/i), 'Newbie')
    await selectComboboxOption(user, /gender/i, 'Male')
    await selectComboboxOption(user, /aspiration/i, 'Popularity')
    await selectComboboxOption(user, /career/i, 'Journalist')
    await user.click(screen.getByRole('button', { name: 'Outgoing' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        aspirationId: 'asp-1',
        careerId: 'car-1',
        personalityTraitIds: ['trait-1'],
      })
    )
  })

  it('hides custom pronoun inputs by default and shows them when Custom is selected', async () => {
    const user = userEvent.setup()
    renderForm()

    expect(screen.queryByLabelText(/subject/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/object/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/possessive/i)).not.toBeInTheDocument()

    await selectComboboxOption(user, /pronouns/i, 'Custom')

    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/object/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/possessive/i)).toBeInTheDocument()
  })

  it('auto-fills pronoun fields when a preset is chosen and passes them to onSubmit', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.type(screen.getByLabelText(/first name/i), 'Zara')
    await user.type(screen.getByLabelText(/last name/i), 'Wells')
    await selectComboboxOption(user, /gender/i, 'Female')
    await selectComboboxOption(user, /pronouns/i, 'She / Her / Hers')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        pronounSubject: 'she',
        pronounObject: 'her',
        pronounPossessive: 'hers',
      })
    )
  })

  it('displays an external root error from the errors prop', async () => {
    renderForm({ errors: { root: 'Something went wrong on the server' } })

    await waitFor(() =>
      expect(screen.getByText('Something went wrong on the server')).toBeInTheDocument()
    )
  })

  it('renders with defaultValues pre-filled', () => {
    renderForm({
      defaultValues: {
        firstName: 'Eve',
        lastName: 'Garden',
        gender: Gender.FEMALE,
        lifeStage: LifeStage.ADULT,
      },
    })

    expect(screen.getByLabelText<HTMLInputElement>(/first name/i).value).toBe('Eve')
    expect(screen.getByLabelText<HTMLInputElement>(/last name/i).value).toBe('Garden')
    // Combobox trigger shows the selected label as visible text
    expect(screen.getByLabelText(/life stage/i)).toHaveTextContent('Adult')
  })

  it('renders a Back button when onBack is provided', () => {
    const onBack = vi.fn()
    renderForm({ onBack })
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
  })

  it('calls onBack when the Back button is clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    renderForm({ onBack })

    await user.click(screen.getByRole('button', { name: /back/i }))

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows matching preset in pronoun selector when defaultValues has preset pronouns', () => {
    renderForm({
      defaultValues: {
        pronounSubject: 'she',
        pronounObject: 'her',
        pronounPossessive: 'hers',
      },
    })
    // Combobox trigger shows the selected label as visible text
    expect(screen.getByLabelText(/pronouns/i)).toHaveTextContent('She / Her / Hers')
  })

  it('shows custom pronoun inputs immediately when defaultValues has non-preset pronouns', () => {
    renderForm({
      defaultValues: {
        pronounSubject: 'xe',
        pronounObject: 'xem',
        pronounPossessive: 'xyr',
      },
    })
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/object/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/possessive/i)).toBeInTheDocument()
  })

  it('back button accessible name is "Back" — arrow character is decorative', () => {
    renderForm({ onBack: vi.fn() })
    // Exact name match: fails if the arrow is included in the accessible name
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('shows the household picker when households are provided and submits the choice', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({
      onSubmit,
      households: [{ id: 'h1', name: 'Goth Manor' }],
    })

    await user.type(screen.getByPlaceholderText('First name'), 'Bella')
    await user.type(screen.getByPlaceholderText('Last name'), 'Goth')
    await user.click(screen.getByLabelText(/gender/i))
    await user.click(await screen.findByRole('option', { name: 'Female' }))
    await user.click(screen.getByLabelText(/household/i))
    await user.click(await screen.findByRole('option', { name: 'Goth Manor' }))
    await user.click(screen.getByRole('button', { name: /Save|Add sim|Create/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ householdId: 'h1' }))
  })

  it('hides the household picker when no households are provided', () => {
    renderForm({})
    expect(screen.queryByLabelText(/household/i)).not.toBeInTheDocument()
  })

  it('offers the found-household checkbox with a live name preview, checked by default', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({ onSubmit, offerFoundHousehold: true })

    const checkbox = screen.getByRole('checkbox', { name: /Settle them into a household/i })
    expect(checkbox).toBeChecked()

    await user.type(screen.getByPlaceholderText('Last name'), 'Caliente')
    expect(screen.getByText(/The Caliente Household/)).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('First name'), 'Dina')
    await user.click(screen.getByLabelText(/gender/i))
    await user.click(await screen.findByRole('option', { name: 'Female' }))
    await user.click(screen.getByRole('button', { name: /Save|Add sim|Create/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ foundHousehold: true }))
  })
})
