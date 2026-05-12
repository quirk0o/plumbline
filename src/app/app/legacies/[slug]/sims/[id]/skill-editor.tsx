'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/client'
import styles from './page.module.css'

interface SimProp {
  id: string
  skills: { skill: { id: string; name: string; maxLevel: number }; level: number }[]
}

export function SkillEditor({
  sim,
  allSkills,
}: {
  sim: SimProp
  allSkills: { id: string; name: string; maxLevel: number }[]
}) {
  const [localSkills, setLocalSkills] = useState(sim.skills)
  const addSkill = trpc.sims.addSkill.useMutation()
  const setLevel = trpc.sims.setSkillLevel.useMutation()
  const removeSkill = trpc.sims.removeSkill.useMutation()

  const trackedIds = new Set(localSkills.map((s) => s.skill.id))
  const available = allSkills.filter((s) => !trackedIds.has(s.id))

  function handleSetLevel(skillId: string, level: number) {
    const previousLevel = localSkills.find((s) => s.skill.id === skillId)?.level ?? level
    setLocalSkills((prev) =>
      prev.map((s) => (s.skill.id === skillId ? { ...s, level } : s)),
    )
    setLevel.mutate(
      { simId: sim.id, skillId, level },
      {
        onError: () =>
          setLocalSkills((prev) =>
            prev.map((s) =>
              s.skill.id === skillId ? { ...s, level: previousLevel } : s,
            ),
          ),
      },
    )
  }

  function handleAdd(skillId: string) {
    const skill = allSkills.find((s) => s.id === skillId)
    if (!skill) return
    setLocalSkills((prev) => [...prev, { skill, level: 1 }])
    addSkill.mutate(
      { simId: sim.id, skillId, level: 1 },
      { onError: () => setLocalSkills((prev) => prev.filter((s) => s.skill.id !== skillId)) },
    )
  }

  function handleRemove(skillId: string) {
    setLocalSkills((prev) => prev.filter((s) => s.skill.id !== skillId))
    removeSkill.mutate(
      { simId: sim.id, skillId },
      {
        onError: () => {
          const original = sim.skills.find((s) => s.skill.id === skillId)
          if (original) setLocalSkills((prev) => [...prev, original])
        },
      },
    )
  }

  return (
    <div>
      <div className={styles.skillList}>
        {localSkills.map(({ skill, level }) => (
          <div key={skill.id} className={styles.skillRow}>
            <span className={styles.skillName}>{skill.name}</span>
            <div className={styles.pipBar}>
              {Array.from({ length: skill.maxLevel }, (_, i) => (
                <button
                  key={i}
                  className={`${styles.pip} ${i < level ? styles.filled : ''}`}
                  aria-label={`Set ${skill.name} to level ${i + 1}`}
                  onClick={() => handleSetLevel(skill.id, i + 1)}
                />
              ))}
            </div>
            <button
              className={styles.removeBtn}
              aria-label={`Remove ${skill.name}`}
              onClick={() => handleRemove(skill.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {available.length > 0 && (
        <select
          className={styles.addChip}
          style={{ marginTop: '12px' }}
          value=""
          aria-label="Add skill"
          onChange={(e) => { if (e.target.value) handleAdd(e.target.value) }}
        >
          <option value="">+ Add skill</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}
