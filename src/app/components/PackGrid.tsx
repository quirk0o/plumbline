'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { PackType } from '@prisma/client'
import { trpc } from '@/trpc/client'
import type { RouterOutputs } from '@/trpc/client'
import styles from './PackGrid.module.css'

type PackGroups = RouterOutputs['packs']['getAll']

const SECTION_LABELS: Record<PackType, string> = {
  [PackType.BASE_GAME]: 'Base Game',
  [PackType.EXPANSION]: 'Expansion Packs',
  [PackType.GAME_PACK]: 'Game Packs',
  [PackType.STUFF_PACK]: 'Stuff Packs',
  [PackType.KIT]: 'Kits',
}

const COVER_GRADIENTS: Record<PackType, string> = {
  [PackType.BASE_GAME]: 'linear-gradient(135deg, #0e2018, #162e22)',
  [PackType.EXPANSION]: 'linear-gradient(135deg, #0e2018, #162e22)',
  [PackType.GAME_PACK]: 'linear-gradient(135deg, #1e120a, #221508)',
  [PackType.STUFF_PACK]: 'linear-gradient(135deg, #14101e, #180e22)',
  [PackType.KIT]: 'linear-gradient(135deg, #1e100e, #221210)',
}

function badgeClass(type: PackType): string {
  switch (type) {
    case PackType.EXPANSION:  return styles.badgeExpansion
    case PackType.GAME_PACK:  return styles.badgeGamePack
    case PackType.STUFF_PACK: return styles.badgeStuffPack
    case PackType.KIT:        return styles.badgeKit
    default: return styles.badgeExpansion
  }
}

interface PackGridProps {
  initialGroups: PackGroups
}

export function PackGrid({ initialGroups }: PackGridProps) {
  const [showSaved, setShowSaved] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const utils = trpc.useUtils()

  const { data: groups } = trpc.packs.getAll.useQuery(undefined, {
    initialData: initialGroups,
    staleTime: 30_000,
  })

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const toggleMutation = trpc.packs.toggle.useMutation({
    onMutate: async ({ packId }) => {
      await utils.packs.getAll.cancel()
      const previousGroups = utils.packs.getAll.getData()
      utils.packs.getAll.setData(undefined, prev =>
        prev?.map(g => ({
          ...g,
          packs: g.packs.map(p =>
            p.id === packId ? { ...p, isOwned: !p.isOwned } : p
          ),
        }))
      )
      return { previousGroups }
    },
    onSuccess: () => {
      if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current)
      setShowSaved(true)
      savedTimerRef.current = setTimeout(() => {
        setShowSaved(false)
        savedTimerRef.current = null
      }, 1500)
    },
    onError: (_err, _variables, context) => {
      if (context?.previousGroups !== undefined) {
        utils.packs.getAll.setData(undefined, context.previousGroups)
      }
    },
    onSettled: () => {
      utils.packs.getAll.invalidate()
    },
  })

  const totalOwned = groups.reduce((sum, g) => sum + g.packs.filter(p => p.isOwned).length, 0)

  return (
    <div className={styles.root}>
      <div className={styles.meta}>
        <span className={styles.count}>{totalOwned} pack{totalOwned !== 1 ? 's' : ''} selected</span>
        <span className={`${styles.savedTag} ${showSaved ? styles.savedTagVisible : ''}`}>· saved</span>
      </div>

      {groups.map(group => (
        <section key={group.type} className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>{SECTION_LABELS[group.type]}</span>
            <span className={styles.sectionCount}>{group.packs.length}</span>
          </div>
          <div className={styles.grid}>
            {group.packs.map(pack => (
              <button
                key={pack.id}
                className={`${styles.card} ${pack.isOwned ? styles.cardOwned : ''}`}
                onClick={() => toggleMutation.mutate({ packId: pack.id })}
                aria-pressed={pack.isOwned}
                aria-label={`${pack.name} — ${pack.isOwned ? 'owned' : 'not owned'}`}
              >
                {pack.isOwned && (
                  <span className={`${styles.badge} ${badgeClass(pack.type)}`} aria-hidden>✓</span>
                )}
                <div
                  className={`${styles.cover} ${!pack.isOwned ? styles.coverDimmed : ''}`}
                  style={{ background: COVER_GRADIENTS[pack.type] }}
                >
                  {pack.imageUrl ? (
                    <Image
                      src={pack.imageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 600px) 80px, 120px"
                      className={styles.coverImage}
                    />
                  ) : null}
                  <span className={styles.coverEmoji} aria-hidden>{pack.icon ?? '📦'}</span>
                </div>
                <div className={styles.footer}>
                  <div className={`${styles.name} ${!pack.isOwned ? styles.nameDimmed : ''}`}>
                    {pack.name}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
