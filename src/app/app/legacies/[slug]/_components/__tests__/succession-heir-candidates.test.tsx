// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Succession } from '../succession/succession'
import type { ChronicleSim, SuccessionStep } from '../../lib/types'

// This file renders Succession WITH the real NameHeirDialog (no dialog mock) so
// the next-generation candidate filtering in succession.tsx is proven end-to-end
// through user-visible options. Only true external boundaries are mocked: the
// tRPC mutation + router the real dialog needs, plus next/image.
const mutateAsync = vi.fn().mockResolvedValue({})
const refresh = vi.fn()
vi.mock('@/trpc/client', () => ({
  trpc: {
    sims: { update: { useMutation: () => ({ mutateAsync, isPending: false }) } },
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('next/image', () => ({
  default: ({ alt }: { src: string; alt: string }) => (
    <span data-testid="portrait-image" aria-label={alt} />
  ),
}))
vi.mock('next/link', () => ({
  default: (props: {
    href: string
    children: React.ReactNode
    className?: string
    'aria-label'?: string
  }) => (
    <a href={props.href} className={props.className} aria-label={props['aria-label']}>
      {props.children}
    </a>
  ),
}))

// Founder is Gen I, so the only valid heir candidates are Gen II sims.
const founder: SuccessionStep = {
  sim: {
    id: 'dina',
    firstName: 'Dina',
    lastName: 'Caliente',
    imageUrl: null,
    generationNumber: 1,
    lifeStage: 'ADULT',
    isHeir: false,
    isFounder: true,
    aspirationName: null,
  },
  role: 'Founder',
  isHeir: false,
  isFounder: true,
}

function sim(over: Partial<ChronicleSim> & { id: string; firstName: string }): ChronicleSim {
  return {
    lastName: 'Caliente',
    imageUrl: null,
    generationNumber: 2,
    lifeStage: 'YOUNG_ADULT',
    isHeir: false,
    isFounder: false,
    aspirationName: null,
    ...over,
  }
}

describe('Succession — heir candidate filtering (real dialog)', () => {
  beforeEach(() => {
    mutateAsync.mockClear()
    refresh.mockClear()
  })

  it('offers only next-generation sims as heir options and labels the next generation', async () => {
    const genII = sim({ id: 'g2', firstName: 'Genevieve', generationNumber: 2 })
    const genIII = sim({ id: 'g3', firstName: 'Tertius', generationNumber: 3 })
    const genless = sim({ id: 'gx', firstName: 'Drifter', generationNumber: null })

    const user = userEvent.setup()
    render(
      <Succession
        steps={[founder]}
        slug="caliente"
        sims={[genII, genIII, genless]}
      />,
    )

    // The "Name an heir" trigger shows the next generation to fill (Gen II).
    const trigger = screen.getByRole('button', { name: /Name an heir/i })
    expect(screen.getByText('Gen II')).toBeInTheDocument()

    // Open the dialog and inspect the offered options.
    await user.click(trigger)

    // The Gen II sim is offered as a selectable heir option.
    expect(
      await screen.findByRole('button', { name: /Genevieve Caliente/i }),
    ).toBeInTheDocument()

    // The Gen III sim and the generation-less sim are NOT offered.
    expect(
      screen.queryByRole('button', { name: /Tertius Caliente/i }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: /Drifter Caliente/i }),
    ).toBeNull()
  })
})
