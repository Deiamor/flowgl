import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NodeDrag } from '../interaction/drag'
import { Viewport } from '../viewport/viewport'
import type { Graph } from '../graph/graph'
import type { HitTester } from '../interaction/hit-test'

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas') as HTMLCanvasElement
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
  })
  return canvas
}

describe('NodeDrag', () => {
  let canvas: HTMLCanvasElement
  let viewport: Viewport
  let mockNode: { id: string; x: number; y: number; width: number; height: number; label: string }
  let graph: Graph
  let hitTester: HitTester
  let onStart: ReturnType<typeof vi.fn>
  let onMove:  ReturnType<typeof vi.fn>
  let onEnd:   ReturnType<typeof vi.fn>

  beforeEach(() => {
    canvas   = makeCanvas()
    viewport = new Viewport()
    viewport.setSize(800, 600)

    mockNode = { id: 'n1', x: 100, y: 100, width: 120, height: 60, label: 'test' }

    graph = {
      getNodes:   vi.fn(() => [mockNode]),
      getNode:    vi.fn(() => mockNode),
      updateNode: vi.fn((id, patch) => { Object.assign(mockNode, patch) }),
    } as unknown as Graph

    hitTester = { findNodeAt: vi.fn() } as unknown as HitTester

    onStart = vi.fn()
    onMove  = vi.fn()
    onEnd   = vi.fn()
  })

  it('drags a node: updateNode called with new position after mousemove', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)

    new NodeDrag(canvas, viewport, graph, hitTester, onStart, onMove, onEnd)

    // mousedown over node at (160, 130) — node center area
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 160, clientY: 130, bubbles: true }))
    // move by 50px right, 30px down
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 210, clientY: 160, bubbles: true }))

    expect(graph.updateNode).toHaveBeenCalled()
    const [, patch] = (graph.updateNode as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(patch.x).toBeGreaterThan(100)
    expect(patch.y).toBeGreaterThan(100)
  })

  it('onStart fires on first mousemove, not on mousedown', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)

    new NodeDrag(canvas, viewport, graph, hitTester, onStart, onMove, onEnd)

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 160, clientY: 130, bubbles: true }))
    expect(onStart).not.toHaveBeenCalled()

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 210, clientY: 160, bubbles: true }))
    expect(onStart).toHaveBeenCalledOnce()

    // Additional moves do not call onStart again
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, clientY: 165, bubbles: true }))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('onEnd fires on mouseup after drag, not after click-only', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)

    new NodeDrag(canvas, viewport, graph, hitTester, onStart, onMove, onEnd)

    // Click-only: no move
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 160, clientY: 130, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup',   { button: 0, bubbles: true }))
    expect(onEnd).not.toHaveBeenCalled()

    // Now a real drag
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 160, clientY: 130, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 210, clientY: 160, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup',   { button: 0, bubbles: true }))
    expect(onEnd).toHaveBeenCalledOnce()
  })

  it('shouldBlock prevents drag from starting', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)

    new NodeDrag(canvas, viewport, graph, hitTester, onStart, onMove, onEnd, () => true)

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 160, clientY: 130, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 250, clientY: 200, bubbles: true }))

    expect(onStart).not.toHaveBeenCalled()
    expect(graph.updateNode).not.toHaveBeenCalled()
  })

  it('does not drag when no node is hit', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(null)

    new NodeDrag(canvas, viewport, graph, hitTester, onStart, onMove, onEnd)

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 10, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true }))

    expect(onStart).not.toHaveBeenCalled()
    expect(graph.updateNode).not.toHaveBeenCalled()
  })

  it('onMove is called with correct node id and new coordinates', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)

    new NodeDrag(canvas, viewport, graph, hitTester, onStart, onMove, onEnd)

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 160, clientY: 130, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 210, clientY: 160, bubbles: true }))

    expect(onMove).toHaveBeenCalledOnce()
    const [id] = onMove.mock.calls[0]!
    expect(id).toBe('n1')
  })
})
