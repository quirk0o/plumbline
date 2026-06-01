import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/server/db'
import {
  computeStats,
  deriveMilestones,
  deriveSuccession,
  groupByGeneration,
  mergeMilestones,
  selectDesignateHeir,
  toChronicleSim,
  toUserMilestones,
} from './lib/derive'
import type { FetchedLegacy } from './lib/types'
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
          updatedAt: true,
          causeOfDeath: true,
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

  // Parent→child links for sims in this legacy — used to decide whether a sim
  // was born into the legacy (has an in-legacy parent) vs. married/moved in.
  const familyRelationships = await db.familyRelationship.findMany({
    where: { child: { legacyId: legacy.id } },
    select: { parentId: true, childId: true },
  })

  // Persisted, user-authored milestones for this legacy.
  const userMilestones = await db.milestone.findMany({
    where: { legacyId: legacy.id },
    select: {
      id: true,
      title: true,
      blurb: true,
      sortOrder: true,
      sims: { select: { simId: true } },
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
    familyRelationships,
    userMilestones,
  }

  const chronicleSims = fetched.sims.map((s) =>
    toChronicleSim(s, fetched.founderSimId),
  )
  const milestones = mergeMilestones(
    deriveMilestones(fetched),
    toUserMilestones(fetched),
  )
  const succession = deriveSuccession(chronicleSims, fetched.founderSimId)
  const groups = groupByGeneration(chronicleSims)
  const stats = computeStats(fetched, milestones)
  const simsById = Object.fromEntries(chronicleSims.map((s) => [s.id, s]))

  const founder = chronicleSims.find((s) => s.isFounder) ?? null

  // Current heir = the same sim the succession line marks "Heir designate"
  // (highest numbered heir). Fall back to the founder when they are the only heir.
  const currentHeir =
    selectDesignateHeir(chronicleSims, fetched.founderSimId) ??
    (founder?.isHeir ? founder : null)

  return (
    <div className={styles.grid}>
      <SectionNav items={NAV_ITEMS} />
      <ChronicleSections
        name={fetched.name}
        description={fetched.description}
        slug={slug}
        legacyId={fetched.id}
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
