'use client'
import { useMemo, useState } from 'react'
import { ReactFlowProvider, useReactFlow, useViewport } from '@xyflow/react'
import { trpc } from '@/trpc/client'
import { Button, ButtonLink } from '@/components/ui'
import { FIT_VIEW_OPTIONS } from '@/components/lineage-tree/fit-options'
import { LineageFlow } from '@/components/lineage-tree/lineage-flow'
import { Plumbob } from '@/components/plumbob'
import { splitLegacyName } from '../../lib/legacy-title'
import { AtlasToolbar, type GenFilter } from './atlas-toolbar'
import { SimInspector } from './sim-inspector'
import styles from './tree-atlas.module.css'

export interface TreeAtlasProps {
  legacySlug: string
  legacyName: string
  founderSimId?: string
}

/** Top-left glass capsule: a back link to the chronicle + the legacy identity. */
function LegacyCapsule({
  legacySlug,
  name,
  simCount,
  generationCount,
}: {
  legacySlug: string
  name: string
  simCount: number
  generationCount: number
}) {
  const parts = splitLegacyName(name)
  const simLabel = `${simCount} ${simCount === 1 ? 'sim' : 'sims'}`
  const genLabel = `${generationCount} ${generationCount === 1 ? 'generation' : 'generations'}`
  return (
    <div className={styles.capsule}>
      <ButtonLink
        href={`/app/legacies/${legacySlug}`}
        size="icon"
        variant="ghost"
        aria-label="Back to legacy"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 3L5 8l5 5" />
        </svg>
      </ButtonLink>
      <Plumbob size={12} />
      <div className={styles.capsuleText}>
        <span className={styles.capsuleEyebrow} aria-hidden="true">
          Legacy
        </span>
        <h1 className={styles.capsuleTitle}>
          {parts ? (
            <>
              {parts.before}{' '}
              <span className={styles.capsuleAccent}>{parts.legacy}</span>
            </>
          ) : (
            name
          )}
        </h1>
      </div>
      {simCount > 0 && (
        <>
          <span className={styles.capsuleDivider} aria-hidden="true" />
          <span className={styles.capsuleMeta} aria-hidden="true">
            {simLabel} · {genLabel}
          </span>
        </>
      )}
    </div>
  )
}

/**
 * Bottom glass bar: colour key + zoom controls (driven by the shared xyflow
 * instance). Must stay rendered inside <ReactFlowProvider> — its useReactFlow
 * and useViewport hooks throw outside one.
 */
function AtlasBottomBar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const { zoom } = useViewport()
  return (
    <div className={styles.bottomBar}>
      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={styles.legendDotHeir} />
          Heir
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDotSim} />
          Sim
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendLineMarriage} />
          Marriage
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendLineLineage} />
          Lineage
        </span>
      </div>
      <span className={styles.divider} aria-hidden="true" />
      <div className={styles.zoomControls}>
        <Button size="icon" variant="ghost" onClick={() => void zoomOut({ duration: 150 })} aria-label="Zoom out">
          −
        </Button>
        <span className={styles.zoomReadout} aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <Button size="icon" variant="ghost" onClick={() => void zoomIn({ duration: 150 })} aria-label="Zoom in">
          +
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void fitView({ ...FIT_VIEW_OPTIONS, duration: 200 })} aria-label="Fit tree to view">
          Fit
        </Button>
      </div>
    </div>
  )
}

/**
 * Full-page family-tree Atlas (a route, not a modal): a dot-grid canvas hosting
 * the pan/zoom lineage tree, a floating legacy capsule, the search + filter
 * toolbar, and the legend + zoom controls. Rendered inside the app shell, so the
 * global AppNav is provided by the layout — this component does not render its own.
 */
export function TreeAtlas({ legacySlug, legacyName, founderSimId }: TreeAtlasProps) {
  const { data, isLoading, isError } = trpc.sims.getTreeData.useQuery({ legacySlug })

  const allSims = useMemo(() => data?.sims ?? [], [data])
  const generations = useMemo(
    () =>
      Array.from(
        new Set(allSims.map((s) => s.generationNumber).filter((g): g is number => g !== null)),
      ).sort((a, b) => a - b),
    [allSims],
  )

  const [genFilter, setGenFilter] = useState<GenFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const visibleSims = useMemo(
    () => (genFilter === 'all' ? allSims : allSims.filter((s) => s.generationNumber === genFilter)),
    [allSims, genFilter],
  )
  const visibleIds = useMemo(() => new Set(visibleSims.map((s) => s.id)), [visibleSims])
  const activeId = selectedId && visibleIds.has(selectedId) ? selectedId : null
  const familyEdges = useMemo(
    () => (data?.familyEdges ?? []).filter((e) => visibleIds.has(e.parentId) && visibleIds.has(e.childId)),
    [data, visibleIds],
  )
  const partnerEdges = useMemo(
    () => (data?.partnerEdges ?? []).filter((e) => visibleIds.has(e.simAId) && visibleIds.has(e.simBId)),
    [data, visibleIds],
  )

  const dimmedIds = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return undefined
    const ids = new Set<string>()
    for (const s of visibleSims) {
      if (!`${s.firstName} ${s.lastName}`.toLowerCase().includes(q)) ids.add(s.id)
    }
    return ids
  }, [query, visibleSims])

  const simCount = allSims.length
  const generationCount = generations.length

  function handleSelectSim(simId: string) {
    setSelectedId(simId)
  }

  return (
    <div className={styles.atlas}>
      <div className={styles.canvas}>
        <LegacyCapsule
          legacySlug={legacySlug}
          name={legacyName}
          simCount={simCount}
          generationCount={generationCount}
        />

        {isLoading && (
          <div role="status" aria-live="polite" className={styles.message}>
            Loading the family tree…
          </div>
        )}
        {isError && (
          <div role="alert" className={styles.message}>
            Could not load the family tree.
          </div>
        )}
        {!isLoading && !isError && allSims.length === 0 && (
          <p className={styles.message}>No sims to chart yet.</p>
        )}

        {!isLoading && !isError && allSims.length > 0 && (
          <ReactFlowProvider>
            <AtlasToolbar
              legacySlug={legacySlug}
              generations={generations}
              genFilter={genFilter}
              query={query}
              onGenChange={setGenFilter}
              onQueryChange={setQuery}
            />

            <div className={styles.flowSurface}>
              {visibleSims.length > 0 ? (
                <LineageFlow
                  sims={visibleSims}
                  familyEdges={familyEdges}
                  partnerEdges={partnerEdges}
                  founderSimId={founderSimId}
                  legacyName={legacyName}
                  dimmedIds={dimmedIds}
                  selectedId={activeId ?? undefined}
                  onSelectSim={handleSelectSim}
                  refitKey={genFilter}
                />
              ) : null}
            </div>

            {visibleSims.length === 0 && (
              <p className={styles.emptyFilter}>No sims in this generation.</p>
            )}

            {dimmedIds && visibleSims.length > 0 && dimmedIds.size === visibleSims.length && (
              <p className={styles.searchEmpty}>No sims match your search.</p>
            )}

            {activeId && (
              <SimInspector
                simId={activeId}
                legacySlug={legacySlug}
                founderSimId={founderSimId}
                onClose={() => setSelectedId(null)}
              />
            )}

            {visibleSims.length > 0 && <AtlasBottomBar />}
          </ReactFlowProvider>
        )}
      </div>
    </div>
  )
}
