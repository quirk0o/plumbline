import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getOwnedLegacyBySlug } from '@/server/lib/legacies/getOwnedLegacy'
import { TreeAtlas } from '../_components/tree-atlas/tree-atlas'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function LegacyTreePage({ params }: Props) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const legacy = await getOwnedLegacyBySlug(slug, session.user.id)
  if (!legacy) notFound()

  return (
    <TreeAtlas
      legacySlug={slug}
      legacyName={legacy.name}
      founderSimId={legacy.founderSimId ?? undefined}
    />
  )
}
