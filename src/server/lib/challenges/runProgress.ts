import { TRPCError } from '@trpc/server'
import type { Prisma, ValueKind } from '@prisma/client'
import { resolveThresholds, countThresholdsCrossed } from './trackerComputation'

export interface ProgressUpdate {
  value: boolean | number
  isComplete: boolean
}

/**
 * Compute the stored value and completion flag for a manual progress update,
 * from the tracker's value kind and goal config. Pure; throws BAD_REQUEST when
 * the input value's type doesn't match the kind or the THRESHOLD goal is invalid.
 *
 * - BOOLEAN: stored as-is; complete when true.
 * - THRESHOLD: stored as the count of thresholds crossed; complete when all are crossed.
 * - NUMERICAL: stored as-is; complete when it reaches the configured goalValue.
 */
export function computeProgressUpdate(
  valueKind: ValueKind,
  goalConfig: Prisma.JsonValue,
  inputValue: boolean | number,
): ProgressUpdate {
  if (valueKind === 'BOOLEAN') {
    return { value: inputValue, isComplete: inputValue === true }
  }

  if (valueKind === 'THRESHOLD') {
    if (typeof inputValue !== 'number') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'THRESHOLD tracker requires a numeric value' })
    }
    const thresholds = resolveThresholds(goalConfig)
    if (!thresholds) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'THRESHOLD tracker has no valid goalConfig' })
    }
    const value = countThresholdsCrossed(inputValue, thresholds)
    return { value, isComplete: value >= thresholds.length }
  }

  // NUMERICAL
  if (typeof inputValue !== 'number') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'NUMERICAL tracker requires a numeric value' })
  }
  const goalValue = (goalConfig as { goalValue?: number } | null)?.goalValue
  return { value: inputValue, isComplete: goalValue !== undefined && inputValue >= goalValue }
}

type RunWithPhases = {
  phases: Array<{ trackers: Array<{ progress: { completedAt: Date | null } | null }> }>
}

/**
 * Derive phase- and run-level completion for a loaded run. A phase is complete
 * when it has trackers and every one's progress is completed; the run is
 * complete when it has phases and all of them are complete.
 */
export function summarizeRun<T extends RunWithPhases>(run: T) {
  const phases = run.phases.map((phase) => ({
    ...phase,
    isComplete:
      phase.trackers.length > 0 && phase.trackers.every((t) => t.progress?.completedAt != null),
  }))
  return {
    ...run,
    phases,
    isComplete: phases.length > 0 && phases.every((p) => p.isComplete),
  }
}
