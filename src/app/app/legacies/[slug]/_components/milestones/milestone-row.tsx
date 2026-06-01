import { cn } from '@/lib/utils'
import { PortraitAvatar } from '@/components/ui'
import { Plumbob } from '@/components/plumbob'
import { roman } from '@/lib/legacy-format'
import { ringFor } from '../../lib/derive'
import type { Milestone, ChronicleSim } from '../../lib/types'
import styles from './milestone-row.module.css'

export interface MilestoneRowProps {
  milestone: Milestone
  simsById: Record<string, ChronicleSim>
  slug: string
}

/**
 * The inner column content of a milestone row, rendered as a fragment so it can
 * be composed inside exactly one `<li>` (the standalone `MilestoneRow` here, or
 * the draggable/pinned `<li>` wrappers used by the client list). Keeping the
 * `<li>` out of this component is what makes the list markup valid: a `<ul>`
 * must only contain `<li>` direct children.
 */
export function MilestoneRowContent({ milestone, simsById, slug }: MilestoneRowProps) {
  const { kind, gen, title, blurb, userAuthored, simIds } = milestone

  // Resolve only the sim ids that exist in simsById
  const resolvedSims = simIds
    .map((id) => simsById[id])
    .filter((s): s is ChronicleSim => s !== undefined)

  return (
    <>
      {/* Col 1 — meta: kind + generation */}
      <div className={styles.meta}>
        <span className={styles.kind}>{kind}</span>
        {gen !== null && (
          <span className={styles.gen}>Gen {roman(gen)}</span>
        )}
      </div>

      {/* Col 2 — marker (plumbob for derived; open amber circle for user-authored) */}
      <div className={styles.marker}>
        {userAuthored ? (
          <span
            className={styles.authoredMarker}
            data-testid="milestone-authored-marker"
            aria-hidden="true"
          />
        ) : (
          <Plumbob size={10} />
        )}
      </div>

      {/* Col 3 — body: title + optional blurb */}
      <div className={styles.body}>
        <span className={cn(styles.rowTitle, userAuthored && styles.rowTitleItalic)}>
          {title}
        </span>
        {blurb !== null && (
          <span className={styles.rowBlurb}>{blurb}</span>
        )}
      </div>

      {/* Col 4 — overlapping avatars */}
      <div className={styles.avatars}>
        {resolvedSims.map((sim, index) => (
          <div
            key={sim.id}
            className={styles.avatarWrapper}
            style={index > 0 ? { marginLeft: -8 } : undefined}
          >
            <PortraitAvatar
              imageUrl={sim.imageUrl}
              firstName={sim.firstName}
              lastName={sim.lastName}
              size={32}
              ring={ringFor(sim)}
              href={`/app/legacies/${slug}/sims/${sim.id}`}
            />
          </div>
        ))}
      </div>
    </>
  )
}

/** A standalone milestone row: one `<li>` wrapping the column content. */
export function MilestoneRow({ milestone, simsById, slug }: MilestoneRowProps) {
  return (
    <li className={styles.row}>
      <MilestoneRowContent milestone={milestone} simsById={simsById} slug={slug} />
    </li>
  )
}
