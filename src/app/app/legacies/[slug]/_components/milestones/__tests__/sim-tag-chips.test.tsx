// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SimTagChips } from '../sim-tag-chips'
import type { ChronicleSim } from '../../../lib/types'

const sims: ChronicleSim[] = [
  { id: 's1', firstName: 'Reed', lastName: 'Caliente', imageUrl: null, generationNumber: 3, lifeStage: 'TEEN', isHeir: true, isFounder: false, aspirationName: null },
  { id: 's2', firstName: 'Don', lastName: 'Lothario', imageUrl: null, generationNumber: 2, lifeStage: 'ADULT', isHeir: false, isFounder: false, aspirationName: null },
]

describe('SimTagChips', () => {
  it('reflects selection with aria-pressed', () => {
    render(<SimTagChips sims={sims} value={['s1']} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Reed/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Don/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('fires onToggle with the sim id when a chip is clicked', async () => {
    const onToggle = vi.fn()
    render(<SimTagChips sims={sims} value={[]} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('button', { name: /Don/ }))
    expect(onToggle).toHaveBeenCalledWith('s2')
  })
})
