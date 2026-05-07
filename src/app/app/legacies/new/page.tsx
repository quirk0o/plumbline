import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { LegacyWizard } from './legacy-wizard'

export default async function NewLegacyPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  return <LegacyWizard />
}
