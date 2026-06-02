import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AppShell } from './components/app-shell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin?callbackUrl=/app')

  return (
    <AppShell
      name={session.user.name ?? null}
      email={session.user.email ?? null}
      image={session.user.image ?? null}
    >
      {children}
    </AppShell>
  )
}
