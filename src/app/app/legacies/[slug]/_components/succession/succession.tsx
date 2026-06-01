import Link from 'next/link'
import {
  SectionHeading,
  PortraitAvatar,
  EmptyState,
  ButtonLink,
  GhostCircle,
  GitBranchIcon,
  ArrowRightIcon,
  UserPlusIcon,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { roman } from '@/lib/legacy-format'
import { ringFor } from '../../lib/derive'
import type { SuccessionStep } from '../../lib/types'
import styles from './succession.module.css'

export interface SuccessionProps {
  steps: SuccessionStep[]
  slug: string
}

export function Succession({ steps, slug }: SuccessionProps) {
  // "Page in progress": a founder exists but no heir is designated yet. Show a
  // trailing ghost slot prompting the user to name one (links to the roster,
  // where each sim's detail page carries the heir toggle).
  const needsHeir = !steps.some((step) => step.isHeir && !step.isFounder)
  const highestGen = steps.reduce<number | null>((max, step) => {
    const gen = step.sim.generationNumber
    if (gen === null) return max
    return max === null || gen > max ? gen : max
  }, null)
  const nextHeirLabel =
    highestGen !== null ? `Gen ${roman(highestGen + 1)}` : 'Next heir'

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

          {needsHeir && (
            <div className={styles.stepWrapper}>
              <div
                className={cn(styles.connector, styles.connectorDashed)}
                aria-hidden="true"
              />
              <Link href="#sims" className={styles.ghostStep}>
                <GhostCircle size={72} accent>
                  <UserPlusIcon size={20} />
                </GhostCircle>
                <span className={styles.ghostName}>Name an heir</span>
                <span className={styles.stepRole}>{nextHeirLabel}</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
