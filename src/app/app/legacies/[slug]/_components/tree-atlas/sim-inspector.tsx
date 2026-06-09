'use client'
import { useEffect, useRef } from 'react'
import { RomanticStatus } from '@prisma/client'
import { trpc } from '@/trpc/client'
import { Button, ButtonLink, Eyebrow, PortraitAvatar, Badge } from '@/components/ui'
import { formatLifeStage, roman } from '@/lib/legacy-format'
import styles from './sim-inspector.module.css'

/** Current bonds worth surfacing a "Partner" for, strongest first. */
const PARTNER_STATUSES: RomanticStatus[] = [
  RomanticStatus.MARRIED,
  RomanticStatus.ENGAGED,
  RomanticStatus.PARTNER,
  RomanticStatus.DATING,
]

export interface SimInspectorProps {
  simId: string
  legacySlug: string
  founderSimId?: string
  onClose: () => void
}

export function SimInspector({ simId, legacySlug, founderSimId, onClose }: SimInspectorProps) {
  const { data: sim, isLoading, isError } = trpc.sims.getById.useQuery({ id: simId })
  const closeRef = useRef<HTMLButtonElement>(null)

  // Esc closes the inspector. (Adds a listener only — no setState in the effect body.)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Move focus into the panel when it opens (and when the selection changes) so
  // keyboard users land on the inspector instead of tabbing through the tree.
  useEffect(() => {
    closeRef.current?.focus()
  }, [simId])

  const isHeir = sim?.isHeir ?? false
  const isFounder = !!sim && sim.id === founderSimId
  const ring = isFounder ? 'founder' : isHeir ? 'heir' : 'green'
  // Intentional asymmetry: the label prioritizes heir over founder (the living
  // heir is the headline status), while the ring prioritizes founder over heir.
  const role = isHeir
    ? 'Current heir'
    : isFounder
      ? 'Founder'
      : sim?.generationNumber != null
        ? `Selected · Gen ${roman(sim.generationNumber)}`
        : 'Selected'

  const aspiration = sim?.aspirations?.[0]?.aspiration?.name ?? null
  const traits = sim?.personalityTraits?.map((pt) => pt.personalityTrait.name) ?? []
  const parents = sim?.childOf?.map((r) => r.parent) ?? []
  const partner =
    [
      ...(sim?.socialRelationshipsA ?? []).map((r) => ({ status: r.romanticStatus, endedAt: r.endedAt, p: r.simB })),
      ...(sim?.socialRelationshipsB ?? []).map((r) => ({ status: r.romanticStatus, endedAt: r.endedAt, p: r.simA })),
    ]
      // Exclude deliberately-ended bonds (divorce / break-up); a widowed spouse
      // (endedAt === null, deceased partner) is still a current partner and stays.
      .filter((r) => r.endedAt === null && PARTNER_STATUSES.includes(r.status))
      .sort((a, b) => PARTNER_STATUSES.indexOf(a.status) - PARTNER_STATUSES.indexOf(b.status))[0]
      ?.p ?? null

  return (
    <aside
      className={styles.inspector}
      aria-label={sim ? `${sim.firstName} ${sim.lastName} details` : 'Sim details'}
    >
      <div className={styles.header}>
        <Eyebrow color={isHeir ? 'var(--amber-text)' : undefined}>{role}</Eyebrow>
        <Button
          ref={closeRef}
          size="icon"
          variant="ghost"
          className={styles.closeSlot}
          onClick={onClose}
          aria-label="Close sim details"
        >
          ✕
        </Button>
      </div>

      {isLoading && (
        <p className={styles.message} role="status" aria-live="polite">
          Loading…
        </p>
      )}
      {isError && (
        <p className={styles.message} role="alert">
          Could not load this sim.
        </p>
      )}

      {sim && (
        <div className={styles.body}>
          <div className={styles.identity}>
            <PortraitAvatar
              imageUrl={sim.imageUrl}
              firstName={sim.firstName}
              lastName={sim.lastName}
              size={60}
              ring={ring}
            />
            <div className={styles.nameBlock}>
              <span className={styles.name}>
                {sim.firstName} {sim.lastName}
              </span>
              <span className={styles.sub}>
                {formatLifeStage(sim.lifeStage)}
                {aspiration ? (
                  <>
                    {' · '}
                    <span className={styles.aspiration}>{aspiration}</span>
                  </>
                ) : null}
              </span>
            </div>
          </div>

          {traits.length > 0 && (
            <div>
              <Eyebrow>Traits</Eyebrow>
              <div className={styles.traits}>
                {traits.map((t) => (
                  <Badge key={t} variant="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {parents.length > 0 && (
            <div>
              <Eyebrow>Parents</Eyebrow>
              <p className={styles.relation}>
                {parents.map((p) => `${p.firstName} ${p.lastName}`).join(' · ')}
              </p>
            </div>
          )}

          {partner && (
            <div>
              <Eyebrow>Partner</Eyebrow>
              <p className={styles.relation}>
                {partner.firstName} {partner.lastName}
              </p>
            </div>
          )}

          <ButtonLink
            href={`/app/legacies/${legacySlug}/sims/${sim.id}`}
            variant="outline"
            size="sm"
            fullWidth
            aria-label={`Open ${sim.firstName} ${sim.lastName}'s profile`}
          >
            Open profile <span aria-hidden="true">→</span>
          </ButtonLink>
        </div>
      )}
    </aside>
  )
}
