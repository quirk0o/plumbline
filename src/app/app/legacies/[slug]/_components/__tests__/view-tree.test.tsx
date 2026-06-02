// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

import { ViewTree } from '../view-tree/view-tree'

describe('ViewTree', () => {
  it('links to the full-page family-tree Atlas route', () => {
    render(<ViewTree legacySlug="caliente" />)
    const link = screen.getByRole('link', { name: /view family tree/i })
    expect(link).toHaveAttribute('href', '/app/legacies/caliente/tree')
  })
})
