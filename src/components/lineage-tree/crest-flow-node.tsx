'use client'
import { Handle, Position } from '@xyflow/react'
import { PortraitAvatar } from '@/components/ui'
import { Plumbob } from '@/components/plumbob'
import { formatLifeStage } from '@/lib/legacy-format'
import { cn } from '@/lib/utils'
import type { CrestNodeData } from './to-flow-graph'
import styles from './crest-flow-node.module.css'
import flowStyles from './lineage-flow.module.css'

/**
 * The Crest medallion as an HTML xyflow node (140×90 bbox). Hidden handles sit
 * at the CREST_ANCHORS offsets so edges join the medallion edge, never the
 * bbox corners: top target (descent), left target / right source (marriage).
 *
 * The xyflow `NodeProps` generic needs the full node type; we only consume
 * `data`, so the component takes just that — keeps it directly testable.
 */
export function CrestFlowNode({ data }: { data: CrestNodeData }) {
  const { sim, isFounder, isSelected, isDimmed, isFocused, onSelect, onNodeFocus } = data
  const fullName = `${sim.firstName} ${sim.lastName}`.trim()
  const lifeStageLabel = formatLifeStage(sim.lifeStage)
  const accessibleName = `${fullName}, ${lifeStageLabel}`
  const isAccent = isFounder || sim.isHeir

  const medallion = (
    <>
      {sim.isHeir && (
        <span className={styles.crown} data-testid="heir-crown" aria-hidden="true">
          <Plumbob size={12} />
        </span>
      )}
      <span className={cn(styles.medallion, isAccent && styles.medallionAccent, isSelected && styles.medallionSelected)}>
        <PortraitAvatar
          imageUrl={sim.imageUrl}
          firstName={sim.firstName}
          lastName={sim.lastName}
          size={38}
          ring={isFounder ? 'founder' : sim.isHeir ? 'heir' : 'green'}
        />
      </span>
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.name}>{fullName}</span>
      <span className={styles.stage} aria-hidden="true">
        {lifeStageLabel.toUpperCase()}
      </span>
    </>
  )

  return (
    <div className={styles.crest} data-tree-node data-dimmed={isDimmed ? '' : undefined}>
      <Handle type="target" id="top" position={Position.Top} className={flowStyles.handle} style={{ left: 70, top: 2 }} isConnectable={false} />
      <Handle type="target" id="left" position={Position.Left} className={flowStyles.handle} style={{ left: 48, top: 24 }} isConnectable={false} />
      <Handle type="source" id="right" position={Position.Right} className={flowStyles.handle} style={{ left: 92, top: 24 }} isConnectable={false} />
      <Handle type="source" id="bottom" position={Position.Bottom} className={flowStyles.handle} style={{ left: 70, top: 46 }} isConnectable={false} />
      {onSelect ? (
        <button
          type="button"
          className={styles.hit}
          aria-label={accessibleName}
          aria-current={isFocused ? 'location' : undefined}
          onClick={() => onSelect(sim.id)}
          onFocus={() => onNodeFocus?.(sim.id)}
        >
          {medallion}
        </button>
      ) : (
        <span className={styles.hit}>{medallion}</span>
      )}
    </div>
  )
}
