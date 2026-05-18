'use client'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { TreeSim } from './tree-utils'
import styles from './SimNode.module.css'

export type SimNodeType = Node<TreeSim, 'simNode'>

export function SimNode({ data }: NodeProps<SimNodeType>) {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const initials = `${data.firstName[0]}${data.lastName[0]}`

  function handleClick() {
    router.push(`/app/legacies/${params.slug}/sims/${data.id}`)
  }

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={`${styles.node} ${data.isFocused ? styles.focused : ''}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick()}
        aria-label={`${data.firstName} ${data.lastName}`}
      >
        <div className={styles.portrait}>
          {data.imageUrl ? (
            <Image
              src={data.imageUrl}
              alt={`${data.firstName} ${data.lastName}`}
              fill
              sizes="48px"
              className={styles.image}
            />
          ) : (
            <span className={styles.initials} aria-hidden="true">
              {initials}
            </span>
          )}
        </div>
        <span className={styles.name}>
          {data.firstName} {data.lastName}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  )
}
