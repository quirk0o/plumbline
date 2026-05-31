import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/server/db'
import {
  computeStats,
  deriveMilestones,
  deriveSuccession,
  groupByGeneration,
  toChronicleSim,
} from './lib/derive'
import type { ChronicleSim, FetchedLegacy } from './lib/types'
import { SectionNav } from './_components/section-nav/section-nav'
import { ChronicleSections } from './_components/chronicle-sections/chronicle-sections'
import { ViewTree } from './_components/view-tree/view-tree'
import styles from './page.module.css'

interface Props {
  params: Promise<{ slug: string }>
}

const NAV_ITEMS = [
  { id: 'hero', label: 'Chronicle' },
  { id: 'succession', label: 'Succession' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'sims', label: 'Family' },
]

export default async function LegacyDetailPage({ params }: Props) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const legacy = await db.legacy.findFirst({
    where: { slug, userId: session.user.id },
    select: {
      id: true,
      name: true,
      description: true,
      founderSimId: true,
      households: { select: { id: true } },
      sims: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          imageUrl: true,
          generationNumber: true,
          isHeir: true,
          lifeStage: true,
          createdAt: true,
          aspirations: {
            select: {
              id: true,
              completedAt: true,
              createdAt: true,
              aspiration: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!legacy) notFound()

  // Social relationships for sims in this legacy — only MARRIED rows are used
  // by milestone derivation, but we fetch all and let derive.ts filter so the
  // fetched shape stays a faithful FetchedSocialRelationship[].
  const socialRelationships = await db.socialRelationship.findMany({
    where: { simA: { legacyId: legacy.id } },
    select: {
      id: true,
      simAId: true,
      simBId: true,
      romanticStatus: true,
      createdAt: true,
    },
  })

  // Build a well-typed FetchedLegacy. The select above already matches the
  // FetchedSim/FetchedHousehold shapes; this assignment makes the contract
  // explicit and would fail to compile if either side drifted.
  const fetched: FetchedLegacy = {
    id: legacy.id,
    name: legacy.name,
    description: legacy.description,
    founderSimId: legacy.founderSimId,
    sims: legacy.sims,
    households: legacy.households,
    socialRelationships,
  }

  const chronicleSims = fetched.sims.map((s) =>
    toChronicleSim(s, fetched.founderSimId),
  )
  const milestones = deriveMilestones(fetched)
  const succession = deriveSuccession(chronicleSims, fetched.founderSimId)
  const groups = groupByGeneration(chronicleSims)
  const stats = computeStats(fetched, milestones)
  const simsById = Object.fromEntries(chronicleSims.map((s) => [s.id, s]))

  const founder = chronicleSims.find((s) => s.isFounder) ?? null

  // Current heir = the heir with the highest generationNumber (nulls last).
  const currentHeir =
    chronicleSims
      .filter((s) => s.isHeir)
      .reduce<ChronicleSim | null>((best, sim) => {
        if (best === null) return sim
        const bestGen = best.generationNumber
        const simGen = sim.generationNumber
        if (simGen === null) return best
        if (bestGen === null) return sim
        return simGen > bestGen ? sim : best
      }, null) ?? null

  return (
    <div className={styles.grid}>
      <SectionNav items={NAV_ITEMS} />
      <ChronicleSections
        name={fetched.name}
        description={fetched.description}
        slug={slug}
        stats={stats}
        founder={founder}
        currentHeir={currentHeir}
        succession={succession}
        milestones={milestones}
        simsById={simsById}
        groups={groups}
        treeSlot={<ViewTree legacySlug={slug} />}
      />
    </div>
  )
}
