// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignInForm from '../sign-in-form'

const { mockSignIn, mockGet } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockGet: vi.fn(),
}))

vi.mock('next-auth/react', () => ({ signIn: mockSignIn }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockGet }),
}))
vi.mock('@/components/plumbob', () => ({ Plumbob: () => null }))

describe('SignInForm', () => {
  beforeEach(() => {
    mockGet.mockReturnValue(null)
    mockSignIn.mockResolvedValue({})
  })

  it('renders Google button, email input, and submit button', () => {
    render(<SignInForm />)
    expect(screen.getByText('Continue with Google')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument()
    expect(screen.getByText('Send magic link')).toBeInTheDocument()
  })

  it('shows success state after submitting an email', async () => {
    const user = userEvent.setup()
    render(<SignInForm />)
    await user.type(screen.getByPlaceholderText('your@email.com'), 'test@example.com')
    await user.click(screen.getByText('Send magic link'))
    await waitFor(() => {
      expect(screen.getByText('Check your inbox')).toBeInTheDocument()
    })
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('calls signIn("email") with callbackUrl defaulting to /app', async () => {
    const user = userEvent.setup()
    render(<SignInForm />)
    await user.type(screen.getByPlaceholderText('your@email.com'), 'me@example.com')
    await user.click(screen.getByText('Send magic link'))
    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('email', {
        email: 'me@example.com',
        callbackUrl: '/app',
        redirect: false,
      })
    )
  })

  it('forwards a safe relative callbackUrl', async () => {
    mockGet.mockImplementation((key: string) =>
      key === 'callbackUrl' ? '/app/settings' : null
    )
    const user = userEvent.setup()
    render(<SignInForm />)
    await user.type(screen.getByPlaceholderText('your@email.com'), 'me@example.com')
    await user.click(screen.getByText('Send magic link'))
    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('email', expect.objectContaining({
        callbackUrl: '/app/settings',
      }))
    )
  })

  it('rejects an external callbackUrl and falls back to /app', async () => {
    mockGet.mockImplementation((key: string) =>
      key === 'callbackUrl' ? 'https://evil.com' : null
    )
    const user = userEvent.setup()
    render(<SignInForm />)
    await user.type(screen.getByPlaceholderText('your@email.com'), 'me@example.com')
    await user.click(screen.getByText('Send magic link'))
    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('email', expect.objectContaining({
        callbackUrl: '/app',
      }))
    )
  })

  it('shows OAuthAccountNotLinked error message', () => {
    mockGet.mockImplementation((key: string) =>
      key === 'error' ? 'OAuthAccountNotLinked' : null
    )
    render(<SignInForm />)
    expect(
      screen.getByText(/already linked to a different sign-in method/)
    ).toBeInTheDocument()
  })

  it('shows generic error message for unknown error codes', () => {
    mockGet.mockImplementation((key: string) =>
      key === 'error' ? 'SomeOtherError' : null
    )
    render(<SignInForm />)
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
  })

  it('calls signIn("google") with callbackUrl when Google button is clicked', async () => {
    render(<SignInForm />)
    await userEvent.click(screen.getByText('Continue with Google'))
    expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/app' })
  })
})
