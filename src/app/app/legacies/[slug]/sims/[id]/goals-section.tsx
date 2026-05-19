'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/client'
import { Combobox } from '@/components/ui'
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

  const [aspirationId, setAspirationId] = useState(currentAspiration?.id ?? '')
  const [careerId, setCareerId] = useState(currentCareer?.id ?? '')

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
        <Combobox
          value={aspirationId}
          onChange={(v) => {
            setAspirationId(v)
            update.mutate({ id: sim.id, aspirationId: v || null })
          }}
          placeholder="None"
          aria-label="Aspiration"
        >
          <Combobox.Item value="">None</Combobox.Item>
          {Object.entries(aspirationsByCategory).map(([cat, items]) => (
            <Combobox.Section key={cat} heading={cat}>
              {items.map((a) => (
                <Combobox.Item key={a.id} value={a.id}>{a.name}</Combobox.Item>
              ))}
            </Combobox.Section>
          ))}
        </Combobox>
      </div>

      <div>
        <span className={styles.fieldLabel}>Career</span>
        <Combobox
          value={careerId}
          onChange={(v) => {
            setCareerId(v)
            update.mutate({ id: sim.id, careerId: v || null })
          }}
          placeholder="None"
          aria-label="Career"
        >
          <Combobox.Item value="">None</Combobox.Item>
          {Object.entries(careersByType).map(([type, items]) => (
            <Combobox.Section key={type} heading={type}>
              {items.map((c) => (
                <Combobox.Item key={c.id} value={c.id}>{c.name}</Combobox.Item>
              ))}
            </Combobox.Section>
          ))}
        </Combobox>
      </div>
    </div>
  )
}
