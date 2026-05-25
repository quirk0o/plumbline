import { SectionHeading, PortraitAvatar } from '@/components/ui'
import { ringFor } from '../../lib/derive'
import type { SuccessionStep } from '../../lib/types'
import styles from './succession.module.css'

export interface SuccessionProps {
  steps: SuccessionStep[]
}

export function Succession({ steps }: SuccessionProps) {
  return (
    <div className={styles.container}>
      <SectionHeading
        eyebrow="Inheritance"
        title="Succession line"
        blurb="From founder to current heir."
      />

      {steps.length === 0 ? (
        <p className={styles.emptyState}>
          No succession line yet — name an heir to begin.
        </p>
      ) : (
        <div className={styles.line}>
          {steps.map((step, index) => (
            <div key={step.sim.id} className={styles.stepWrapper}>
              <div className={styles.step}>
                <PortraitAvatar
                  imageUrl={step.sim.imageUrl}
                  firstName={step.sim.firstName}
                  lastName={step.sim.lastName}
                  size={72}
                  ring={ringFor(step.sim)}
                />
                <span className={styles.stepName}>
                  {step.sim.firstName} {step.sim.lastName}
                </span>
                <span
                  className={styles.stepRole}
                  style={
                    step.isHeir
                      ? { color: 'var(--color-amber-700)' }
                      : undefined
                  }
                >
                  {step.role}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={styles.connector} aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
