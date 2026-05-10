// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Gender, LifeStage } from '@prisma/client'
import { SimForm } from '../sim-form'

vi.mock('../image-upload', () => ({ ImageUpload: () => null }))
vi.mock('../trait-picker', () => ({
  TraitPicker: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button type="button" onClick={() => onChange(['trait-1'])}>Pick trait</button>
  ),
}))

const traits = [{ id: 'trait-1', name: 'Outgoing', category: 'SOCIAL', conflictsWith: [] }]
const aspirations = [{ id: 'asp-1', name: 'Popularity', category: 'SOCIAL' }]
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
    await user.selectOptions(screen.getByLabelText(/gender/i), Gender.FEMALE)
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
    await user.selectOptions(screen.getByLabelText(/gender/i), Gender.MALE)
    await user.selectOptions(screen.getByLabelText(/aspiration/i), 'asp-1')
    await user.selectOptions(screen.getByLabelText(/career/i), 'car-1')
    await user.click(screen.getByRole('button', { name: 'Pick trait' }))
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

    await user.selectOptions(screen.getByLabelText(/pronouns/i), 'Custom')

    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/object/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/possessive/i)).toBeInTheDocument()
  })

  it('auto-fills pronoun fields when a preset is chosen and passes them to onSubmit', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.type(screen.getByLabelText(/first name/i), 'Zara')
    await user.type(screen.getByLabelText(/last name/i), 'Wells')
    await user.selectOptions(screen.getByLabelText(/gender/i), Gender.FEMALE)
    await user.selectOptions(screen.getByLabelText(/pronouns/i), 'She / Her / Hers')
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
    expect(screen.getByLabelText<HTMLSelectElement>(/life stage/i).value).toBe(LifeStage.ADULT)
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
    expect(screen.getByLabelText<HTMLSelectElement>(/pronouns/i).value).toBe('She / Her / Hers')
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
})
