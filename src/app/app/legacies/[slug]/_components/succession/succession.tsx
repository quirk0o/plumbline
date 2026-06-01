import {
  SectionHeading,
  PortraitAvatar,
  EmptyState,
  ButtonLink,
  GitBranchIcon,
  ArrowRightIcon,
} from '@/components/ui'
import { ringFor } from '../../lib/derive'
import type { SuccessionStep } from '../../lib/types'
import styles from './succession.module.css'

export interface SuccessionProps {
  steps: SuccessionStep[]
  slug: string
}

export function Succession({ steps, slug }: SuccessionProps) {
  return (
    <div className={styles.container}>
      <SectionHeading
        eyebrow="Inheritance"
        title="Succession line"
        blurb="From founder to current heir."
      />

      {steps.length === 0 ? (
        <EmptyState
          accent
          icon={<GitBranchIcon size={24} />}
          title={
            <>
              No succession to{' '}
              <em style={{ color: 'var(--amber-text)' }}>trace</em> yet.
            </>
          }
          action={
            <ButtonLink
              variant="primary"
              size="sm"
              href={`/app/legacies/${slug}/sims/new`}
            >
              Add your founder <ArrowRightIcon size={16} />
            </ButtonLink>
          }
        >
          Add your founder to begin — the line traces from them, founder to
          heir, down the generations.
        </EmptyState>
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
                  href={`/app/legacies/${slug}/sims/${step.sim.id}`}
                />
                <span className={styles.stepName}>
                  {step.sim.firstName} {step.sim.lastName}
                </span>
                <span
                  className={styles.stepRole}
                  style={
                    step.isHeir
                      ? { color: 'var(--amber-text)' }
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
