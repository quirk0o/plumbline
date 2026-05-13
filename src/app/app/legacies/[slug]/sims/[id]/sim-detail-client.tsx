'use client'

import Link from 'next/link'
import { CauseOfDeath } from '@prisma/client'
import { trpc } from '@/trpc/client'
import type { Trait } from '@/app/components/trait-picker'
import { IdentitySection } from './identity-section'
import { TraitEditor } from './trait-editor'
import { GoalsSection } from './goals-section'
import { SkillEditor } from './skill-editor'
import { FamilyEditor } from './family-editor'
import { SocialEditor } from './social-editor'
import styles from './page.module.css'

interface Props {
  sim: {
    id: string
    firstName: string
    lastName: string
    gender: string
    lifeStage: string
    pronounSubject: string | null
    pronounObject: string | null
    pronounPossessive: string | null
    imageUrl: string | null
    occultType: string | null
    causeOfDeath: string | null
    legacyId: string
    personalityTraits: { personalityTrait: { id: string; name: string } }[]
    aspirations: { aspiration: { id: string; name: string; category: string } }[]
    careers: { career: { id: string; name: string; type: string } | null }[]
    skills: { skill: { id: string; name: string; maxLevel: number }; level: number }[]
    parentsOf: { child: { id: string; firstName: string; lastName: string; imageUrl: string | null }; type: string }[]
    childOf: { parent: { id: string; firstName: string; lastName: string; imageUrl: string | null }; type: string }[]
    socialRelationshipsA: { simB: { id: string; firstName: string; lastName: string; imageUrl: string | null }; romanticStatus: string }[]
    socialRelationshipsB: { simA: { id: string; firstName: string; lastName: string; imageUrl: string | null }; romanticStatus: string }[]
  }
  slug: string
  legacySims: { id: string; firstName: string; lastName: string; imageUrl: string | null }[]
  traits: Trait[]
  aspirations: { id: string; name: string; category: string }[]
  careers: { id: string; name: string; type: string }[]
  skills: { id: string; name: string; maxLevel: number }[]
}

export function SimDetailClient({ sim, slug, legacySims, traits, aspirations, careers, skills }: Props) {
  const legacyName = slug
    .split('-')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ')

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href={`/app/legacies/${slug}`}>{legacyName}</Link>
        {' › '}
        <span aria-current="page">{sim.firstName} {sim.lastName}</span>
      </nav>

      <IdentitySection sim={sim} />

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Personality Traits</h2>
        <TraitEditor sim={sim} traits={traits} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Goals &amp; Career</h2>
        <GoalsSection sim={sim} aspirations={aspirations} careers={careers} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Skills</h2>
        <SkillEditor sim={sim} allSkills={skills} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Family</h2>
        <FamilyEditor sim={sim} slug={slug} legacySims={legacySims} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Social Relationships</h2>
        <SocialEditor sim={sim} slug={slug} legacySims={legacySims} />
      </section>

      {sim.causeOfDeath && <DeathSection sim={sim} />}
      {!sim.causeOfDeath && <MarkDeceasedButton simId={sim.id} />}
    </div>
  )
}

const CAUSE_OF_DEATH_OPTIONS: CauseOfDeath[] = [
  CauseOfDeath.OLD_AGE,
  CauseOfDeath.DROWNING,
  CauseOfDeath.FIRE,
  CauseOfDeath.ELECTROCUTION,
  CauseOfDeath.HUNGER,
  CauseOfDeath.OVEREXERTION,
  CauseOfDeath.EMBARRASSMENT,
  CauseOfDeath.ANGER,
  CauseOfDeath.LAUGHTER,
  CauseOfDeath.COWPLANT,
  CauseOfDeath.PUFFERFISH,
  CauseOfDeath.MURPHY_BED,
  CauseOfDeath.STEAM,
  CauseOfDeath.POISON,
  CauseOfDeath.METEOR,
]

function DeathSection({ sim }: { sim: Props['sim'] }) {
  const update = trpc.sims.update.useMutation()
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHeading}>Death</h2>
      <select
        className={styles.editableChip}
        defaultValue={sim.causeOfDeath ?? ''}
        aria-label="Cause of death"
        onChange={(e) =>
          update.mutate({ id: sim.id, causeOfDeath: e.target.value as CauseOfDeath })
        }
      >
        {CAUSE_OF_DEATH_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </section>
  )
}

function MarkDeceasedButton({ simId }: { simId: string }) {
  const update = trpc.sims.update.useMutation()
  return (
    <div className={styles.deathButton}>
      <button
        className={styles.addChip}
        onClick={() => update.mutate({ id: simId, causeOfDeath: CauseOfDeath.OLD_AGE })}
      >
        + Mark as deceased
      </button>
    </div>
  )
}
