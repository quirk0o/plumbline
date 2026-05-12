import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/server/db'
import { fetchTraitsWithConflicts, fetchAspirations, fetchCareers, fetchSkills } from '@/lib/reference-data'
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
    db.sim.findFirst({
      where: { id, legacy: { slug, userId } },
      include: {
        personalityTraits: { include: { personalityTrait: true } },
        aspirations: { include: { aspiration: true } },
        careers: { include: { career: true } },
        skills: { include: { skill: true } },
        parentsOf: {
          include: { child: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
        },
        childOf: {
          include: { parent: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
        },
        socialRelationshipsA: {
          include: { simB: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
        },
        socialRelationshipsB: {
          include: { simA: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
        },
      },
    }),
    db.sim.findMany({
      where: { legacy: { slug, userId } },
      select: { id: true, firstName: true, lastName: true, imageUrl: true },
      orderBy: { firstName: 'asc' },
    }),
    fetchTraitsWithConflicts(),
    fetchAspirations(),
    fetchCareers(),
    fetchSkills(),
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
