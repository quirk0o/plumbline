'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/trpc/client'
import { AppNav } from '@/app/app/components/app-nav'
import { LineageTree } from '@/components/lineage-tree/lineage-tree'
import { Plumbob } from '@/components/plumbob'
import { splitLegacyName } from '../../lib/legacy-title'
import styles from './tree-overlay.module.css'

/** Selector for the focusable elements a Tab trap should cycle through. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface TreeOverlayProps {
  legacySlug: string
  legacyName: string
  founderSimId?: string
  name: string | null
  email: string | null
  image: string | null
  onClose: () => void
}

function LegacyTitle({ name }: { name: string }) {
  const parts = splitLegacyName(name)
  if (parts) {
    return (
      <h2 className={styles.headerTitle}>
        {parts.before}{' '}
        <em className={styles.titleAccent}>{parts.legacy}</em>
      </h2>
    )
  }
  return <h2 className={styles.headerTitle}>{name}</h2>
}

/**
 * Floating "glass" capsule pinned to the top-left of the canvas, echoing the
 * legacy identity over the dot-grid. The legacy name keeps its amber trailing
 * "Legacy" word — rendered upright (not italic) per the brand monogram rule.
 */
function LegacyCapsule({
  name,
  simCount,
  generationCount,
}: {
  name: string
  simCount: number
  generationCount: number
}) {
  const parts = splitLegacyName(name)
  const simLabel = `${simCount} ${simCount === 1 ? 'sim' : 'sims'}`
  const genLabel = `${generationCount} ${
    generationCount === 1 ? 'generation' : 'generations'
  }`
  return (
    <div className={styles.capsule} aria-hidden="true">
      <Plumbob size={12} />
      <div className={styles.capsuleText}>
        <span className={styles.capsuleEyebrow}>Legacy</span>
        <span className={styles.capsuleTitle}>
          {parts ? (
            <>
              {parts.before}{' '}
              <span className={styles.capsuleAccent}>{parts.legacy}</span>
            </>
          ) : (
            name
          )}
        </span>
        <span className={styles.capsuleMeta}>
          {simLabel} · {genLabel}
        </span>
      </div>
    </div>
  )
}

/** Decorative key for the node/connector colours, pinned bottom-center. */
function TreeLegend() {
  return (
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
  )
}

export function TreeOverlay({
  legacySlug,
  legacyName,
  founderSimId,
  name,
  email,
  image,
  onClose,
}: TreeOverlayProps) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement>(null)
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  const { data, isLoading, isError } = trpc.sims.getTreeData.useQuery({ legacySlug })

  // Derived identity for the floating capsule. Generations = distinct, non-null
  // generation numbers among the charted sims.
  const simCount = data?.sims.length ?? 0
  const generationCount = data
    ? new Set(
        data.sims
          .map((s) => s.generationNumber)
          .filter((g): g is number => g !== null),
      ).size
    : 0

  // Lock body scroll while overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Capture previously focused element on mount; restore on unmount
  useEffect(() => {
    previousFocusRef.current = document.activeElement
    backButtonRef.current?.focus()
    return () => {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
    }
  }, [])

  // Close on Escape; trap Tab/Shift+Tab within the dialog so keyboard focus
  // never leaks to the page behind the modal overlay.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || !dialog.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSelectSim(simId: string) {
    router.push(`/app/legacies/${legacySlug}/sims/${simId}`)
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${legacyName} family tree`}
      className={styles.overlay}
    >
      <AppNav name={name} email={email} image={image} />

      <div className={styles.header}>
        <button
          ref={backButtonRef}
          type="button"
          className={styles.backButton}
          onClick={onClose}
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
          Back to legacy
        </button>

        <LegacyTitle name={legacyName} />
      </div>

      <div className={styles.body}>
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
        {!isLoading && !isError && (!data || data.sims.length === 0) && (
          <p className={styles.message}>No sims to chart yet.</p>
        )}
        {!isLoading && !isError && data && data.sims.length > 0 && (
          <div className={styles.canvas}>
            <LegacyCapsule
              name={legacyName}
              simCount={simCount}
              generationCount={generationCount}
            />
            <div className={styles.treeContainer}>
              <LineageTree
                sims={data.sims}
                familyEdges={data.familyEdges}
                partnerEdges={data.partnerEdges}
                founderSimId={founderSimId}
                legacyName={legacyName}
                onSelectSim={handleSelectSim}
              />
            </div>
            <TreeLegend />
          </div>
        )}
      </div>
    </div>
  )
}
