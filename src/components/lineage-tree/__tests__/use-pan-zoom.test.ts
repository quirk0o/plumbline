import { describe, it, expect } from 'vitest'
import { clampZoom, computeFit, zoomAtPoint, MIN_ZOOM, MAX_ZOOM } from '../use-pan-zoom'

describe('clampZoom', () => {
  it('clamps to [MIN_ZOOM, MAX_ZOOM]', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
    expect(clampZoom(1)).toBe(1)
  })
})

describe('computeFit', () => {
  it('never upscales past 100% and centers a small content', () => {
    const t = computeFit({ width: 1000, height: 1000 }, { width: 200, height: 100 }, 32)
    expect(t.scale).toBe(1)
    expect(t.x).toBe((1000 - 200) / 2)
    expect(t.y).toBe((1000 - 100) / 2)
  })

  it('scales down to fit a large content', () => {
    const t = computeFit({ width: 1000, height: 1000 }, { width: 2000, height: 500 }, 32)
    expect(t.scale).toBeCloseTo((1000 - 64) / 2000, 5)
    expect(t.x).toBeCloseTo(32, 5)
    expect(t.y).toBeCloseTo(383, 5)
  })

  it('returns identity for empty content', () => {
    expect(computeFit({ width: 1000, height: 1000 }, { width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
      scale: 1,
    })
  })
})

describe('zoomAtPoint', () => {
  it('keeps the focal point stationary while zooming', () => {
    const next = zoomAtPoint({ x: 0, y: 0, scale: 1 }, 2, 100, 100)
    expect(next.scale).toBe(2)
    const contentXAfter = (100 - next.x) / next.scale
    expect(contentXAfter).toBeCloseTo(100, 5)
  })

  it('clamps the zoom', () => {
    expect(zoomAtPoint({ x: 0, y: 0, scale: 1 }, 999, 0, 0).scale).toBe(MAX_ZOOM)
  })
})
