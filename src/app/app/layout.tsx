import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AppNav } from './components/AppNav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin?callbackUrl=/app')

  return (
    <>
      <AppNav
        name={session.user.name ?? null}
        email={session.user.email ?? null}
        image={session.user.image ?? null}
      />
      <main>{children}</main>
    </>
  )
}
