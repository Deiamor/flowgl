import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BoxSelect } from '../interaction/box-select'
import { Viewport } from '../viewport/viewport'

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas') as HTMLCanvasElement
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
  })
  return canvas
}

describe('BoxSelect', () => {
  let canvas: HTMLCanvasElement
  let viewport: Viewport
  let onSelect: ReturnType<typeof vi.fn>

  beforeEach(() => {
    canvas   = makeCanvas()
    viewport = new Viewport()
    viewport.setSize(800, 600)
    onSelect = vi.fn()
  })

  it('calls onSelect with world-space bounds after Shift+drag', () => {
    new BoxSelect(canvas, viewport, { shouldBlock: () => false, onSelect })

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, shiftKey: true, clientX: 100, clientY: 100, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup',   { clientX: 200, clientY: 200, bubbles: true }))

    expect(onSelect).toHaveBeenCalledOnce()
    const [minX, minY, maxX, maxY] = onSelect.mock.calls[0]!
    // At zoom=1, offset=0: world coords equal screen coords
    expect(minX).toBeCloseTo(100)
    expect(minY).toBeCloseTo(100)
    expect(maxX).toBeCloseTo(200)
    expect(maxY).toBeCloseTo(200)
  })

  it('does not call onSelect when no Shift key', () => {
    new BoxSelect(canvas, viewport, { shouldBlock: () => false, onSelect })

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, shiftKey: false, clientX: 100, clientY: 100, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup',   { clientX: 200, clientY: 200, bubbles: true }))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('does not call onSelect when shouldBlock returns true', () => {
    new BoxSelect(canvas, viewport, { shouldBlock: () => true, onSelect })

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, shiftKey: true, clientX: 100, clientY: 100, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup',   { clientX: 200, clientY: 200, bubbles: true }))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('does not call onSelect when drag distance is less than 4px', () => {
    new BoxSelect(canvas, viewport, { shouldBlock: () => false, onSelect })

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, shiftKey: true, clientX: 100, clientY: 100, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 103, clientY: 103, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup',   { clientX: 103, clientY: 103, bubbles: true }))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('calls onSelect when only one axis exceeds MIN_DRAG_PX', () => {
    new BoxSelect(canvas, viewport, { shouldBlock: () => false, onSelect })

    // dx=0, dy=10 — only vertical movement
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, shiftKey: true, clientX: 100, clientY: 100, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup',   { clientX: 100, clientY: 110, bubbles: true }))

    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('world bounds are correct with viewport panned', () => {
    viewport.pan(100, 50)  // viewport.x=100, viewport.y=50
    new BoxSelect(canvas, viewport, { shouldBlock: () => false, onSelect })

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, shiftKey: true, clientX: 100, clientY: 100, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup',   { clientX: 200, clientY: 200, bubbles: true }))

    expect(onSelect).toHaveBeenCalledOnce()
    const [minX, minY, maxX, maxY] = onSelect.mock.calls[0]!
    // screenToWorld: (sx - vp.x) / vp.zoom
    // (100 - 100) / 1 = 0, (200 - 100) / 1 = 100
    expect(minX).toBeCloseTo(0)
    expect(minY).toBeCloseTo(50)
    expect(maxX).toBeCloseTo(100)
    expect(maxY).toBeCloseTo(150)
  })

  it('isSelecting() returns true during active box select', () => {
    const boxSelect = new BoxSelect(canvas, viewport, { shouldBlock: () => false, onSelect })

    expect(boxSelect.isSelecting()).toBe(false)
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, shiftKey: true, clientX: 100, clientY: 100, bubbles: true }))
    expect(boxSelect.isSelecting()).toBe(true)
    window.dispatchEvent(new MouseEvent('mouseup',   { clientX: 200, clientY: 200, bubbles: true }))
    expect(boxSelect.isSelecting()).toBe(false)
  })

  it('dispose() prevents future events from firing', () => {
    const boxSelect = new BoxSelect(canvas, viewport, { shouldBlock: () => false, onSelect })
    boxSelect.dispose()

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, shiftKey: true, clientX: 100, clientY: 100, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup',   { clientX: 200, clientY: 200, bubbles: true }))

    expect(onSelect).not.toHaveBeenCalled()
  })
})
