'use client'

import { trpc } from '@/trpc/client'
import styles from './page.module.css'

interface SimProp {
  id: string
  aspirations: { aspiration: { id: string; name: string; category: string } }[]
  careers: { career: { id: string; name: string; type: string } | null }[]
}

export function GoalsSection({
  sim,
  aspirations,
  careers,
}: {
  sim: SimProp
  aspirations: { id: string; name: string; category: string }[]
  careers: { id: string; name: string; type: string }[]
}) {
  const update = trpc.sims.update.useMutation()
  const currentAspiration = sim.aspirations[0]?.aspiration
  const currentCareer = sim.careers.find((c) => c.career)?.career

  const aspirationsByCategory = aspirations.reduce<Record<string, typeof aspirations>>((acc, a) => {
    ;(acc[a.category] ??= []).push(a)
    return acc
  }, {})

  const careersByType = careers.reduce<Record<string, typeof careers>>((acc, c) => {
    ;(acc[c.type] ??= []).push(c)
    return acc
  }, {})

  return (
    <div className={styles.twoCol}>
      <div>
        <span className={styles.fieldLabel}>Aspiration</span>
        <select
          className={styles.goalSelect}
          defaultValue={currentAspiration?.id ?? ''}
          aria-label="Aspiration"
          onChange={(e) =>
            update.mutate({ id: sim.id, aspirationId: e.target.value || null })
          }
        >
          <option value="">None</option>
          {Object.entries(aspirationsByCategory).map(([cat, items]) => (
            <optgroup key={cat} label={cat}>
              {items.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <span className={styles.fieldLabel}>Career</span>
        <select
          className={styles.goalSelect}
          defaultValue={currentCareer?.id ?? ''}
          aria-label="Career"
          onChange={(e) =>
            update.mutate({ id: sim.id, careerId: e.target.value || null })
          }
        >
          <option value="">None</option>
          {Object.entries(careersByType).map(([type, items]) => (
            <optgroup key={type} label={type}>
              {items.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  )
}
