import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PanZoom } from '../interaction/pan-zoom'
import { Viewport } from '../viewport/viewport'

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas') as HTMLCanvasElement
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
  })
  return canvas
}

describe('PanZoom', () => {
  let canvas: HTMLCanvasElement
  let viewport: Viewport
  let onUpdate: ReturnType<typeof vi.fn>
  let panZoom: PanZoom

  beforeEach(() => {
    canvas   = makeCanvas()
    viewport = new Viewport()
    viewport.setSize(800, 600)
    onUpdate = vi.fn()
    panZoom  = new PanZoom(canvas, viewport, onUpdate)
  })

  it('pans the viewport when mouse is dragged', () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 100, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 120, bubbles: true }))

    expect(viewport.x).toBe(50)
    expect(viewport.y).toBe(20)
    expect(onUpdate).toHaveBeenCalled()
  })

  it('pans accumulate over multiple moves', () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 0, clientY: 0, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 0, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 0, bubbles: true }))

    expect(viewport.x).toBe(20)
  })

  it('stops panning after mouseup', () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 0, clientY: 0, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 0, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup',   { button: 0, bubbles: true }))
    const xAfterUp = viewport.x

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 0, bubbles: true }))
    expect(viewport.x).toBe(xAfterUp)
  })

  it('zooms in when wheel scrolls up (deltaY negative)', () => {
    const initialZoom = viewport.zoom
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 400, clientY: 300, bubbles: true }))
    expect(viewport.zoom).toBeGreaterThan(initialZoom)
    expect(onUpdate).toHaveBeenCalled()
  })

  it('zooms out when wheel scrolls down (deltaY positive)', () => {
    const initialZoom = viewport.zoom
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, clientX: 400, clientY: 300, bubbles: true }))
    expect(viewport.zoom).toBeLessThan(initialZoom)
  })

  it('does not pan when shouldBlock returns true', () => {
    // Dispose the default panZoom first so it does not process the events
    panZoom.dispose()
    const blockingPanZoom = new PanZoom(canvas, viewport, onUpdate, () => true)

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 100, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }))

    expect(viewport.x).toBe(0)
    expect(viewport.y).toBe(0)
    blockingPanZoom.dispose()
  })

  it('does not pan on right mouse button', () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2, clientX: 100, clientY: 100, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }))

    expect(viewport.x).toBe(0)
    expect(viewport.y).toBe(0)
  })

  // ── Touch ─────────────────────────────────────────────────────────────────

  function dispatchTouch(target: EventTarget, type: string, touches: Partial<Touch>[], changed?: Partial<Touch>[]): void {
    const e = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(e, 'touches',        { value: touches })
    Object.defineProperty(e, 'changedTouches', { value: changed ?? touches })
    target.dispatchEvent(e)
  }
  function t(clientX: number, clientY: number): Partial<Touch> {
    return { identifier: 1, clientX, clientY }
  }

  it('1-finger touch pans the viewport', () => {
    dispatchTouch(canvas, 'touchstart', [t(100, 100)])
    dispatchTouch(canvas, 'touchmove', [t(150, 120)], [t(150, 120)])

    expect(viewport.x).toBe(50)
    expect(viewport.y).toBe(20)
    expect(onUpdate).toHaveBeenCalled()
  })

  it('shouldBlock prevents 1-finger touch pan', () => {
    panZoom.dispose()
    const blocked = new PanZoom(canvas, viewport, onUpdate, () => true)

    dispatchTouch(canvas, 'touchstart', [t(100, 100)])
    dispatchTouch(canvas, 'touchmove', [t(200, 200)], [t(200, 200)])

    expect(viewport.x).toBe(0)
    expect(viewport.y).toBe(0)
    blocked.dispose()
  })

  it('dispose() removes all listeners', () => {
    panZoom.dispose()
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 0, clientY: 0, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 0, bubbles: true }))

    expect(viewport.x).toBe(0)
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
