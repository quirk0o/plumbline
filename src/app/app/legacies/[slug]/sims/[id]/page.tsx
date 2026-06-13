import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { fetchTraitsWithConflicts, fetchAspirations, fetchCareers, fetchSkills } from '@/lib/reference-data'
import { getSimDetail, listLegacySimsBySlug } from '@/server/lib/sims/pageData'
import { SimDetailClient } from './sim-detail-client'

interface Props {
  params: Promise<{ slug: string; id: string }>
}

export default async function SimDetailPage({ params }: Props) {
  const { slug, id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const userId = session.user.id

  const [sim, legacySims, traits, aspirations, careers, skills] = await Promise.all([
    getSimDetail(slug, id, userId),
    listLegacySimsBySlug(slug, userId),
    fetchTraitsWithConflicts(userId),
    fetchAspirations(userId),
    fetchCareers(userId),
    fetchSkills(userId),
  ])

  if (!sim) notFound()

  return (
    <SimDetailClient
      sim={sim}
      slug={slug}
      legacySims={legacySims}
      traits={traits}
      aspirations={aspirations}
      careers={careers}
      skills={skills}
    />
  )
}
