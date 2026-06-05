import type { FitViewOptions } from '@xyflow/react'

/** Fit-to-viewport capped at 100%; minZoom below the interactive floor so
 *  very large trees can still be fully overviewed (parity with the old
 *  computeFit, which had no floor). */
export const FIT_VIEW_OPTIONS: FitViewOptions = { maxZoom: 1, minZoom: 0.05, padding: 0.08 }
export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 2
