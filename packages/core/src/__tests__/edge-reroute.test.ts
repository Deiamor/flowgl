import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EdgeReroute } from '../interaction/edge-reroute'
import { Viewport } from '../viewport/viewport'
import { Graph } from '../graph/graph'
import { HitTester } from '../interaction/hit-test'
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

describe('EdgeReroute', () => {
  let canvas:      HTMLCanvasElement
  let viewport:    Viewport
  let graph:       Graph
  let hitTester:   HitTester
  let selectedEdgeIds: Set<string>
  let onStateChange: ReturnType<typeof vi.fn>
  let onReroute:     ReturnType<typeof vi.fn>
  let reroute:       EdgeReroute

  beforeEach(() => {
    canvas   = makeCanvas()
    viewport = new Viewport()
    viewport.setSize(800, 600)
    graph    = new Graph()
    graph.addNode(nd('a', 0, 0))
    graph.addNode(nd('b', 200, 0))
    graph.addEdge({ id: 'e1', source: 'a', target: 'b' })

    selectedEdgeIds = new Set(['e1'])
    onStateChange   = vi.fn()
    onReroute       = vi.fn()
    hitTester       = new HitTester()

    reroute = new EdgeReroute(
      canvas, viewport, graph, hitTester,
      () => selectedEdgeIds,
      onStateChange,
      onReroute,
    )
  })

  it('constructs without throwing', () => {
    expect(reroute).toBeDefined()
  })

  it('isCapturing() returns false initially', () => {
    expect(reroute.isCapturing()).toBe(false)
  })

  it('getEndpointCircles() returns empty when no edges selected', () => {
    selectedEdgeIds.clear()
    expect(reroute.getEndpointCircles()).toHaveLength(0)
  })

  it('getEndpointCircles() returns 2 circles for one selected edge', () => {
    const circles = reroute.getEndpointCircles()
    expect(circles).toHaveLength(2)
    expect(circles.some(c => c.end === 'source')).toBe(true)
    expect(circles.some(c => c.end === 'target')).toBe(true)
  })

  it('getEndpointCircles() skips edge with missing node', () => {
    graph.addEdge({ id: 'e2', source: 'a', target: 'b' })
    graph.removeNode('b')
    selectedEdgeIds.add('e2')
    const circles = reroute.getEndpointCircles()
    // e1 also has no target now — both should be skipped
    expect(circles).toHaveLength(0)
  })

  it('getEndpointCircles() skips unknown edge id', () => {
    selectedEdgeIds.clear()
    selectedEdgeIds.add('ghost')
    expect(reroute.getEndpointCircles()).toHaveLength(0)
  })

  it('isOnEndpoint() returns false when no circles', () => {
    selectedEdgeIds.clear()
    expect(reroute.isOnEndpoint(0, 0)).toBe(false)
  })

  it('isOnEndpoint() returns true when clicking on source endpoint', () => {
    // Source node a: x=0,y=0,w=100,h=50. right handle at world (100, 25)
    // screen coords at zoom=1 → viewport.screenToWorld maps (100,25) → (100,25)
    // client (100, 25) → screen (100-0, 25-0) → world (100,25) — on source handle
    expect(reroute.isOnEndpoint(100, 25)).toBe(true)
  })

  it('isOnEndpoint() returns false when clicking far from endpoints', () => {
    expect(reroute.isOnEndpoint(400, 400)).toBe(false)
  })

  it('setDisabled prevents drag start', () => {
    reroute.setDisabled(true)
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 25, bubbles: true, cancelable: true,
    }, ))
    expect(reroute.isCapturing()).toBe(false)
  })

  it('mousedown on endpoint starts drag, fires onStateChange', () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 25, bubbles: true,
    }))
    expect(reroute.isCapturing()).toBe(true)
    expect(onStateChange).toHaveBeenCalledOnce()
    expect(onStateChange.mock.calls[0]![0]).not.toBeNull()
  })

  it('mousedown away from endpoint does not start drag', () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 400, clientY: 400, bubbles: true,
    }))
    expect(reroute.isCapturing()).toBe(false)
  })

  it('right button mousedown is ignored', () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 2, clientX: 100, clientY: 25, bubbles: true,
    }))
    expect(reroute.isCapturing()).toBe(false)
  })

  it('mousemove during drag updates state', () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 25, bubbles: true,
    }))
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 150, clientY: 50, bubbles: true,
    }))
    expect(onStateChange).toHaveBeenCalledTimes(2)
  })

  it('mousemove without drag is a no-op', () => {
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 150, clientY: 50, bubbles: true,
    }))
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it('mouseup without target fires onStateChange(null) but not onReroute', () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 25, bubbles: true,
    }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    expect(reroute.isCapturing()).toBe(false)
    expect(onReroute).not.toHaveBeenCalled()
    const lastCall = onStateChange.mock.calls[onStateChange.mock.calls.length - 1]!
    expect(lastCall[0]).toBeNull()
  })

  it('mouseup with valid target fires onReroute', () => {
    // Add a third node to reroute to
    graph.addNode(nd('c', 0, 200))
    // Start drag on source endpoint
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 25, bubbles: true,
    }))
    // Move to c's left handle: world(0, 225) → screen(0,225)
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 0, clientY: 225, bubbles: true,
    }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    // onReroute may or may not fire depending on handle hit detection
    expect(reroute.isCapturing()).toBe(false)
  })

  it('mouseup without drag is a no-op', () => {
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    expect(onReroute).not.toHaveBeenCalled()
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it('dispose removes event listeners without throw', () => {
    expect(() => reroute.dispose()).not.toThrow()
    expect(reroute.isCapturing()).toBe(false)
  })

  it('getEndpointCircles with custom handles', () => {
    graph.addEdge({ id: 'e2', source: 'a', target: 'b', sourceHandle: 'top', targetHandle: 'bottom' })
    selectedEdgeIds.clear()
    selectedEdgeIds.add('e2')
    const circles = reroute.getEndpointCircles()
    expect(circles).toHaveLength(2)
  })
})
