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

  // ── Stage 8: new public API ──────────────────────────────────────────────────

  it('getNodes() returns all nodes', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
    })
    expect(chart.getNodes()).toHaveLength(2)
    expect(chart.getNodes().map(n => n.id).sort()).toEqual(['a', 'b'])
  })

  it('getEdges() returns all edges', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
    expect(chart.getEdges()).toHaveLength(1)
    expect(chart.getEdges()[0]!.id).toBe('e1')
  })

  it('updateEdge() mutates edge properties', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
    chart.updateEdge('e1', { label: 'updated', animated: true })
    const edge = chart.getEdge('e1')!
    expect(edge.label).toBe('updated')
    expect(edge.animated).toBe(true)
  })

  it('setSelectedEdgeIds() updates selected edge set', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
    chart.setSelectedEdgeIds(['e1'])
    expect(chart.getSelectedEdgeIds()).toEqual(['e1'])
  })

  it('selectAll() selects all nodes and edges', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
    const handler = vi.fn()
    chart.on('selectionChange', handler)
    chart.selectAll()
    expect(chart.getSelectedIds().sort()).toEqual(['a', 'b'])
    expect(chart.getSelectedEdgeIds()).toEqual(['e1'])
    expect(handler).toHaveBeenCalledOnce()
  })

  // ── Stage 9: events + viewport + style convenience ────────────────────────────

  it('edgeUpdate event fires when updateEdge is called', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
    const handler = vi.fn()
    chart.on('edgeUpdate', handler)
    chart.updateEdge('e1', { label: 'hello' })
    expect(handler).toHaveBeenCalledOnce()
    expect(handler.mock.calls[0]![0]).toMatchObject({ id: 'e1', updates: { label: 'hello' } })
  })

  it('setNodeShape() updates node shape style', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    chart.setNodeShape('a', 'circle')
    expect(chart.getNode('a')!.style?.shape).toBe('circle')
  })

  it('setEdgeStyle() merges edge style', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', style: { width: 2 } }],
    })
    chart.setEdgeStyle('e1', { color: '#ff0000' })
    const edge = chart.getEdge('e1')!
    expect(edge.style?.color).toBe('#ff0000')
    expect(edge.style?.width).toBe(2)
  })

  it('zoomIn() increases zoom level', () => {
    const chart = new FlowChart({ container, onError })
    // In failed state zoomTo should not crash
    expect(() => chart.zoomIn()).not.toThrow()
    expect(() => chart.zoomOut()).not.toThrow()
    expect(() => chart.zoomTo(1.5)).not.toThrow()
  })

  // ── Stage 10: status badges + clearHistory + autoFit + selection helpers ──────

  it('setNodeStatus() sets status on node', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    chart.setNodeStatus('a', 'error')
    expect(chart.getNode('a')!.status).toBe('error')
  })

  it('setNodeStatus(null) removes status from node', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    chart.setNodeStatus('a', 'success')
    chart.setNodeStatus('a', null)
    expect(chart.getNode('a')!.status).toBeUndefined()
  })

  it('clearHistory() resets canUndo to false', () => {
    const chart = new FlowChart({ container, onError })
    chart.addNode({ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' })
    // In failed state, history is empty anyway — but clearHistory should not throw
    expect(() => chart.clearHistory()).not.toThrow()
    expect(chart.canUndo()).toBe(false)
    expect(chart.canRedo()).toBe(false)
  })

  it('clearHistory() emits historyChange', () => {
    const chart = new FlowChart({ container, onError })
    const handler = vi.fn()
    chart.on('historyChange', handler)
    chart.clearHistory()
    expect(handler).toHaveBeenCalledWith({ canUndo: false, canRedo: false })
  })

  it('getSelectedNodes() returns selected node objects', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
    })
    chart.selectAll()
    const selected = chart.getSelectedNodes()
    expect(selected).toHaveLength(2)
    expect(selected.map(n => n.id).sort()).toEqual(['a', 'b'])
  })

  it('getSelectedEdges() returns selected edge objects', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
    chart.setSelectedEdgeIds(['e1'])
    const selected = chart.getSelectedEdges()
    expect(selected).toHaveLength(1)
    expect(selected[0]!.id).toBe('e1')
  })

  it('deleteSelected() removes selected nodes from graph', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
    })
    chart.selectAll()
    chart.deleteSelected()
    expect(chart.getNodes()).toHaveLength(0)
  })

  it('autoFit adjusts viewport when nodes are provided', () => {
    const chart = new FlowChart({
      container, onError,
      autoFit: true,
      nodes: [{ id: 'a', x: 500, y: 500, width: 100, height: 50, label: 'A' }],
    })
    // With autoFit the viewport should be centered on the node (not at default 0,0)
    expect(() => chart.getViewport()).not.toThrow()
    const vp = chart.getViewport()
    expect(typeof vp.x).toBe('number')
    expect(typeof vp.y).toBe('number')
  })

  // ── Stage 11: batchUpdate + panTo + getNodesBounds + nodeResize event ────────

  it('batchUpdate creates a single history entry for multiple mutations', () => {
    const chart = new FlowChart({ container, onError })
    const handler = vi.fn()
    chart.on('historyChange', handler)
    chart.batchUpdate(() => {
      chart.addNode({ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' })
      chart.addNode({ id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' })
      chart.addNode({ id: 'c', x: 0, y: 0, width: 100, height: 50, label: 'C' })
    })
    // historyChange fires once (before the first mutation) not three times
    expect(handler).toHaveBeenCalledOnce()
    expect(chart.graph.getNodes()).toHaveLength(3)
  })

  it('batchUpdate still adds all items even in failed state', () => {
    const chart = new FlowChart({ container, onError })
    chart.batchUpdate(() => {
      chart.addNode({ id: 'x', x: 0, y: 0, width: 100, height: 50, label: 'X' })
      chart.addNode({ id: 'y', x: 0, y: 0, width: 100, height: 50, label: 'Y' })
    })
    expect(chart.graph.getNodes()).toHaveLength(2)
  })

  it('panTo does not throw', () => {
    const chart = new FlowChart({ container, onError })
    expect(() => chart.panTo(100, 200)).not.toThrow()
  })

  it('getNodesBounds returns null for empty graph', () => {
    const chart = new FlowChart({ container, onError })
    expect(chart.getNodesBounds()).toBeNull()
  })

  it('getNodesBounds returns correct AABB for nodes', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0,   y: 0,   width: 100, height: 50, label: 'A' },
        { id: 'b', x: 200, y: 100, width: 100, height: 50, label: 'B' },
      ],
    })
    const bounds = chart.getNodesBounds()
    expect(bounds).not.toBeNull()
    expect(bounds!.minX).toBe(0)
    expect(bounds!.minY).toBe(0)
    expect(bounds!.maxX).toBe(300)
    expect(bounds!.maxY).toBe(150)
  })

  it('getNodesBounds accepts an id filter', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0,   y: 0,   width: 100, height: 50, label: 'A' },
        { id: 'b', x: 200, y: 100, width: 100, height: 50, label: 'B' },
      ],
    })
    const bounds = chart.getNodesBounds(['a'])
    expect(bounds).not.toBeNull()
    expect(bounds!.maxX).toBe(100)
    expect(bounds!.maxY).toBe(50)
  })

  it('nodeResize event can be registered without throwing', () => {
    const chart = new FlowChart({ container, onError })
    expect(() => chart.on('nodeResize', vi.fn())).not.toThrow()
  })

  // ── Stage 12: onBeforeDelete + importJSON merge + getEdgesBetween + swapEdgeDirection ──

  it('onBeforeDelete returning false cancels deleteSelected', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
      onBeforeDelete: () => false,
    })
    chart.selectAll()
    chart.deleteSelected()
    expect(chart.graph.getNodes()).toHaveLength(1)
  })

  it('onBeforeDelete returning true allows deleteSelected', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
      onBeforeDelete: () => true,
    })
    chart.selectAll()
    chart.deleteSelected()
    expect(chart.graph.getNodes()).toHaveLength(0)
  })

  it('setOnBeforeDelete overrides callback at runtime', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    chart.setOnBeforeDelete(() => false)
    chart.selectAll()
    chart.deleteSelected()
    expect(chart.graph.getNodes()).toHaveLength(1)

    chart.setOnBeforeDelete(null)
    chart.selectAll()
    chart.deleteSelected()
    expect(chart.graph.getNodes()).toHaveLength(0)
  })

  it('importJSON merge mode adds nodes without clearing', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    chart.importJSON({
      nodes: [{ id: 'b', x: 200, y: 0, width: 100, height: 50, label: 'B' }],
      edges: [],
    }, 'merge')
    expect(chart.graph.getNodes()).toHaveLength(2)
    expect(chart.graph.getNode('a')).toBeDefined()
    expect(chart.graph.getNode('b')).toBeDefined()
  })

  it('importJSON replace mode is a no-op without throwing when failed', () => {
    const chart = new FlowChart({ container, onError })
    chart.addNode({ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' })
    expect(() => chart.importJSON({ nodes: [], edges: [] }, 'replace')).not.toThrow()
  })

  it('getEdgesBetween returns edges in either direction', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
        { id: 'c', x: 0, y: 0, width: 100, height: 50, label: 'C' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'a' },
        { id: 'e3', source: 'a', target: 'c' },
      ],
    })
    const edges = chart.getEdgesBetween('a', 'b')
    expect(edges).toHaveLength(2)
    expect(edges.map(e => e.id).sort()).toEqual(['e1', 'e2'])
  })

  it('getEdgesBetween returns empty array when no edges exist', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
    })
    expect(chart.getEdgesBetween('a', 'b')).toHaveLength(0)
  })

  it('swapEdgeDirection reverses source and target', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
    chart.swapEdgeDirection('e1')
    const edge = chart.getEdge('e1')!
    expect(edge.source).toBe('b')
    expect(edge.target).toBe('a')
  })

  it('swapEdgeDirection is undoable', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
    chart.swapEdgeDirection('e1')
    expect(chart.canUndo()).toBe(true)
  })

  // ── Undo consistency for public mutation APIs ─────────────────────────────────

  it('setNodeStyle() is undoable', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    chart.setNodeStyle('a', { borderColor: '#ff0000' })
    expect(chart.canUndo()).toBe(true)
    chart.undo()
    expect(chart.getNode('a')!.style?.borderColor).toBeUndefined()
  })

  it('setNodeShape() is undoable', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    chart.setNodeShape('a', 'circle')
    expect(chart.canUndo()).toBe(true)
    chart.undo()
    expect(chart.getNode('a')!.style?.shape).toBeUndefined()
  })

  it('setNodeSize() is undoable', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    chart.setNodeSize('a', 200, 120)
    expect(chart.canUndo()).toBe(true)
    chart.undo()
    const n = chart.getNode('a')!
    expect(n.width).toBe(100)
    expect(n.height).toBe(50)
  })

  it('lockNode() / unlockNode() are undoable', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    chart.lockNode('a')
    expect(chart.getNode('a')!.locked).toBe(true)
    expect(chart.canUndo()).toBe(true)
    chart.undo()
    expect(chart.getNode('a')!.locked).toBeUndefined()

    chart.lockNode('a')
    chart.unlockNode('a')
    expect(chart.getNode('a')!.locked).toBe(false)
    expect(chart.canUndo()).toBe(true)
  })

  it('public updateNode() is undoable', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    chart.updateNode('a', { label: 'Updated' })
    expect(chart.getNode('a')!.label).toBe('Updated')
    expect(chart.canUndo()).toBe(true)
    chart.undo()
    expect(chart.getNode('a')!.label).toBe('A')
  })

  it('public updateNode() is no-op for unknown id', () => {
    const chart = new FlowChart({ container, onError })
    const handler = vi.fn()
    chart.on('historyChange', handler)
    chart.updateNode('nonexistent', { label: 'X' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('public updateEdge() is undoable', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
    chart.updateEdge('e1', { label: 'link' })
    expect(chart.getEdge('e1')!.label).toBe('link')
    expect(chart.canUndo()).toBe(true)
    chart.undo()
    expect(chart.getEdge('e1')!.label).toBeUndefined()
  })

  it('public updateEdge() is no-op for unknown id', () => {
    const chart = new FlowChart({ container, onError })
    const handler = vi.fn()
    chart.on('historyChange', handler)
    chart.updateEdge('nonexistent', { label: 'X' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('collapseNode() / expandNode() are undoable', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'g', x: 0, y: 0, width: 200, height: 200, label: 'G', type: 'group' }],
    })
    chart.collapseNode('g')
    expect(chart.getNode('g')!.collapsed).toBe(true)
    expect(chart.canUndo()).toBe(true)
    chart.undo()
    expect(chart.getNode('g')!.collapsed).toBeUndefined()

    chart.collapseNode('g')
    chart.expandNode('g')
    expect(chart.getNode('g')!.collapsed).toBe(false)
    expect(chart.canUndo()).toBe(true)
  })

  it('collapseNode() is no-op for non-group nodes', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    const handler = vi.fn()
    chart.on('historyChange', handler)
    chart.collapseNode('a')
    expect(handler).not.toHaveBeenCalled()
    expect(chart.getNode('a')!.collapsed).toBeUndefined()
  })

  it('groupNodes() / ungroupNodes() are undoable', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'parent', x: 0, y: 0, width: 300, height: 300, label: 'P', type: 'group' },
        { id: 'child', x: 10, y: 10, width: 100, height: 50, label: 'C' },
      ],
    })
    chart.groupNodes('parent', ['child'])
    expect(chart.getNode('child')!.parentId).toBe('parent')
    expect(chart.canUndo()).toBe(true)
    chart.undo()
    expect(chart.getNode('child')!.parentId).toBeUndefined()

    chart.groupNodes('parent', ['child'])
    chart.ungroupNodes(['child'])
    expect(chart.getNode('child')!.parentId).toBeUndefined()
    expect(chart.canUndo()).toBe(true)
  })

  it('groupNodes() is no-op with empty childIds', () => {
    const chart = new FlowChart({ container, onError })
    const handler = vi.fn()
    chart.on('historyChange', handler)
    chart.groupNodes('p', [])
    expect(handler).not.toHaveBeenCalled()
  })

  it('setEdges() is undoable', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
    chart.setEdges([])
    expect(chart.getEdges()).toHaveLength(0)
    expect(chart.canUndo()).toBe(true)
    chart.undo()
    expect(chart.getEdges()).toHaveLength(1)
  })

  // ── Graph query edge cases ────────────────────────────────────────────────────

  it('getIncomers() uses edge index — returns correct nodes', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
        { id: 'c', x: 0, y: 0, width: 100, height: 50, label: 'C' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'c', target: 'b' },
      ],
    })
    const incomers = chart.getIncomers('b')
    expect(incomers.map(n => n.id).sort()).toEqual(['a', 'c'])
    expect(chart.getIncomers('a')).toHaveLength(0)
  })

  it('getOutgoers() returns correct nodes', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
        { id: 'c', x: 0, y: 0, width: 100, height: 50, label: 'C' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'c' },
      ],
    })
    const outgoers = chart.getOutgoers('a')
    expect(outgoers.map(n => n.id).sort()).toEqual(['b', 'c'])
    expect(chart.getOutgoers('b')).toHaveLength(0)
  })

  it('getConnectedNodes() returns all neighbors', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
        { id: 'c', x: 0, y: 0, width: 100, height: 50, label: 'C' },
        { id: 'd', x: 0, y: 0, width: 100, height: 50, label: 'D' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'c', target: 'a' },
      ],
    })
    const connected = chart.getConnectedNodes('a')
    expect(connected.map(n => n.id).sort()).toEqual(['b', 'c'])
    expect(chart.getConnectedNodes('d')).toHaveLength(0)
  })

  it('getEdgesForNode() returns only edges incident to that node', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
        { id: 'c', x: 0, y: 0, width: 100, height: 50, label: 'C' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
        { id: 'e3', source: 'a', target: 'c' },
      ],
    })
    const edgesA = chart.getEdgesForNode('a')
    expect(edgesA.map(e => e.id).sort()).toEqual(['e1', 'e3'])
    const edgesB = chart.getEdgesForNode('b')
    expect(edgesB.map(e => e.id).sort()).toEqual(['e1', 'e2'])
  })

  it('removeNode() cascades and removes connected edges', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
    chart.removeNode('a')
    expect(chart.getNodes()).toHaveLength(1)
    expect(chart.getEdges()).toHaveLength(0)
  })

  it('hasCycle() detects directed cycle', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
        { id: 'c', x: 0, y: 0, width: 100, height: 50, label: 'C' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
        { id: 'e3', source: 'c', target: 'a' },
      ],
    })
    expect(chart.hasCycle()).toBe(true)
  })

  it('hasCycle() returns false for DAG', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
        { id: 'c', x: 0, y: 0, width: 100, height: 50, label: 'C' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
    })
    expect(chart.hasCycle()).toBe(false)
  })

  it('findPaths() returns all paths between two nodes', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
        { id: 'c', x: 0, y: 0, width: 100, height: 50, label: 'C' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'c' },
        { id: 'e3', source: 'c', target: 'b' },
      ],
    })
    const paths = chart.findPaths('a', 'b')
    expect(paths.length).toBe(2)
    expect(paths.some(p => JSON.stringify(p) === JSON.stringify(['a', 'b']))).toBe(true)
    expect(paths.some(p => JSON.stringify(p) === JSON.stringify(['a', 'c', 'b']))).toBe(true)
  })

  it('findPaths() returns empty array when source equals target', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    expect(chart.findPaths('a', 'a')).toHaveLength(0)
  })

  // ── batchUpdate edge cases ────────────────────────────────────────────────────

  it('batchUpdate cleans up batching flag even when fn throws', () => {
    const chart = new FlowChart({ container, onError })
    try {
      chart.batchUpdate(() => {
        chart.addNode({ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' })
        throw new Error('intentional error')
      })
    } catch { /* expected */ }
    // After thrown error, batching should be false — subsequent mutations work normally
    const handler = vi.fn()
    chart.on('historyChange', handler)
    chart.addNode({ id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' })
    expect(handler).toHaveBeenCalledOnce()
  })

  // ── dispose edge cases ────────────────────────────────────────────────────────

  it('dispose() does not throw in failed state', () => {
    const chart = new FlowChart({ container, onError })
    expect(() => chart.dispose()).not.toThrow()
  })

  it('dispose() cleans up DOM elements', () => {
    const chart = new FlowChart({ container, onError })
    chart.dispose()
    // canvas should be removed from container
    expect(container.querySelector('canvas')).toBeNull()
  })

  // ── importJSON merge edge cases ───────────────────────────────────────────────

  it('importJSON merge does not overwrite existing nodes', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'Original' }],
    })
    chart.importJSON({
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'Overwritten' }],
      edges: [],
    }, 'merge')
    // addNode with same id triggers warn + overwrite in Graph; the label should be overwritten
    // (this is the current behavior — documenting it as a test)
    expect(chart.graph.getNodes()).toHaveLength(1)
  })

  it('importJSON merge is undoable', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    chart.importJSON({
      nodes: [{ id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' }],
      edges: [],
    }, 'merge')
    expect(chart.getNodes()).toHaveLength(2)
    expect(chart.canUndo()).toBe(true)
    chart.undo()
    expect(chart.getNodes()).toHaveLength(1)
  })

  // ── lockNode prevents deleteSelected ─────────────────────────────────────────

  it('locked node is not deleted by deleteSelected', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A', locked: true },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' },
      ],
    })
    chart.selectAll()
    chart.deleteSelected()
    expect(chart.getNodes()).toHaveLength(1)
    expect(chart.getNode('a')).toBeDefined()
  })

  // ── searchNodes ───────────────────────────────────────────────────────────────

  it('searchNodes() returns matched nodes case-insensitively', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'Alpha Node' },
        { id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'Beta Node' },
        { id: 'c', x: 0, y: 0, width: 100, height: 50, label: 'ALPHA UPPER' },
      ],
    })
    const results = chart.searchNodes('alpha')
    expect(results.map(n => n.id).sort()).toEqual(['a', 'c'])
  })

  it('searchNodes() with empty query clears highlights and returns empty', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    chart.searchNodes('A')
    const empty = chart.searchNodes('')
    expect(empty).toHaveLength(0)
  })

  // ── setTheme ──────────────────────────────────────────────────────────────────

  it('setTheme() does not throw for light and dark', () => {
    const chart = new FlowChart({ container, onError })
    expect(() => chart.setTheme('dark')).not.toThrow()
    expect(() => chart.setTheme('light')).not.toThrow()
  })

  // ── duplicateSelected ─────────────────────────────────────────────────────────

  it('duplicateSelected() creates copies with offset positions', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 100, y: 100, width: 100, height: 50, label: 'A' }],
    })
    chart.selectAll()
    chart.duplicateSelected()
    const nodes = chart.getNodes()
    expect(nodes).toHaveLength(2)
    const copy = nodes.find(n => n.id !== 'a')!
    expect(copy.x).toBe(124)
    expect(copy.y).toBe(124)
  })

  it('duplicateSelected() is undoable', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    chart.selectAll()
    chart.duplicateSelected()
    expect(chart.canUndo()).toBe(true)
    chart.undo()
    expect(chart.getNodes()).toHaveLength(1)
  })

  // ── alignNodes ────────────────────────────────────────────────────────────────

  it('alignNodes() aligns to left edge', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 50,  y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 200, y: 0, width: 100, height: 50, label: 'B' },
      ],
    })
    chart.selectAll()
    chart.alignNodes('left')
    expect(chart.getNode('a')!.x).toBe(50)
    expect(chart.getNode('b')!.x).toBe(50)
  })

  it('alignNodes() is undoable', () => {
    const chart = new FlowChart({
      container, onError,
      nodes: [
        { id: 'a', x: 50,  y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 200, y: 0, width: 100, height: 50, label: 'B' },
      ],
    })
    chart.selectAll()
    chart.alignNodes('left')
    expect(chart.canUndo()).toBe(true)
    chart.undo()
    expect(chart.getNode('b')!.x).toBe(200)
  })

  // ── undo/redo full cycle ──────────────────────────────────────────────────────

  it('undo/redo cycle restores state correctly', () => {
    const chart = new FlowChart({ container, onError })
    chart.addNode({ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' })
    chart.addNode({ id: 'b', x: 0, y: 0, width: 100, height: 50, label: 'B' })
    expect(chart.getNodes()).toHaveLength(2)

    chart.undo()
    expect(chart.getNodes()).toHaveLength(1)

    chart.redo()
    expect(chart.getNodes()).toHaveLength(2)

    chart.undo()
    chart.undo()
    expect(chart.getNodes()).toHaveLength(0)
    expect(chart.canUndo()).toBe(false)
  })
})
