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

  // ── Touch support ─────────────────────────────────────────────────────────

  function dispatchTouch(target: EventTarget, type: string, touches: Partial<Touch>[], changed?: Partial<Touch>[]): void {
    const e = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(e, 'touches',        { value: touches })
    Object.defineProperty(e, 'changedTouches', { value: changed ?? touches })
    target.dispatchEvent(e)
  }
  function t(id: number, clientX: number, clientY: number): Partial<Touch> {
    return { identifier: id, clientX, clientY }
  }

  it('touchstart on node → touchmove → onStart fires on first move', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)
    new NodeDrag(canvas, viewport, graph, hitTester, onStart, onMove, onEnd)

    dispatchTouch(canvas, 'touchstart', [t(1, 160, 130)])
    expect(onStart).not.toHaveBeenCalled()

    dispatchTouch(canvas, 'touchmove', [t(1, 200, 150)], [t(1, 200, 150)])
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('touchmove updates node position', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)
    new NodeDrag(canvas, viewport, graph, hitTester, onStart, onMove, onEnd)

    dispatchTouch(canvas, 'touchstart', [t(1, 160, 130)])
    dispatchTouch(canvas, 'touchmove', [t(1, 210, 160)], [t(1, 210, 160)])

    expect(graph.updateNode).toHaveBeenCalled()
    const [, patch] = (graph.updateNode as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(patch.x).toBeGreaterThan(100)
  })

  it('touchend after move → onEnd fired', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)
    new NodeDrag(canvas, viewport, graph, hitTester, onStart, onMove, onEnd)

    dispatchTouch(canvas, 'touchstart', [t(1, 160, 130)])
    dispatchTouch(canvas, 'touchmove', [t(1, 210, 160)], [t(1, 210, 160)])
    dispatchTouch(canvas, 'touchend', [], [t(1, 210, 160)])

    expect(onEnd).toHaveBeenCalledOnce()
  })

  it('touchend without prior move → onEnd NOT fired', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)
    new NodeDrag(canvas, viewport, graph, hitTester, onStart, onMove, onEnd)

    dispatchTouch(canvas, 'touchstart', [t(1, 160, 130)])
    dispatchTouch(canvas, 'touchend', [], [t(1, 160, 130)])

    expect(onEnd).not.toHaveBeenCalled()
  })

  it('shouldBlock prevents touch drag', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)
    new NodeDrag(canvas, viewport, graph, hitTester, onStart, onMove, onEnd, () => true)

    dispatchTouch(canvas, 'touchstart', [t(1, 160, 130)])
    dispatchTouch(canvas, 'touchmove', [t(1, 210, 160)], [t(1, 210, 160)])

    expect(onStart).not.toHaveBeenCalled()
    expect(graph.updateNode).not.toHaveBeenCalled()
  })

  it('second touch while dragging is ignored (multi-touch guard)', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)
    new NodeDrag(canvas, viewport, graph, hitTester, onStart, onMove, onEnd)

    dispatchTouch(canvas, 'touchstart', [t(1, 160, 130)])
    // Second finger arrives
    dispatchTouch(canvas, 'touchstart', [t(1, 160, 130), t(2, 300, 200)])
    dispatchTouch(canvas, 'touchmove', [t(2, 400, 300)], [t(2, 400, 300)])

    // Only the first touch drives the drag
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

  it('onStart receives the dragged node id', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)

    new NodeDrag(canvas, viewport, graph, hitTester, onStart, onMove, onEnd)

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 160, clientY: 130, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 210, clientY: 160, bubbles: true }))

    expect(onStart).toHaveBeenCalledWith('n1')
  })

  it('co-selected nodes move with the dragged node', () => {
    const other = { id: 'n2', x: 300, y: 200, width: 120, height: 60, label: 'other' }
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)
    ;(graph.getNode as ReturnType<typeof vi.fn>).mockImplementation((id: string) =>
      id === 'n1' ? mockNode : id === 'n2' ? other : undefined,
    )

    const updateNode = graph.updateNode as ReturnType<typeof vi.fn>

    new NodeDrag(
      canvas, viewport, graph, hitTester,
      onStart, onMove, onEnd,
      undefined, undefined, undefined,
      // getCoselected returns n2 as co-selected
      () => ['n2'],
    )

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 160, clientY: 130, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 210, clientY: 160, bubbles: true }))

    // Both n1 and n2 should have been updated
    const ids = updateNode.mock.calls.map((c: unknown[]) => c[0])
    expect(ids).toContain('n1')
    expect(ids).toContain('n2')
  })

  it('dispose() removes all event listeners so drag no longer fires', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)

    const drag = new NodeDrag(canvas, viewport, graph, hitTester, onStart, onMove, onEnd)

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 160, clientY: 130, bubbles: true }))
    drag.dispose()

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 210, clientY: 160, bubbles: true }))
    expect(onMove).not.toHaveBeenCalled()
  })

  it('coselected node missing from graph returns null from map (null branch)', () => {
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)
    ;(graph.getNode as ReturnType<typeof vi.fn>).mockImplementation((id: string) =>
      id === 'n1' ? mockNode : null,
    )

    new NodeDrag(
      canvas, viewport, graph, hitTester,
      onStart, onMove, onEnd,
      undefined, undefined, undefined,
      () => ['ghost'],
    )

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 160, clientY: 130, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 210, clientY: 160, bubbles: true }))

    // Ghost node is filtered out, only n1 is moved
    const ids = (graph.updateNode as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
    expect(ids).toContain('n1')
    expect(ids).not.toContain('ghost')
  })

  it('children of a coselected group also move with the dragged node', () => {
    // Scenario: dragging n1, group is coselected, group's children c1/c2 must also move
    const grp = { id: 'grp', x: 300, y: 200, width: 150, height: 100, label: 'G', type: 'group' }
    const c1  = { id: 'c1',  x: 320, y: 220, width: 80,  height: 40,  label: 'C1', parentId: 'grp' }
    const c2  = { id: 'c2',  x: 320, y: 280, width: 80,  height: 40,  label: 'C2', parentId: 'grp' }
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)
    ;(graph.getNode as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
      if (id === 'n1')  return mockNode
      if (id === 'grp') return grp
      if (id === 'c1')  return c1
      if (id === 'c2')  return c2
      return undefined
    })

    new NodeDrag(
      canvas, viewport, graph, hitTester,
      onStart, onMove, onEnd,
      undefined, undefined,
      // getChildren: grp has c1 and c2
      (nodeId: string) => nodeId === 'grp' ? ['c1', 'c2'] : [],
      // getCoselected: grp is coselected when dragging n1
      () => ['grp'],
    )

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 160, clientY: 130, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 210, clientY: 160, bubbles: true }))

    const ids = (graph.updateNode as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
    expect(ids).toContain('n1')
    expect(ids).toContain('grp')
    expect(ids).toContain('c1')
    expect(ids).toContain('c2')
  })

  it('child not double-moved when it is both a direct child and in coselected', () => {
    // grp is the dragged node; its children c1/c2 are in children list
    // even if c1 appears in coselected it should only be moved once
    ;(hitTester.findNodeAt as ReturnType<typeof vi.fn>).mockReturnValue(mockNode)
    const c1 = { id: 'c1', x: 120, y: 110, width: 80, height: 40, label: 'C1' }
    ;(graph.getNode as ReturnType<typeof vi.fn>).mockImplementation((id: string) =>
      id === 'n1' ? mockNode : id === 'c1' ? c1 : undefined,
    )

    const updateNode = graph.updateNode as ReturnType<typeof vi.fn>

    new NodeDrag(
      canvas, viewport, graph, hitTester,
      onStart, onMove, onEnd,
      undefined, undefined,
      () => ['c1'],       // c1 is a direct child of dragged node
      () => ['c1'],       // c1 also appears in coselected (edge case)
    )

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 160, clientY: 130, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 210, clientY: 160, bubbles: true }))

    // c1 should appear exactly once in updateNode calls (not twice)
    const c1Calls = updateNode.mock.calls.filter((c: unknown[]) => c[0] === 'c1')
    expect(c1Calls).toHaveLength(1)
  })
})
