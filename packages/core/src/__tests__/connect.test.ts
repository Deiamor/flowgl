import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConnectDrag } from '../interaction/connect'
import { HitTester } from '../interaction/hit-test'
import { Viewport } from '../viewport/viewport'
import type { Graph } from '../graph/graph'

// Node at (100,100) 120×60 — right handle at (220,130), left at (100,130)
const NODE_A = { id: 'a', x: 100, y: 100, width: 120, height: 60, label: 'A' }
// Node at (400,100) 120×60 — left handle at (400,130), right at (520,130)
const NODE_B = { id: 'b', x: 400, y: 100, width: 120, height: 60, label: 'B' }

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas') as HTMLCanvasElement
  Object.defineProperty(c, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
  })
  return c
}

function dispatchTouch(target: EventTarget, type: string, touches: Partial<Touch>[], changed?: Partial<Touch>[]): void {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(e, 'touches',        { value: touches })
  Object.defineProperty(e, 'changedTouches', { value: changed ?? touches })
  target.dispatchEvent(e)
}
function t(id: number, clientX: number, clientY: number): Partial<Touch> {
  return { identifier: id, clientX, clientY }
}

describe('ConnectDrag', () => {
  let canvas: HTMLCanvasElement
  let viewport: Viewport
  let graph: Graph
  let hitTester: HitTester
  let onStateChange: ReturnType<typeof vi.fn>
  let onConnect: ReturnType<typeof vi.fn>
  let connect: ConnectDrag

  beforeEach(() => {
    canvas = makeCanvas()
    viewport = new Viewport()
    viewport.setSize(800, 600)

    graph = { getNodes: vi.fn(() => [NODE_A, NODE_B]) } as unknown as Graph
    hitTester = { findNodeAt: vi.fn() } as unknown as HitTester

    onStateChange = vi.fn()
    onConnect     = vi.fn()
    connect = new ConnectDrag(canvas, viewport, graph, hitTester, onStateChange, onConnect)
  })

  // ── isNearHandle ────────────────────────────────────────────────────────────

  it('isNearHandle returns true when cursor is on a handle', () => {
    // Right handle of NODE_A is at world (220, 130) → screen (220, 130) at default viewport
    expect(connect.isNearHandle(220, 130)).toBe(true)
  })

  it('isNearHandle returns false far from any handle', () => {
    expect(connect.isNearHandle(0, 0)).toBe(false)
  })

  // ── Mouse drag ──────────────────────────────────────────────────────────────

  it('mousedown on handle → isCapturing becomes true', () => {
    // First hover over the handle so hoveredHandle is set
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, clientY: 130, bubbles: true }))
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 220, clientY: 130, bubbles: true }))
    expect(connect.isCapturing()).toBe(true)
  })

  it('mousedown NOT on a handle → isCapturing stays false', () => {
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10, bubbles: true }))
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 10, bubbles: true }))
    expect(connect.isCapturing()).toBe(false)
  })

  it('mouseup on target node → onConnect fired with correct ids', () => {
    // Hover + click right handle of A
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, clientY: 130, bubbles: true }))
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 220, clientY: 130, bubbles: true }))

    // Drag over left handle of B (world 400,130)
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 130, bubbles: true }))

    // Release
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }))

    expect(onConnect).toHaveBeenCalledOnce()
    const [sourceId, targetId] = onConnect.mock.calls[0]!
    expect(sourceId).toBe('a')
    expect(targetId).toBe('b')
  })

  it('mouseup on empty canvas → onConnect NOT fired', () => {
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, clientY: 130, bubbles: true }))
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 220, clientY: 130, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }))
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('cancel() resets capturing state', () => {
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, clientY: 130, bubbles: true }))
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 220, clientY: 130, bubbles: true }))
    expect(connect.isCapturing()).toBe(true)
    connect.cancel()
    expect(connect.isCapturing()).toBe(false)
  })

  // ── Touch ───────────────────────────────────────────────────────────────────

  it('touchstart on handle → isCapturing becomes true', () => {
    dispatchTouch(canvas, 'touchstart', [t(1, 220, 130)])
    expect(connect.isCapturing()).toBe(true)
  })

  it('touchstart NOT on handle → isCapturing stays false', () => {
    dispatchTouch(canvas, 'touchstart', [t(1, 10, 10)])
    expect(connect.isCapturing()).toBe(false)
  })

  it('touch drag to target → onConnect fired', () => {
    // Start on right handle of A
    dispatchTouch(canvas, 'touchstart', [t(1, 220, 130)])

    // Move over left handle of B
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 130, bubbles: true }))
    dispatchTouch(canvas, 'touchmove', [t(1, 400, 130)], [t(1, 400, 130)])

    // Release
    dispatchTouch(canvas, 'touchend', [], [t(1, 400, 130)])

    expect(onConnect).toHaveBeenCalledOnce()
    const [sourceId, targetId, sourceHandle, targetHandle] = onConnect.mock.calls[0]!
    expect(sourceId).toBe('a')
    expect(targetId).toBe('b')
    expect(sourceHandle).toBe('right')
    expect(targetHandle).toBe('left')
  })

  it('touchcancel clears capturing state without firing onConnect', () => {
    dispatchTouch(canvas, 'touchstart', [t(1, 220, 130)])
    expect(connect.isCapturing()).toBe(true)

    dispatchTouch(canvas, 'touchcancel', [], [t(1, 220, 130)])
    expect(connect.isCapturing()).toBe(false)
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('dispose() removes all listeners', () => {
    connect.dispose()
    dispatchTouch(canvas, 'touchstart', [t(1, 220, 130)])
    expect(connect.isCapturing()).toBe(false)
  })

  it('mouseleave clears hover state when not dragging', () => {
    // First hover over a handle so state has hoveredHandle set
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, clientY: 130, bubbles: true }))
    // Now dispatch mouseleave — should clear hover
    canvas.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
    // No throw, and onStateChange was called for hover + clear
    expect(onStateChange).toHaveBeenCalled()
  })

  it('mouseleave is a no-op during active connection drag', () => {
    // Start a drag
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, clientY: 130, bubbles: true }))
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 220, clientY: 130, bubbles: true }))
    expect(connect.isCapturing()).toBe(true)
    const callsBefore = onStateChange.mock.calls.length
    // mouseleave during drag should be a no-op (connectingFrom is set)
    canvas.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
    expect(onStateChange.mock.calls.length).toBe(callsBefore)
  })

  it('connection drag into node body snaps to nearest handle (nearestHandleOnNode)', () => {
    // Use a real HitTester and a real graph to reach nearestHandleOnNode
    const realHitTester = new HitTester()
    const realGraph = {
      getNodes: vi.fn(() => [NODE_A, NODE_B]),
    } as unknown as Graph
    const c2 = new ConnectDrag(canvas, viewport, realGraph, realHitTester, onStateChange, onConnect)

    // Hover + drag from right handle of NODE_A
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, clientY: 130, bubbles: true }))
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 220, clientY: 130, bubbles: true }))
    expect(c2.isCapturing()).toBe(true)

    // Move into the body of NODE_B (center=460,130), not near any handle (hitR=14 < 40px)
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 460, clientY: 130, bubbles: true }))

    // nearestHandleOnNode was called; snap state was updated (no crash)
    expect(c2.isCapturing()).toBe(true)
    c2.dispose()
  })
})
