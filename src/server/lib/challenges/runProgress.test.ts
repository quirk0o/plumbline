import { describe, it, expect } from 'vitest'
import { ValueKind } from '@prisma/client'
import { computeProgressUpdate } from './runProgress'

describe('computeProgressUpdate', () => {
  it('BOOLEAN: stores the value and is complete only when true', () => {
    expect(computeProgressUpdate(ValueKind.BOOLEAN, null, true)).toEqual({ value: true, isComplete: true })
    expect(computeProgressUpdate(ValueKind.BOOLEAN, null, false)).toEqual({ value: false, isComplete: false })
  })

  it('THRESHOLD: stores the count crossed and is complete only when all are crossed', () => {
    const goal = { thresholds: [10, 20, 30] }
    expect(computeProgressUpdate(ValueKind.THRESHOLD, goal, 25)).toEqual({ value: 2, isComplete: false })
    expect(computeProgressUpdate(ValueKind.THRESHOLD, goal, 30)).toEqual({ value: 3, isComplete: true })
    expect(computeProgressUpdate(ValueKind.THRESHOLD, goal, 5)).toEqual({ value: 0, isComplete: false })
  })

  it('THRESHOLD: rejects a non-numeric value', () => {
    expect(() => computeProgressUpdate(ValueKind.THRESHOLD, { thresholds: [1] }, true)).toThrow(
      'THRESHOLD tracker requires a numeric value',
    )
  })

  it('THRESHOLD: rejects an invalid goalConfig', () => {
    expect(() => computeProgressUpdate(ValueKind.THRESHOLD, null, 5)).toThrow(
      'THRESHOLD tracker has no valid goalConfig',
    )
  })

  it('NUMERICAL: stores the value and is complete when it reaches goalValue', () => {
    const goal = { goalValue: 100 }
    expect(computeProgressUpdate(ValueKind.NUMERICAL, goal, 50)).toEqual({ value: 50, isComplete: false })
    expect(computeProgressUpdate(ValueKind.NUMERICAL, goal, 100)).toEqual({ value: 100, isComplete: true })
    expect(computeProgressUpdate(ValueKind.NUMERICAL, goal, 150)).toEqual({ value: 150, isComplete: true })
  })

  it('NUMERICAL: with no goalValue, never completes', () => {
    expect(computeProgressUpdate(ValueKind.NUMERICAL, {}, 9999)).toEqual({ value: 9999, isComplete: false })
  })

  it('NUMERICAL: rejects a non-numeric value', () => {
    expect(() => computeProgressUpdate(ValueKind.NUMERICAL, { goalValue: 1 }, true)).toThrow(
      'NUMERICAL tracker requires a numeric value',
    )
  })
})
