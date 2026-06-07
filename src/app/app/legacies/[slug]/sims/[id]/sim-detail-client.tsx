'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CauseOfDeath, LifeStage } from '@prisma/client'
import type { Trait } from '@/app/components/trait-picker'
import { isLifeStageInRange } from '@/lib/life-stage'
import { IdentitySection } from './identity-section'
import { TraitEditor } from './trait-editor'
import { GoalsSection } from './goals-section'
import { SkillEditor } from './skill-editor'
import { RelationshipsEditor } from './relationships-editor'
import { FamilyTreeMini } from './family-tree-mini'
import { DeathSection } from './death-section'
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
    isHeir: boolean
    causeOfDeath: CauseOfDeath | null
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
  aspirations: { id: string; name: string; category: string; minLifeStage: LifeStage | null; maxLifeStage: LifeStage | null }[]
  careers: { id: string; name: string; type: string }[]
  skills: { id: string; name: string; maxLevel: number }[]
}

export function SimDetailClient({ sim, slug, legacySims, traits, aspirations, careers, skills }: Props) {
  const [currentLifeStage, setCurrentLifeStage] = useState<LifeStage>(sim.lifeStage as LifeStage)

  const visibleAspirations = aspirations.filter((a) =>
    isLifeStageInRange(currentLifeStage, a.minLifeStage, a.maxLifeStage)
  )

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

      <div className={styles.card}>
        <IdentitySection sim={sim} onLifeStageChange={setCurrentLifeStage} />

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>Personality Traits</h2>
            <div className={styles.sectionLine} />
          </div>
          <TraitEditor sim={sim} traits={traits} lifeStage={currentLifeStage} />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>Goals &amp; Career</h2>
            <div className={styles.sectionLine} />
          </div>
          <GoalsSection sim={sim} aspirations={visibleAspirations} careers={careers} />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>Skills</h2>
            <div className={styles.sectionLine} />
          </div>
          <SkillEditor sim={sim} allSkills={skills} />
        </section>

        <section className={styles.section} data-testid="relationships">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>Relationships</h2>
            <div className={styles.sectionLine} />
          </div>
          <RelationshipsEditor sim={sim} slug={slug} legacySims={legacySims} />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>Family Tree</h2>
            <div className={styles.sectionLine} />
          </div>
          <FamilyTreeMini simId={sim.id} />
        </section>

        <DeathSection simId={sim.id} initialCauseOfDeath={sim.causeOfDeath} />
      </div>
    </div>
  )
}
