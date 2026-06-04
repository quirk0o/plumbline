// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ArrowRightIcon } from '../arrow-right-icon'
import { GitBranchIcon } from '../git-branch-icon'
import { FeatherIcon } from '../feather-icon'
import { UsersIcon } from '../users-icon'
import { UserPlusIcon } from '../user-plus-icon'

const icons = [
  ['ArrowRightIcon', ArrowRightIcon],
  ['GitBranchIcon', GitBranchIcon],
  ['FeatherIcon', FeatherIcon],
  ['UsersIcon', UsersIcon],
  ['UserPlusIcon', UserPlusIcon],
] as const

describe('empty-state icons', () => {
  it.each(icons)('%s renders a decorative svg hidden from screen readers', (_name, Icon) => {
    const { container } = render(<Icon />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})
