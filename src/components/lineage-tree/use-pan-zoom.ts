'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 2

export type Transform = { x: number; y: number; scale: number }

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

/** Fit `content` (content px) into `viewport` (px), capped at 100%, centered. */
export function computeFit(
  viewport: { width: number; height: number },
  content: { width: number; height: number },
  padding = 32,
): Transform {
  if (content.width <= 0 || content.height <= 0) return { x: 0, y: 0, scale: 1 }
  const availW = Math.max(0, viewport.width - padding * 2)
  const availH = Math.max(0, viewport.height - padding * 2)
  const scale = Math.min(availW / content.width, availH / content.height, 1)
  return {
    scale,
    x: (viewport.width - content.width * scale) / 2,
    y: (viewport.height - content.height * scale) / 2,
  }
}

/** New transform after zooming toward a viewport-space point (px). */
export function zoomAtPoint(t: Transform, nextScaleRaw: number, px: number, py: number): Transform {
  const scale = clampZoom(nextScaleRaw)
  const ratio = scale / t.scale
  return { scale, x: px - (px - t.x) * ratio, y: py - (py - t.y) * ratio }
}

/**
 * Drag-to-pan + wheel-zoom + fit/step controls for an absolutely-sized content
 * box inside `surfaceRef`. Re-fits on mount, on content-size change, and on
 * window resize. Panning is suppressed when the press starts on a tree node
 * (`[data-tree-node]`) so node clicks still navigate.
 */
export function usePanZoom(
  surfaceRef: React.RefObject<HTMLElement | null>,
  contentWidth: number,
  contentHeight: number,
) {
  const [t, setT] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const drag = useRef<{ x: number; y: number } | null>(null)

  // Use ResizeObserver to react to both the initial mount (fires as a callback
  // when the element first gets its size) and any subsequent viewport resize.
  // setState inside a ResizeObserver callback is event-driven, satisfying
  // react-hooks/set-state-in-effect.
  // The observer is re-created whenever content dimensions change so that it
  // fires once with the current viewport size and the updated content size,
  // producing a fresh fit.
  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    const content = { width: contentWidth, height: contentHeight }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setT(computeFit({ width, height }, content))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [surfaceRef, contentWidth, contentHeight])

  // Native non-passive wheel listener so preventDefault works.
  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      setT((cur) => zoomAtPoint(cur, cur.scale * factor, e.clientX - rect.left, e.clientY - rect.top))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [surfaceRef])

  const fit = useCallback(() => {
    const el = surfaceRef.current
    if (!el) return
    setT(computeFit({ width: el.clientWidth, height: el.clientHeight }, { width: contentWidth, height: contentHeight }))
  }, [surfaceRef, contentWidth, contentHeight])

  const zoomBy = useCallback(
    (factor: number) => {
      const el = surfaceRef.current
      const width = el?.clientWidth ?? 0
      const height = el?.clientHeight ?? 0
      setT((cur) => zoomAtPoint(cur, cur.scale * factor, width / 2, height / 2))
    },
    [surfaceRef],
  )

  const zoomIn = useCallback(() => zoomBy(1.2), [zoomBy])
  const zoomOut = useCallback(() => zoomBy(1 / 1.2), [zoomBy])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-tree-node]')) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY }
    setIsPanning(true)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    setT((cur) => ({ ...cur, x: cur.x + dx, y: cur.y + dy }))
  }, [])

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    drag.current = null
    setIsPanning(false)
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // pointer capture may already be released; ignore.
    }
  }, [])

  return {
    transform: t,
    zoomPercent: Math.round(t.scale * 100),
    fit,
    zoomIn,
    zoomOut,
    isPanning,
    surfaceProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  }
}
