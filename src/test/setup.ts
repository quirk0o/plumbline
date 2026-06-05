import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './msw-server'

// jsdom does not implement scrollIntoView; mock it so cmdk doesn't throw
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// jsdom does not implement ResizeObserver; mock it so cmdk doesn't throw
if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom does not implement matchMedia; Radix and reduced-motion checks touch it.
// Default to "no media query matches" (motion allowed, desktop).
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

// jsdom does not implement the Pointer Capture API; Radix Dialog's dismissable
// layer touches it. No-op it so modal tests don't throw.
if (typeof Element !== 'undefined' && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}

// @xyflow/react measures the viewport via DOMMatrixReadOnly and element
// offsets; jsdom implements neither. Minimal mocks per the React Flow
// testing guide (reactflow.dev/learn/advanced-use/testing).
if (typeof global.DOMMatrixReadOnly === 'undefined') {
  class DOMMatrixReadOnlyMock {
    m22: number
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1]
      this.m22 = scale === undefined ? 1 : +scale
    }
  }
  global.DOMMatrixReadOnly = DOMMatrixReadOnlyMock as unknown as typeof DOMMatrixReadOnly
}

if (typeof HTMLElement !== 'undefined') {
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: { configurable: true, get(this: HTMLElement) { return parseFloat(this.style.height) || 600 } },
    offsetWidth: { configurable: true, get(this: HTMLElement) { return parseFloat(this.style.width) || 800 } },
  })
}

if (typeof SVGElement !== 'undefined' && !('getBBox' in SVGElement.prototype)) {
  ;(SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () =>
    ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect
}

// d3-zoom (xyflow's pan/zoom pane) reads `event.view.document` on mousedown;
// user-event dispatches MouseEvents with view: null in jsdom. There is only
// one window in jsdom, so resolving view to it is always correct here.
// user-event defines `view` as a non-configurable instance own-property via
// Object.defineProperty returning null. We intercept Object.defineProperty
// on UIEvent instances so that a null `view` getter becomes window instead.
if (typeof window !== 'undefined' && typeof UIEvent !== 'undefined') {
  const _defineProperty = Object.defineProperty.bind(Object)
  Object.defineProperty = function <T>(
    obj: T,
    prop: PropertyKey,
    descriptor: PropertyDescriptor,
  ): T {
    if (
      prop === 'view' &&
      obj instanceof UIEvent &&
      typeof descriptor.get === 'function' &&
      descriptor.get() === null
    ) {
      return _defineProperty(obj, prop, {
        configurable: true,
        get() {
          return window
        },
      })
    }
    return _defineProperty(obj, prop, descriptor)
  } as typeof Object.defineProperty
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
