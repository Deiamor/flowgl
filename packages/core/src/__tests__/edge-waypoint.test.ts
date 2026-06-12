import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EdgeWaypoint } from '../interaction/edge-waypoint'
import { Viewport } from '../viewport/viewport'
import { Graph } from '../graph/graph'
import type { NodeData } from '../graph/node'

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas') as HTMLCanvasElement
  Object.defineProperty(c, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
  })
  return c
}

const nd = (id: string, x: number, y: number, w = 100, h = 50): NodeData => ({
  id, label: id, x, y, width: w, height: h,
})

describe('EdgeWaypoint', () => {
  let canvas:   HTMLCanvasElement
  let viewport: Viewport
  let graph:    Graph
  let selectedEdgeIds: Set<string>
  let onChange: ReturnType<typeof vi.fn>
  let ew:       EdgeWaypoint

  beforeEach(() => {
    canvas   = makeCanvas()
    viewport = new Viewport()
    viewport.setSize(800, 600)
    graph    = new Graph()
    graph.addNode(nd('a', 0, 0))
    graph.addNode(nd('b', 200, 0))
    graph.addEdge({ id: 'e1', source: 'a', target: 'b' })

    selectedEdgeIds = new Set(['e1'])
    onChange        = vi.fn()

    ew = new EdgeWaypoint(canvas, viewport, graph, () => selectedEdgeIds, onChange)
  })

  it('constructs without throwing', () => {
    expect(ew).toBeDefined()
  })

  it('isCapturing() returns false initially', () => {
    expect(ew.isCapturing()).toBe(false)
  })

  it('getWaypointHandles() returns empty for edge with no waypoints but includes midpoints', () => {
    const handles = ew.getWaypointHandles()
    // No real waypoints, but midpoints are included (isMid: true)
    const mids = handles.filter(h => h.isMid)
    expect(mids.length).toBeGreaterThan(0)
  })

  it('getWaypointHandles() returns waypoint handles when edge has waypoints', () => {
    graph.updateEdge('e1', { waypoints: [{ x: 150, y: 25 }] })
    const handles = ew.getWaypointHandles()
    const real = handles.filter(h => !h.isMid)
    expect(real).toHaveLength(1)
    expect(real[0]!.wx).toBe(150)
    expect(real[0]!.wy).toBe(25)
    expect(real[0]!.edgeId).toBe('e1')
  })

  it('getWaypointHandles() skips edge not in graph', () => {
    selectedEdgeIds.clear()
    selectedEdgeIds.add('ghost')
    expect(ew.getWaypointHandles()).toHaveLength(0)
  })

  it('getWaypointHandles() returns empty when no edges selected', () => {
    selectedEdgeIds.clear()
    expect(ew.getWaypointHandles()).toHaveLength(0)
  })

  it('getWaypointHandles() skips edge with missing node', () => {
    graph.removeNode('b')
    const handles = ew.getWaypointHandles()
    // With missing node, getEdgeMidpoints returns [] so no mids
    const mids = handles.filter(h => h.isMid)
    expect(mids).toHaveLength(0)
  })

  it('removeWaypointAt() returns false when edge has no waypoints', () => {
    expect(ew.removeWaypointAt('e1', 150, 25)).toBe(false)
  })

  it('removeWaypointAt() returns false for unknown edge', () => {
    expect(ew.removeWaypointAt('ghost', 0, 0)).toBe(false)
  })

  it('removeWaypointAt() removes waypoint within hit radius', () => {
    graph.updateEdge('e1', { waypoints: [{ x: 150, y: 25 }] })
    const removed = ew.removeWaypointAt('e1', 150, 25)
    expect(removed).toBe(true)
    expect(onChange).toHaveBeenCalledOnce()
    const edge = graph.getEdge('e1')!
    expect(edge.waypoints).toHaveLength(0)
  })

  it('removeWaypointAt() returns false when point is far from any waypoint', () => {
    graph.updateEdge('e1', { waypoints: [{ x: 150, y: 25 }] })
    expect(ew.removeWaypointAt('e1', 500, 500)).toBe(false)
  })

  it('removeWaypointAt() removes the correct waypoint among multiple', () => {
    graph.updateEdge('e1', { waypoints: [{ x: 100, y: 10 }, { x: 200, y: 20 }, { x: 300, y: 30 }] })
    ew.removeWaypointAt('e1', 200, 20)
    const edge = graph.getEdge('e1')!
    expect(edge.waypoints).toHaveLength(2)
    expect(edge.waypoints![0]).toEqual({ x: 100, y: 10 })
    expect(edge.waypoints![1]).toEqual({ x: 300, y: 30 })
  })

  it('mousedown on midpoint inserts new waypoint and starts drag', () => {
    // 0.8.1: source defaults to 'right', target defaults to 'left' (aligned
    // with both renderers). a.right=(100,25), b.left=(200,25).
    // Geometric midpoint: ((100+200)/2, 25) = (150, 25).
    // MIDPOINT_HIT_PX=8, zoom=1 → midR=8; click at (150,25) → distance=0.
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 150, clientY: 25, bubbles: true,
    }))
    expect(ew.isCapturing()).toBe(true)
    const edge = graph.getEdge('e1')!
    expect(edge.waypoints).toHaveLength(1)
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('mousedown on existing waypoint starts drag without inserting', () => {
    graph.updateEdge('e1', { waypoints: [{ x: 150, y: 25 }] })
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 150, clientY: 25, bubbles: true,
    }))
    expect(ew.isCapturing()).toBe(true)
    const edge = graph.getEdge('e1')!
    // Still only one waypoint (no new insertion)
    expect(edge.waypoints).toHaveLength(1)
  })

  it('mousedown far from any waypoint or midpoint does nothing', () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 400, clientY: 400, bubbles: true,
    }))
    expect(ew.isCapturing()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('right button mousedown is ignored', () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 2, clientX: 150, clientY: 25, bubbles: true,
    }))
    expect(ew.isCapturing()).toBe(false)
  })

  it('mousedown when no edges selected does nothing', () => {
    selectedEdgeIds.clear()
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 150, clientY: 25, bubbles: true,
    }))
    expect(ew.isCapturing()).toBe(false)
  })

  it('mousemove during drag moves the waypoint', () => {
    graph.updateEdge('e1', { waypoints: [{ x: 150, y: 25 }] })
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 150, clientY: 25, bubbles: true,
    }))
    expect(ew.isCapturing()).toBe(true)

    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 160, clientY: 30, bubbles: true,
    }))
    const edge = graph.getEdge('e1')!
    expect(edge.waypoints![0]!.x).toBe(160)
    expect(edge.waypoints![0]!.y).toBe(30)
    expect(onChange).toHaveBeenCalledOnce() // called on mousemove only; mousedown on existing waypoint does not fire onChange
  })

  it('mousemove without drag is a no-op', () => {
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 160, clientY: 30, bubbles: true,
    }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('mouseup ends drag', () => {
    graph.updateEdge('e1', { waypoints: [{ x: 150, y: 25 }] })
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 150, clientY: 25, bubbles: true,
    }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    expect(ew.isCapturing()).toBe(false)
  })

  it('mouseup without drag is a no-op', () => {
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    expect(ew.isCapturing()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('mousemove cancels drag when edge is removed', () => {
    graph.updateEdge('e1', { waypoints: [{ x: 150, y: 25 }] })
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 150, clientY: 25, bubbles: true,
    }))
    expect(ew.isCapturing()).toBe(true)
    // Remove the edge while dragging
    graph.removeEdge('e1')
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 160, clientY: 30, bubbles: true,
    }))
    expect(ew.isCapturing()).toBe(false)
  })

  it('dispose removes event listeners without throw', () => {
    expect(() => ew.dispose()).not.toThrow()
    // After dispose, mousedown should not start a drag
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 150, clientY: 25, bubbles: true,
    }))
    expect(ew.isCapturing()).toBe(false)
  })

  it('getWaypointHandles() returns handles for multiple selected edges', () => {
    graph.addNode(nd('c', 0, 200))
    graph.addEdge({ id: 'e2', source: 'a', target: 'c' })
    graph.updateEdge('e1', { waypoints: [{ x: 150, y: 25 }] })
    selectedEdgeIds.add('e2')

    const handles = ew.getWaypointHandles()
    const e1Handles = handles.filter(h => h.edgeId === 'e1')
    const e2Handles = handles.filter(h => h.edgeId === 'e2')
    expect(e1Handles.length).toBeGreaterThan(0)
    expect(e2Handles.length).toBeGreaterThan(0)
  })

  it('removeWaypointAt() with last waypoint results in empty array', () => {
    graph.updateEdge('e1', { waypoints: [{ x: 150, y: 25 }] })
    ew.removeWaypointAt('e1', 150, 25)
    const edge = graph.getEdge('e1')!
    expect(edge.waypoints).toEqual([])
  })

  it('toScreen (private) converts world coords to screen coords', () => {
    // Direct private method access to cover the otherwise-unreachable function
    const [sx, sy] = (ew as any).toScreen(100, 50)
    expect(typeof sx).toBe('number')
    expect(typeof sy).toBe('number')
  })
})
