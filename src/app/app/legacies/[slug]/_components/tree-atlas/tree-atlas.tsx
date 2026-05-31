'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { trpc } from '@/trpc/client'
import { LineageTree } from '@/components/lineage-tree/lineage-tree'
import { computeLineageLayout } from '@/components/lineage-tree/layout'
import { usePanZoom } from '@/components/lineage-tree/use-pan-zoom'
import { Plumbob } from '@/components/plumbob'
import { splitLegacyName } from '../../lib/legacy-title'
import { AtlasToolbar, type GenFilter } from './atlas-toolbar'
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
      <Link
        href={`/app/legacies/${legacySlug}`}
        className={styles.capsuleBack}
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
      </Link>
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

/** Bottom glass bar: colour key + zoom controls. */
function AtlasBottomBar({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  zoomPercent: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
}) {
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
        <button type="button" className={styles.zoomButton} onClick={onZoomOut} aria-label="Zoom out">
          −
        </button>
        <span className={styles.zoomReadout} aria-live="polite">
          {zoomPercent}%
        </span>
        <button type="button" className={styles.zoomButton} onClick={onZoomIn} aria-label="Zoom in">
          +
        </button>
        <button type="button" className={styles.zoomFit} onClick={onFit} aria-label="Fit tree to view">
          Fit
        </button>
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
  const router = useRouter()

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

  const visibleSims = useMemo(
    () => (genFilter === 'all' ? allSims : allSims.filter((s) => s.generationNumber === genFilter)),
    [allSims, genFilter],
  )
  const visibleIds = useMemo(() => new Set(visibleSims.map((s) => s.id)), [visibleSims])
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

  const layout = useMemo(
    () => computeLineageLayout(visibleSims, familyEdges, partnerEdges),
    [visibleSims, familyEdges, partnerEdges],
  )
  const { transform, zoomPercent, fit, zoomIn, zoomOut, surfaceProps } = usePanZoom(
    layout.viewBox.width,
    layout.viewBox.height,
  )

  const simCount = allSims.length
  const generationCount = generations.length

  function handleSelectSim(simId: string) {
    router.push(`/app/legacies/${legacySlug}/sims/${simId}`)
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
          <>
            <AtlasToolbar
              legacySlug={legacySlug}
              generations={generations}
              genFilter={genFilter}
              query={query}
              onGenChange={setGenFilter}
              onQueryChange={setQuery}
            />

            <div className={styles.surface} {...surfaceProps}>
              <div
                className={styles.viewport}
                style={{
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                }}
              >
                {visibleSims.length > 0 ? (
                  <LineageTree
                    sims={visibleSims}
                    familyEdges={familyEdges}
                    partnerEdges={partnerEdges}
                    founderSimId={founderSimId}
                    legacyName={legacyName}
                    dimmedIds={dimmedIds}
                    onSelectSim={handleSelectSim}
                  />
                ) : null}
              </div>
            </div>

            {visibleSims.length === 0 && (
              <p className={styles.emptyFilter}>No sims in this generation.</p>
            )}

            {dimmedIds && visibleSims.length > 0 && dimmedIds.size === visibleSims.length && (
              <p className={styles.searchEmpty}>No sims match your search.</p>
            )}

            <AtlasBottomBar
              zoomPercent={zoomPercent}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onFit={fit}
            />
          </>
        )}
      </div>
    </div>
  )
}
