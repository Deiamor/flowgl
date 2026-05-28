import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FlowChart } from '../flowchart'

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  Object.defineProperty(div, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
  })
  document.body.appendChild(div)
  return div
}

// In happy-dom WebGL2 is unavailable, so all FlowChart instances end up in the failed state.
// These tests verify graceful degradation and the parts that still work (graph, events, serialization).

describe('FlowChart (WebGL unavailable — graceful degradation)', () => {
  let container: HTMLElement
  let onError: ReturnType<typeof vi.fn>

  beforeEach(() => {
    container = makeContainer()
    onError   = vi.fn()
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  // ── Construction ────────────────────────────────────────────────────────────

  it('calls onError when WebGL2 is unavailable', () => {
    new FlowChart({ container, onError })
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error)
  })

  it('does not throw without onError callback', () => {
    expect(() => new FlowChart({ container })).not.toThrow()
  })

  // ── Failed-state API safety ─────────────────────────────────────────────────

  it('canUndo / canRedo return false when failed', () => {
    const chart = new FlowChart({ container, onError })
    expect(chart.canUndo()).toBe(false)
    expect(chart.canRedo()).toBe(false)
  })

  it('undo / redo return false when failed', () => {
    const chart = new FlowChart({ container, onError })
    expect(chart.undo()).toBe(false)
    expect(chart.redo()).toBe(false)
  })

  it('addNode / removeNode / addEdge / removeEdge do not throw when failed', () => {
    const chart = new FlowChart({ container, onError })
    const node = { id: 'x', x: 0, y: 0, width: 100, height: 50, label: 'X' }
    expect(() => chart.addNode(node)).not.toThrow()
    expect(() => chart.removeNode('x')).not.toThrow()
    expect(() => chart.addEdge({ id: 'e1', source: 'a', target: 'b' })).not.toThrow()
    expect(() => chart.removeEdge('e1')).not.toThrow()
  })

  it('dispose does not throw when failed', () => {
    const chart = new FlowChart({ container, onError })
    expect(() => chart.dispose()).not.toThrow()
  })

  it('toJSON returns well-formed object when failed', () => {
    const chart = new FlowChart({ container, onError })
    const json = chart.toJSON()
    expect(json).toHaveProperty('version', 1)
    expect(Array.isArray(json.nodes)).toBe(true)
    expect(Array.isArray(json.edges)).toBe(true)
    expect(json).toHaveProperty('viewport')
  })

  it('fromJSON is a no-op and does not throw when failed', () => {
    const chart = new FlowChart({ container, onError })
    expect(() => chart.fromJSON({
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
      edges: [],
    })).not.toThrow()
  })

  it('fitView does not throw when failed', () => {
    const chart = new FlowChart({ container, onError })
    expect(() => chart.fitView()).not.toThrow()
  })

  // ── Events fire even in failed state ────────────────────────────────────────

  it('nodeAdd event fires when addNode is called', () => {
    const chart = new FlowChart({ container, onError })
    const handler = vi.fn()
    chart.on('nodeAdd', handler)
    chart.addNode({ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' })
    expect(handler).toHaveBeenCalledOnce()
    expect(handler.mock.calls[0]![0].node.id).toBe('a')
  })

  it('nodeRemove event fires when removeNode is called', () => {
    const chart = new FlowChart({ container, onError })
    chart.addNode({ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' })
    const handler = vi.fn()
    chart.on('nodeRemove', handler)
    chart.removeNode('a')
    expect(handler).toHaveBeenCalledWith({ id: 'a' })
  })

  it('edgeAdd event fires when addEdge is called', () => {
    const chart = new FlowChart({ container, onError })
    const handler = vi.fn()
    chart.on('edgeAdd', handler)
    chart.addEdge({ id: 'e1', source: 'a', target: 'b' })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('historyChange event fires when addNode is called', () => {
    const chart = new FlowChart({ container, onError })
    const handler = vi.fn()
    chart.on('historyChange', handler)
    chart.addNode({ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' })
    expect(handler).toHaveBeenCalled()
    const { canUndo, canRedo } = handler.mock.calls[0]![0]
    expect(typeof canUndo).toBe('boolean')
    expect(typeof canRedo).toBe('boolean')
  })

  it('off() removes event listener', () => {
    const chart = new FlowChart({ container, onError })
    const handler = vi.fn()
    chart.on('nodeAdd', handler)
    chart.off('nodeAdd', handler)
    chart.addNode({ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' })
    expect(handler).not.toHaveBeenCalled()
  })

  // ── Graph data consistency ───────────────────────────────────────────────────

  it('graph reflects addNode even when failed', () => {
    const chart = new FlowChart({ container, onError })
    chart.addNode({ id: 'a', x: 10, y: 20, width: 100, height: 50, label: 'Alpha' })
    const nodes = chart.graph.getNodes()
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.id).toBe('a')
    expect(nodes[0]!.label).toBe('Alpha')
  })

  it('setNodes replaces graph content', () => {
    const chart = new FlowChart({ container, onError })
    chart.addNode({ id: 'old', x: 0, y: 0, width: 100, height: 50, label: 'Old' })
    chart.setNodes([
      { id: 'new1', x: 0, y: 0, width: 100, height: 50, label: 'New1' },
      { id: 'new2', x: 200, y: 0, width: 100, height: 50, label: 'New2' },
    ])
    const nodes = chart.graph.getNodes()
    expect(nodes).toHaveLength(2)
    expect(nodes.find(n => n.id === 'old')).toBeUndefined()
  })

  it('getSelectedIds starts empty', () => {
    const chart = new FlowChart({ container, onError })
    expect(chart.getSelectedIds()).toEqual([])
    expect(chart.getSelectedEdgeIds()).toEqual([])
  })

  // ── Construction with initial data ──────────────────────────────────────────

  it('initial nodes/edges are loaded into graph', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'n1', x: 0, y: 0, width: 100, height: 50, label: 'N1' },
        { id: 'n2', x: 200, y: 0, width: 100, height: 50, label: 'N2' },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    })
    expect(chart.graph.getNodes()).toHaveLength(2)
    expect(chart.graph.getEdges()).toHaveLength(1)
  })
})
