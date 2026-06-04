// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Milestones } from '../milestones/milestones'

vi.mock('next/link', () => ({
  default: (props: { href: string; children: React.ReactNode }) => (
    <a href={props.href}>{props.children}</a>
  ),
}))

vi.mock('@/trpc/client', () => ({
  trpc: {
    milestones: {
      create: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
      update: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
      delete: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
      reorder: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
    },
  },
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe('Milestones — empty state', () => {
  it('renders the Add milestone button when there are no milestones', () => {
    render(<Milestones milestones={[]} simsById={{}} slug="caliente" legacyId="leg-1" />)
    expect(
      screen.getByRole('button', { name: /Add milestone/i }),
    ).toBeInTheDocument()
  })

  it('renders the Milestones section heading', () => {
    render(<Milestones milestones={[]} simsById={{}} slug="caliente" legacyId="leg-1" />)
    expect(
      screen.getByRole('heading', { name: /milestones/i }),
    ).toBeInTheDocument()
  })
})
