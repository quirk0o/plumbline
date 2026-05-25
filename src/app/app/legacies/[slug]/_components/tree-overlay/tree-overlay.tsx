'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/trpc/client'
import { AppNav } from '@/app/app/components/app-nav'
import { LineageTree } from '@/components/lineage-tree/lineage-tree'
import { splitLegacyName } from '../../lib/legacy-title'
import styles from './tree-overlay.module.css'

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
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  const { data, isLoading, isError } = trpc.sims.getTreeData.useQuery({ legacySlug })

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

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
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
          <div className={styles.treeContainer}>
            <LineageTree
              sims={data.sims}
              familyEdges={data.familyEdges}
              partnerEdges={data.partnerEdges}
              founderSimId={founderSimId}
              onSelectSim={handleSelectSim}
            />
          </div>
        )}
      </div>
    </div>
  )
}
