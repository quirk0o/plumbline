import { AppNav } from './app-nav'

interface AppShellProps {
  name: string | null
  email: string | null
  image: string | null
  children: React.ReactNode
}

/**
 * Presentational app chrome: a skip-to-content link, the top navigation, and
 * the main landmark. Kept separate from the async `AppLayout` (which fetches the
 * session) so the shell's accessibility semantics can be rendered and asserted
 * in jsdom without server-only dependencies.
 */
export function AppShell({ name, email, image, children }: AppShellProps) {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <AppNav name={name} email={email} image={image} />
      <main id="main-content">{children}</main>
    </>
  )
}
