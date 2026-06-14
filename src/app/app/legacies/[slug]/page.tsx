import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getLegacyChronicleData } from '@/server/lib/legacies/getLegacyChronicleData'
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
import type { FetchedLegacy, HouseholdSim, HouseholdView } from './lib/types'
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
  { id: 'households', label: 'Households' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'sims', label: 'Family' },
]

export default async function LegacyDetailPage({ params }: Props) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const data = await getLegacyChronicleData(slug, session.user.id)
  if (!data) notFound()

  const { legacy, socialRelationships, familyRelationships, userMilestones, worlds } = data

  // Build a well-typed FetchedLegacy. The select in getLegacyChronicleData matches the
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

  const householdSims: HouseholdSim[] = legacy.sims.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    imageUrl: s.imageUrl,
    isHeir: s.isHeir,
    isFounder: s.id === legacy.founderSimId,
    generationNumber: s.generationNumber,
    lifeStage: s.lifeStage,
    householdId: s.householdId,
  }))
  const householdViews: HouseholdView[] = legacy.households.map((h) => ({
    id: h.id,
    name: h.name,
    worldId: h.worldId,
    worldName: h.world?.name ?? null,
    lot: h.lot,
    description: h.description,
    funds: h.funds,
    lotValue: h.lotValue,
    foundedGeneration: h.foundedGeneration,
    isActive: h.id === legacy.activeHouseholdId,
    residents: householdSims.filter((s) => s.householdId === h.id),
  }))

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
        households={householdViews}
        worlds={worlds}
        householdSims={householdSims}
      />
    </div>
  )
}
