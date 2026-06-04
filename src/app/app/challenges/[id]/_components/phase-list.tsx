import { Card } from '@/components/ui'
import { Plumbob } from '@/components/plumbob'
import styles from './phase-list.module.css'

export interface PhaseListPhase {
  id: string
  title: string | null
  generationNumber: number | null
  description: string | null
  trackers: { id: string; name: string }[]
}

function phaseTitle(phase: Pick<PhaseListPhase, 'title' | 'generationNumber'>): string {
  if (phase.title) return phase.title
  if (phase.generationNumber != null) return `Generation ${phase.generationNumber}`
  return 'Legacy-wide goals'
}

/** Read-only, fully expanded list of a challenge's phases and their goals. */
export function PhaseList({ phases }: { phases: PhaseListPhase[] }) {
  if (phases.length === 0) {
    return <p className={styles.noPhases}>This challenge has no phases yet.</p>
  }

  return (
    <ol className={styles.list}>
      {phases.map((phase) => (
        <li key={phase.id}>
          <Card as="article">
            <h2 className={styles.phaseTitle}>{phaseTitle(phase)}</h2>
            {phase.description && (
              <p className={styles.phaseDescription}>{phase.description}</p>
            )}
            {phase.trackers.length > 0 && (
              <ul className={styles.goals}>
                {phase.trackers.map((tracker) => (
                  <li key={tracker.id} className={styles.goal}>
                    <Plumbob size={10} />
                    {tracker.name}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </li>
      ))}
    </ol>
  )
}
