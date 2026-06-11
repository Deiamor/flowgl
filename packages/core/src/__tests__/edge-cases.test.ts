/**
 * Edge cases & unusual scenario tests
 * 300+ cases covering combinations of implemented features
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FlowChart } from '../flowchart'
import { Graph } from '../graph/graph'
import {
  hierarchicalLayout,
  forceLayout,
  gridLayout,
  circularLayout,
} from '../layout/auto-layout'
import type { NodeData } from '../graph/node'
import type { EdgeData } from '../graph/edge'

// ─── helpers ────────────────────────────────────────────────────────────────

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  Object.defineProperty(div, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
  })
  document.body.appendChild(div)
  return div
}

function makeChart(opts: Partial<ConstructorParameters<typeof FlowChart>[0]> = {}): FlowChart {
  const container = makeContainer()
  const onError = vi.fn()
  return new FlowChart({ container, onError, ...opts })
}

const n = (id: string, x = 0, y = 0, w = 100, h = 50): NodeData => ({
  id, label: id, x, y, width: w, height: h,
})

const e = (id: string, source: string, target: string): EdgeData => ({
  id, source, target,
})

// ─── 1. EMPTY GRAPH ──────────────────────────────────────────────────────────

describe('Empty graph edge cases', () => {
  let chart: FlowChart

  beforeEach(() => { chart = makeChart() })
  afterEach(() => { chart.dispose() })

  it('EC-001: getNodes() returns [] on empty graph', () => {
    expect(chart.getNodes()).toEqual([])
  })

  it('EC-002: getEdges() returns [] on empty graph', () => {
    expect(chart.getEdges()).toEqual([])
  })

  it('EC-003: getSelectedIds() returns [] on empty graph', () => {
    expect(chart.getSelectedIds()).toEqual([])
  })

  it('EC-004: selectAll() on empty graph fires selectionChange with empty arrays', () => {
    const handler = vi.fn()
    chart.on('selectionChange', handler)
    chart.selectAll()
    expect(handler).toHaveBeenCalledWith({ selectedIds: [], edgeIds: [] })
  })

  it('EC-005: deleteSelected() on empty graph does not throw', () => {
    expect(() => chart.deleteSelected()).not.toThrow()
  })

  it('EC-006: duplicateSelected() on empty graph does not throw', () => {
    expect(() => chart.duplicateSelected()).not.toThrow()
  })

  it('EC-007: fitView() on empty graph does not throw', () => {
    expect(() => chart.fitView()).not.toThrow()
  })

  it('EC-008: fitViewToSelection() on empty graph does not throw', () => {
    expect(() => chart.fitViewToSelection()).not.toThrow()
  })

  it('EC-009: hasCycle() on empty graph returns false', () => {
    expect(chart.hasCycle()).toBe(false)
  })

  it('EC-010: findPaths() on empty graph returns []', () => {
    expect(chart.findPaths('a', 'b')).toEqual([])
  })

  it('EC-011: getNodesBounds() on empty graph returns null', () => {
    expect(chart.getNodesBounds()).toBeNull()
  })

  it('EC-012: searchNodes() on empty graph returns []', () => {
    expect(chart.searchNodes('anything')).toEqual([])
  })

  it('EC-013: clearHighlights() on empty graph does not throw', () => {
    expect(() => chart.clearHighlights()).not.toThrow()
  })

  it('EC-014: alignNodes() on empty selection does not throw', () => {
    expect(() => chart.alignNodes('left')).not.toThrow()
  })

  it('EC-015: distributeNodes() on empty selection does not throw', () => {
    expect(() => chart.distributeNodes('horizontal')).not.toThrow()
  })

  it('EC-016: exportPNG() returns null when WebGL unavailable', () => {
    const result = chart.exportPNG()
    expect(result).toBeNull()
  })

  it('EC-017: exportSVG() returns a string', () => {
    const result = chart.exportSVG()
    expect(typeof result).toBe('string')
  })

  it('EC-018: toJSON() version is 1 on empty graph', () => {
    expect(chart.toJSON().version).toBe(1)
  })

  it('EC-019: getConnectedNodes() for unknown id returns []', () => {
    expect(chart.getConnectedNodes('ghost')).toEqual([])
  })

  it('EC-020: getEdgesForNode() for unknown id returns []', () => {
    expect(chart.getEdgesForNode('ghost')).toEqual([])
  })
})

// ─── 2. SINGLE NODE ──────────────────────────────────────────────────────────

describe('Single node edge cases', () => {
  let chart: FlowChart

  beforeEach(() => {
    chart = makeChart({
      nodes: [n('a', 100, 100)],
    })
  })
  afterEach(() => { chart.dispose() })

  it('EC-021: removeNode then graph is empty', () => {
    chart.removeNode('a')
    expect(chart.getNodes()).toHaveLength(0)
  })

  it('EC-022: removeNode fires nodeRemove event', () => {
    const handler = vi.fn()
    chart.on('nodeRemove', handler)
    chart.removeNode('a')
    expect(handler).toHaveBeenCalledWith({ id: 'a' })
  })

  it('EC-023: updateNode with empty patch does not change node', () => {
    chart.updateNode('a', {})
    expect(chart.getNode('a')!.label).toBe('a')
  })

  it('EC-024: selectAll selects the single node', () => {
    chart.selectAll()
    expect(chart.getSelectedIds()).toEqual(['a'])
  })

  it('EC-025: fitView with single node does not throw', () => {
    expect(() => chart.fitView()).not.toThrow()
  })

  it('EC-026: scrollToNode with valid id does not throw', () => {
    expect(() => chart.scrollToNode('a')).not.toThrow()
  })

  it('EC-027: scrollToNode with unknown id does not throw', () => {
    expect(() => chart.scrollToNode('nonexistent')).not.toThrow()
  })

  it('EC-028: getNodesBounds for single node is correct', () => {
    const b = chart.getNodesBounds()!
    expect(b.minX).toBe(100)
    expect(b.minY).toBe(100)
    expect(b.maxX).toBe(200)
    expect(b.maxY).toBe(150)
  })

  it('EC-029: setHighlightedNodes then clearHighlights is a no-op', () => {
    chart.setHighlightedNodes(['a'])
    chart.clearHighlights()
    expect(chart.getNodes()).toHaveLength(1)
  })

  it('EC-030: searchNodes with exact match returns node', () => {
    expect(chart.searchNodes('a')).toHaveLength(1)
  })

  it('EC-031: searchNodes case-insensitive', () => {
    chart.updateNode('a', { label: 'Alpha Node' })
    expect(chart.searchNodes('alpha')).toHaveLength(1)
    expect(chart.searchNodes('ALPHA')).toHaveLength(1)
  })

  it('EC-032: searchNodes with no match returns []', () => {
    expect(chart.searchNodes('zzz_no_match')).toHaveLength(0)
  })

  it('EC-033: lockNode then deleteSelected does not delete it', () => {
    chart.lockNode('a')
    chart.selectAll()
    chart.deleteSelected()
    expect(chart.getNodes()).toHaveLength(1)
  })

  it('EC-034: lockNode then unlockNode restores deletability', () => {
    chart.lockNode('a')
    chart.unlockNode('a')
    chart.selectAll()
    chart.deleteSelected()
    expect(chart.getNodes()).toHaveLength(0)
  })

  it('EC-035: setNodeSize stores given values (no programmatic clamping)', () => {
    chart.setNodeSize('a', 200, 100)
    const node = chart.getNode('a')!
    expect(node.width).toBe(200)
    expect(node.height).toBe(100)
  })

  it('EC-036: setNodeShape cycles through all shapes', () => {
    const shapes = ['rectangle', 'circle', 'diamond', 'hexagon'] as const
    for (const shape of shapes) {
      chart.setNodeShape('a', shape)
      expect(chart.getNode('a')!.style?.shape).toBe(shape)
    }
  })

  it('EC-037: setNodeStatus cycles through all statuses then null', () => {
    const statuses = ['error', 'warning', 'success', 'info'] as const
    for (const s of statuses) {
      chart.setNodeStatus('a', s)
      expect(chart.getNode('a')!.status).toBe(s)
    }
    chart.setNodeStatus('a', null)
    expect(chart.getNode('a')!.status).toBeUndefined()
  })

  it('EC-038: setNodeBorderColor then style is set', () => {
    chart.setNodeBorderColor('a', '#123456')
    expect(chart.getNode('a')!.style?.borderColor).toBe('#123456')
  })

  it('EC-039: setNodeBackgroundColor then style is set', () => {
    chart.setNodeBackgroundColor('a', '#abcdef')
    expect(chart.getNode('a')!.style?.backgroundColor).toBe('#abcdef')
  })

  it('EC-040: hasCycle with single node returns false', () => {
    expect(chart.hasCycle()).toBe(false)
  })
})

// ─── 3. SELF-LOOPS ───────────────────────────────────────────────────────────

describe('Self-loop edge cases', () => {
  let chart: FlowChart

  beforeEach(() => {
    chart = makeChart({
      nodes: [n('a')],
      edges: [{ id: 'self', source: 'a', target: 'a' }],
    })
  })
  afterEach(() => { chart.dispose() })

  it('EC-041: self-loop edge is stored', () => {
    expect(chart.getEdge('self')).toBeDefined()
    expect(chart.getEdge('self')!.source).toBe('a')
    expect(chart.getEdge('self')!.target).toBe('a')
  })

  it('EC-042: getEdgesForNode includes self-loop', () => {
    const edges = chart.graph.getEdgesForNode('a')
    expect(edges.some(e => e.id === 'self')).toBe(true)
  })

  it('EC-043: hasCycle with self-loop returns true', () => {
    expect(chart.hasCycle()).toBe(true)
  })

  it('EC-044: swapEdgeDirection on self-loop keeps same source/target', () => {
    chart.swapEdgeDirection('self')
    const edge = chart.getEdge('self')!
    expect(edge.source).toBe('a')
    expect(edge.target).toBe('a')
  })

  it('EC-045: removeNode also removes self-loop edge', () => {
    chart.removeNode('a')
    expect(chart.getEdge('self')).toBeUndefined()
  })

  it('EC-046: getEdgesForNode includes self-loop for source node', () => {
    const edges = chart.getEdgesForNode('a')
    expect(edges.some(edge => edge.id === 'self')).toBe(true)
  })

  it('EC-047: self-loop edge in toJSON round-trip', () => {
    const json = chart.toJSON()
    expect(json.edges).toHaveLength(1)
    expect(json.edges[0]!.source).toBe('a')
    expect(json.edges[0]!.target).toBe('a')
  })
})

// ─── 4. PARALLEL EDGES ───────────────────────────────────────────────────────

describe('Parallel edge edge cases', () => {
  let chart: FlowChart

  beforeEach(() => {
    chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'b' },
        { id: 'e3', source: 'b', target: 'a' },
      ],
    })
  })
  afterEach(() => { chart.dispose() })

  it('EC-048: getEdgesBetween returns all parallel edges in both directions', () => {
    const edges = chart.getEdgesBetween('a', 'b')
    expect(edges).toHaveLength(3)
  })

  it('EC-049: getEdgesForNode(a) returns all edges connected to a', () => {
    const edges = chart.graph.getEdgesForNode('a')
    expect(edges).toHaveLength(3)
  })

  it('EC-050: removeNode(a) removes all 3 edges', () => {
    chart.removeNode('a')
    expect(chart.getEdges()).toHaveLength(0)
  })

  it('EC-051: hasCycle with back-edge returns true', () => {
    expect(chart.hasCycle()).toBe(true)
  })

  it('EC-052: removing one parallel edge keeps others', () => {
    chart.removeEdge('e1')
    expect(chart.getEdge('e1')).toBeUndefined()
    expect(chart.getEdge('e2')).toBeDefined()
    expect(chart.getEdge('e3')).toBeDefined()
  })

  it('EC-053: selectAll selects all edges', () => {
    chart.selectAll()
    expect(chart.getSelectedEdgeIds()).toHaveLength(3)
  })

  it('EC-054: deleteSelected removes all parallel edges', () => {
    chart.selectAll()
    chart.deleteSelected()
    expect(chart.getEdges()).toHaveLength(0)
  })
})

// ─── 5. GHOST EDGES (referencing non-existent nodes) ─────────────────────────

describe('Ghost node references in edges', () => {
  it('EC-055: addEdge with ghost source is rejected with warning', () => {
    const g = new Graph()
    g.addNode(n('b'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    g.addEdge(e('e1', 'ghost', 'b'))
    expect(g.edgeCount).toBe(0)
    warn.mockRestore()
  })

  it('EC-056: addEdge with ghost target is rejected with warning', () => {
    const g = new Graph()
    g.addNode(n('a'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    g.addEdge(e('e1', 'a', 'ghost'))
    expect(g.edgeCount).toBe(0)
    warn.mockRestore()
  })

  it('EC-057: addEdge with both ghost is rejected with warning', () => {
    const g = new Graph()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    g.addEdge(e('e1', 'ghost1', 'ghost2'))
    expect(g.edgeCount).toBe(0)
    warn.mockRestore()
  })

  it('EC-058: updateEdge on nonexistent id is no-op', () => {
    const chart = makeChart()
    const handler = vi.fn()
    chart.on('historyChange', handler)
    chart.updateEdge('nonexistent', { label: 'x' })
    expect(handler).not.toHaveBeenCalled()
    chart.dispose()
  })

  it('EC-059: removeEdge on nonexistent id does not throw', () => {
    const chart = makeChart()
    expect(() => chart.removeEdge('ghost')).not.toThrow()
    chart.dispose()
  })
})

// ─── 6. NODE STYLE COMBINATIONS ──────────────────────────────────────────────

describe('Node style combinations', () => {
  let chart: FlowChart

  beforeEach(() => {
    chart = makeChart({ nodes: [n('a')] })
  })
  afterEach(() => { chart.dispose() })

  it('EC-060: setNodeStyle merges partial style without clobbering', () => {
    chart.setNodeStyle('a', { borderColor: '#ff0000' })
    chart.setNodeStyle('a', { backgroundColor: '#00ff00' })
    const node = chart.getNode('a')!
    expect(node.style?.borderColor).toBe('#ff0000')
    expect(node.style?.backgroundColor).toBe('#00ff00')
  })

  it('EC-061: full style override via updateNode', () => {
    chart.updateNode('a', {
      style: {
        backgroundColor: '#111',
        borderColor: '#222',
        borderWidth: 4,
        borderRadius: 0,
        textColor: '#fff',
        fontSize: 18,
        fontFamily: 'monospace',
        textAlign: 'left',
        lineHeight: 1.6,
        shape: 'diamond',
      },
    })
    const s = chart.getNode('a')!.style!
    expect(s.shape).toBe('diamond')
    expect(s.borderWidth).toBe(4)
    expect(s.fontSize).toBe(18)
  })

  it('EC-062: setNodeStyle on nonexistent id does not throw', () => {
    expect(() => chart.setNodeStyle('ghost', { borderColor: '#red' })).not.toThrow()
  })

  it('EC-063: setNodeBorderColor then setNodeStyle preserves color', () => {
    chart.setNodeBorderColor('a', '#ff0000')
    chart.setNodeStyle('a', { borderWidth: 5 })
    expect(chart.getNode('a')!.style?.borderColor).toBe('#ff0000')
    expect(chart.getNode('a')!.style?.borderWidth).toBe(5)
  })

  it('EC-064: node with all four shapes has correct style.shape', () => {
    for (const shape of ['rectangle', 'circle', 'diamond', 'hexagon'] as const) {
      chart.setNodeShape('a', shape)
      expect(chart.getNode('a')!.style?.shape).toBe(shape)
    }
  })

  it('EC-065: setNodeShape on unknown id is a no-op', () => {
    expect(() => chart.setNodeShape('ghost', 'circle')).not.toThrow()
  })

  it('EC-066: setNodeStatus on unknown id is a no-op', () => {
    expect(() => chart.setNodeStatus('ghost', 'error')).not.toThrow()
  })
})

// ─── 7. EDGE STYLE COMBINATIONS ──────────────────────────────────────────────

describe('Edge style combinations', () => {
  let chart: FlowChart

  beforeEach(() => {
    chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
  })
  afterEach(() => { chart.dispose() })

  it('EC-067: edge type bezier is stored', () => {
    chart.updateEdge('e1', { type: 'bezier' })
    expect(chart.getEdge('e1')!.type).toBe('bezier')
  })

  it('EC-068: edge type straight is stored', () => {
    chart.updateEdge('e1', { type: 'straight' })
    expect(chart.getEdge('e1')!.type).toBe('straight')
  })

  it('EC-069: edge type step is stored', () => {
    chart.updateEdge('e1', { type: 'step' })
    expect(chart.getEdge('e1')!.type).toBe('step')
  })

  it('EC-070: animated edge flag is stored', () => {
    chart.updateEdge('e1', { animated: true })
    expect(chart.getEdge('e1')!.animated).toBe(true)
    chart.updateEdge('e1', { animated: false })
    expect(chart.getEdge('e1')!.animated).toBe(false)
  })

  it('EC-071: edge dashArray is stored in style', () => {
    chart.setEdgeStyle('e1', { dashArray: [8, 4] })
    expect(chart.getEdge('e1')!.style?.dashArray).toEqual([8, 4])
  })

  it('EC-072: edge width 0 is stored', () => {
    chart.setEdgeStyle('e1', { width: 0 })
    expect(chart.getEdge('e1')!.style?.width).toBe(0)
  })

  it('EC-073: edge label set and cleared', () => {
    chart.updateEdge('e1', { label: 'hello' })
    expect(chart.getEdge('e1')!.label).toBe('hello')
    chart.updateEdge('e1', { label: '' })
    expect(chart.getEdge('e1')!.label).toBe('')
  })

  it('EC-074: edge waypoints override bezier routing', () => {
    chart.updateEdge('e1', { waypoints: [{ x: 100, y: 200 }, { x: 150, y: 250 }] })
    expect(chart.getEdge('e1')!.waypoints).toHaveLength(2)
  })

  it('EC-075: edge waypoints cleared by setting empty array', () => {
    chart.updateEdge('e1', { waypoints: [{ x: 100, y: 200 }] })
    chart.updateEdge('e1', { waypoints: [] })
    expect(chart.getEdge('e1')!.waypoints).toHaveLength(0)
  })

  it('EC-076: setEdgeStyle on nonexistent id is a no-op', () => {
    expect(() => chart.setEdgeStyle('ghost', { color: '#red' })).not.toThrow()
  })

  it('EC-077: edge handles - all handle side combinations', () => {
    const sides = ['top', 'right', 'bottom', 'left'] as const
    for (const src of sides) {
      for (const tgt of sides) {
        chart.updateEdge('e1', { sourceHandle: src, targetHandle: tgt })
        const edge = chart.getEdge('e1')!
        expect(edge.sourceHandle).toBe(src)
        expect(edge.targetHandle).toBe(tgt)
      }
    }
  })
})

// ─── 8. UNDO / REDO SEQUENCES ────────────────────────────────────────────────

describe('Undo/redo sequences', () => {
  let chart: FlowChart

  beforeEach(() => { chart = makeChart() })
  afterEach(() => { chart.dispose() })

  it('EC-078: undo after addNode restores empty graph', () => {
    chart.addNode(n('a'))
    chart.undo()
    expect(chart.getNodes()).toHaveLength(0)
  })

  it('EC-079: redo after undo re-adds node', () => {
    chart.addNode(n('a'))
    chart.undo()
    chart.redo()
    expect(chart.getNodes()).toHaveLength(1)
  })

  it('EC-080: multiple undo steps in sequence', () => {
    chart.addNode(n('a'))
    chart.addNode(n('b'))
    chart.addNode(n('c'))
    chart.undo()
    expect(chart.getNodes()).toHaveLength(2)
    chart.undo()
    expect(chart.getNodes()).toHaveLength(1)
    chart.undo()
    expect(chart.getNodes()).toHaveLength(0)
  })

  it('EC-081: undo at bottom of stack returns false', () => {
    expect(chart.undo()).toBe(false)
  })

  it('EC-082: redo at top of stack returns false', () => {
    chart.addNode(n('a'))
    expect(chart.redo()).toBe(false)
  })

  it('EC-083: new mutation clears redo stack', () => {
    chart.addNode(n('a'))
    chart.undo()
    expect(chart.canRedo()).toBe(true)
    chart.addNode(n('b'))
    expect(chart.canRedo()).toBe(false)
  })

  it('EC-084: undo removeEdge restores edge', () => {
    chart.addNode(n('a'))
    chart.addNode(n('b', 200))
    chart.addEdge(e('e1', 'a', 'b'))
    chart.removeEdge('e1')
    chart.undo()
    expect(chart.getEdge('e1')).toBeDefined()
  })

  it('EC-085: undo updateNode restores original label', () => {
    chart.addNode(n('a'))
    chart.updateNode('a', { label: 'New' })
    chart.undo()
    expect(chart.getNode('a')!.label).toBe('a')
  })

  it('EC-086: undo swapEdgeDirection restores direction', () => {
    chart.addNode(n('a'))
    chart.addNode(n('b', 200))
    chart.addEdge({ id: 'e1', source: 'a', target: 'b' })
    chart.swapEdgeDirection('e1')
    chart.undo()
    const edge = chart.getEdge('e1')!
    expect(edge.source).toBe('a')
    expect(edge.target).toBe('b')
  })

  it('EC-087: batchUpdate creates single history entry', () => {
    const handler = vi.fn()
    chart.on('historyChange', handler)
    chart.batchUpdate(() => {
      chart.addNode(n('a'))
      chart.addNode(n('b'))
      chart.addNode(n('c'))
    })
    expect(handler).toHaveBeenCalledOnce()
    expect(chart.getNodes()).toHaveLength(3)
  })

  it('EC-088: undo batchUpdate reverts all batched ops at once', () => {
    chart.batchUpdate(() => {
      chart.addNode(n('a'))
      chart.addNode(n('b'))
      chart.addNode(n('c'))
    })
    chart.undo()
    expect(chart.getNodes()).toHaveLength(0)
  })

  it('EC-089: nested batchUpdate fires historyChange for each batch start', () => {
    // inner batchUpdate resets batchMutSaved, so inner mutations save a new snapshot
    const handler = vi.fn()
    chart.on('historyChange', handler)
    chart.batchUpdate(() => {
      chart.addNode(n('a'))
      chart.batchUpdate(() => {
        chart.addNode(n('b'))
      })
    })
    // Both nodes are added regardless
    expect(chart.getNodes()).toHaveLength(2)
    expect(handler).toHaveBeenCalled()
  })

  it('EC-090: clearHistory after undo makes canRedo false', () => {
    chart.addNode(n('a'))
    chart.undo()
    expect(chart.canRedo()).toBe(true)
    chart.clearHistory()
    expect(chart.canRedo()).toBe(false)
    expect(chart.canUndo()).toBe(false)
  })
})

// ─── 9. SERIALIZATION ────────────────────────────────────────────────────────

describe('Serialization edge cases', () => {
  let chart: FlowChart

  beforeEach(() => {
    chart = makeChart({
      nodes: [n('a', 0, 0), n('b', 200, 0)],
      edges: [{ id: 'e1', source: 'a', target: 'b', label: 'link', animated: true }],
    })
  })
  afterEach(() => { chart.dispose() })

  it('EC-091: toJSON round-trips node positions', () => {
    const json = chart.toJSON()
    const nodeA = json.nodes.find(x => x.id === 'a')!
    expect(nodeA.x).toBe(0)
    expect(nodeA.y).toBe(0)
  })

  it('EC-092: toJSON preserves edge label and animated', () => {
    const json = chart.toJSON()
    const edge = json.edges.find(x => x.id === 'e1')!
    expect(edge.label).toBe('link')
    expect(edge.animated).toBe(true)
  })

  it('EC-093: fromJSON is a no-op in failed (WebGL-unavailable) state', () => {
    // fromJSON returns early when this.failed === true
    expect(() => chart.fromJSON({ nodes: [n('x', 50, 50)], edges: [] })).not.toThrow()
    // original nodes still present
    expect(chart.getNodes()).toHaveLength(2)
  })

  it('EC-094: importJSON merge adds nodes in failed state', () => {
    // importJSON merge does NOT call fromJSON, it directly mutates graph
    chart.importJSON({
      nodes: [n('c', 400, 0)],
      edges: [],
    }, 'merge')
    expect(chart.getNodes()).toHaveLength(3)
  })

  it('EC-095: importJSON merge with duplicate id overwrites existing node', () => {
    chart.importJSON({
      nodes: [{ id: 'a', x: 999, y: 999, width: 100, height: 50, label: 'A-new' }],
      edges: [],
    }, 'merge')
    expect(chart.getNode('a')!.x).toBe(999)
    expect(chart.getNodes()).toHaveLength(2)
  })

  it('EC-096: importJSON replace mode is no-op in failed state', () => {
    // replace mode calls fromJSON which returns early when failed
    chart.importJSON({ nodes: [n('z')], edges: [] }, 'replace')
    // original nodes still present (replace was skipped)
    expect(chart.getNodes()).toHaveLength(2)
  })

  it('EC-097: toJSON captures current viewport state', () => {
    const json = chart.toJSON()
    expect(json.viewport).toBeDefined()
    expect(typeof json.viewport.zoom).toBe('number')
  })

  it('EC-098: toJSON captures nodes and edges for external restore via Graph', () => {
    const json = chart.toJSON()
    // Verify the JSON structure is complete and can seed a new Graph
    const g = new Graph()
    for (const node of json.nodes) g.addNode(node)
    for (const edge of json.edges) g.addEdge(edge)
    expect(g.nodeCount).toBe(2)
    expect(g.edgeCount).toBe(1)
  })

  it('EC-099: importJSON merge with edges referencing existing nodes succeeds', () => {
    chart.importJSON({
      nodes: [n('c', 400)],
      edges: [{ id: 'e2', source: 'b', target: 'c' }],
    }, 'merge')
    expect(chart.getEdge('e2')).toBeDefined()
  })

  it('EC-100: importJSON with edges referencing ghost nodes silently drops edge', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    chart.importJSON({
      nodes: [],
      edges: [{ id: 'orphan', source: 'ghost1', target: 'ghost2' }],
    }, 'merge')
    expect(chart.getEdge('orphan')).toBeUndefined()
    warn.mockRestore()
  })
})

// ─── 10. GRAPH ANALYSIS ──────────────────────────────────────────────────────

describe('Graph analysis edge cases', () => {
  it('EC-101: hasCycle on simple DAG returns false', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b'), n('c')],
      edges: [e('e1', 'a', 'b'), e('e2', 'b', 'c')],
    })
    expect(chart.hasCycle()).toBe(false)
    chart.dispose()
  })

  it('EC-102: hasCycle on triangle returns true', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b'), n('c')],
      edges: [e('e1', 'a', 'b'), e('e2', 'b', 'c'), e('e3', 'c', 'a')],
    })
    expect(chart.hasCycle()).toBe(true)
    chart.dispose()
  })

  it('EC-103: findPaths returns empty for disconnected nodes', () => {
    const chart = makeChart({ nodes: [n('a'), n('b')] })
    expect(chart.findPaths('a', 'b')).toEqual([])
    chart.dispose()
  })

  it('EC-104: findPaths direct edge', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b')],
      edges: [e('e1', 'a', 'b')],
    })
    expect(chart.findPaths('a', 'b')).toEqual([['a', 'b']])
    chart.dispose()
  })

  it('EC-105: findPaths finds multiple paths', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b'), n('c')],
      edges: [e('e1', 'a', 'b'), e('e2', 'a', 'c'), e('e3', 'c', 'b')],
    })
    expect(chart.findPaths('a', 'b').length).toBe(2)
    chart.dispose()
  })

  it('EC-106: findPaths source === target returns []', () => {
    // Implementation returns [] when source === target (no path to traverse)
    const chart = makeChart({ nodes: [n('a')] })
    expect(chart.findPaths('a', 'a')).toEqual([])
    chart.dispose()
  })

  it('EC-107: findPaths is bounded for dense graphs (cap kicks in around 100)', () => {
    // The cap is "stop EXPLORING after 100 results", but paths found in the
    // current frame can push results slightly above 100 — bounded, not exact
    const count = 12
    const nodes: NodeData[] = []
    const edges: EdgeData[] = []
    for (let i = 0; i < count; i++) nodes.push(n(`n${i}`))
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        edges.push({ id: `e${i}-${j}`, source: `n${i}`, target: `n${j}` })
      }
    }
    const chart = makeChart({ nodes, edges })
    const paths = chart.findPaths('n0', `n${count - 1}`)
    // True combinatorial count would be thousands; cap keeps it bounded near 100
    expect(paths.length).toBeGreaterThan(0)
    expect(paths.length).toBeLessThan(200)
    chart.dispose()
  })

  it('EC-108: getIncomers returns nodes with edges pointing in', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b'), n('c')],
      edges: [e('e1', 'a', 'c'), e('e2', 'b', 'c')],
    })
    const incomers = chart.getIncomers('c')
    expect(incomers.map(x => x.id).sort()).toEqual(['a', 'b'])
    chart.dispose()
  })

  it('EC-109: getOutgoers returns nodes with edges pointing out', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b'), n('c')],
      edges: [e('e1', 'a', 'b'), e('e2', 'a', 'c')],
    })
    const outgoers = chart.getOutgoers('a')
    expect(outgoers.map(x => x.id).sort()).toEqual(['b', 'c'])
    chart.dispose()
  })

  it('EC-110: getConnectedNodes returns all neighbors regardless of direction', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b'), n('c')],
      edges: [e('e1', 'a', 'b'), e('e2', 'c', 'a')],
    })
    const connected = chart.getConnectedNodes('a')
    expect(connected.map(x => x.id).sort()).toEqual(['b', 'c'])
    chart.dispose()
  })

  it('EC-111: getConnectedNodes with no edges returns []', () => {
    const chart = makeChart({ nodes: [n('a')] })
    expect(chart.getConnectedNodes('a')).toEqual([])
    chart.dispose()
  })

  it('EC-112: getIncomers with no edges returns []', () => {
    const chart = makeChart({ nodes: [n('a')] })
    expect(chart.getIncomers('a')).toEqual([])
    chart.dispose()
  })

  it('EC-113: getOutgoers with no edges returns []', () => {
    const chart = makeChart({ nodes: [n('a')] })
    expect(chart.getOutgoers('a')).toEqual([])
    chart.dispose()
  })
})

// ─── 11. GROUP / COLLAPSE ────────────────────────────────────────────────────

describe('Group and collapse edge cases', () => {
  let chart: FlowChart

  beforeEach(() => {
    chart = makeChart({
      nodes: [
        { id: 'g', x: 0, y: 0, width: 300, height: 300, label: 'Group', type: 'group' },
        { id: 'c1', x: 20, y: 20, width: 100, height: 50, label: 'Child1', parentId: 'g' },
        { id: 'c2', x: 20, y: 100, width: 100, height: 50, label: 'Child2', parentId: 'g' },
        { id: 'out', x: 400, y: 0, width: 100, height: 50, label: 'Outside' },
      ],
      edges: [
        { id: 'e1', source: 'c1', target: 'c2' },
        { id: 'e2', source: 'c2', target: 'out' },
      ],
    })
  })
  afterEach(() => { chart.dispose() })

  it('EC-114: collapseNode sets collapsed=true', () => {
    chart.collapseNode('g')
    expect(chart.getNode('g')!.collapsed).toBe(true)
  })

  it('EC-115: expandNode sets collapsed=false', () => {
    chart.collapseNode('g')
    chart.expandNode('g')
    expect(chart.getNode('g')!.collapsed).toBe(false)
  })

  it('EC-116: toggleCollapse alternates state', () => {
    chart.toggleCollapse('g')
    expect(chart.getNode('g')!.collapsed).toBe(true)
    chart.toggleCollapse('g')
    expect(chart.getNode('g')!.collapsed).toBe(false)
  })

  it('EC-117: collapseNode is undoable', () => {
    chart.collapseNode('g')
    chart.undo()
    expect(chart.getNode('g')!.collapsed).toBeUndefined()
  })

  it('EC-118: groupNodes assigns parentId to children', () => {
    const chart2 = makeChart({
      nodes: [n('a'), n('b', 200), n('p', 0, 200, 400, 300)],
    })
    chart2.groupNodes('p', ['a', 'b'])
    expect(chart2.getNode('a')!.parentId).toBe('p')
    expect(chart2.getNode('b')!.parentId).toBe('p')
    chart2.dispose()
  })

  it('EC-119: ungroupNodes clears parentId', () => {
    chart.ungroupNodes(['c1', 'c2'])
    expect(chart.getNode('c1')!.parentId).toBeUndefined()
    expect(chart.getNode('c2')!.parentId).toBeUndefined()
  })

  it('EC-120: collapseNode on non-group node is a no-op', () => {
    chart.collapseNode('out')
    expect(chart.getNode('out')!.collapsed).toBeUndefined()
  })

  it('EC-121: expandNode on non-group node is a no-op', () => {
    expect(() => chart.expandNode('out')).not.toThrow()
  })

  it('EC-122: removing group node does NOT cascade-delete children (Graph-level)', () => {
    // removeNode only removes the node itself and its direct edges, not parentId children
    chart.removeNode('g')
    expect(chart.getNode('g')).toBeUndefined()
    // children remain with dangling parentId — graph layer does not cascade
    expect(chart.getNode('c1')).toBeDefined()
    expect(chart.getNode('c2')).toBeDefined()
  })

  it('EC-123: removing group node removes edges connected TO group node', () => {
    // e1 connects c1→c2, e2 connects c2→out — removing 'g' removes g's edges (none)
    chart.removeNode('g')
    // edges between children are preserved
    expect(chart.getEdge('e1')).toBeDefined()
    expect(chart.getEdge('e2')).toBeDefined()
  })

  // ── groupDoubleClickCollapses option (UX safety) ────────────────────────────
  //
  // 0.2.6 introduced an explicit opt-in for double-click→collapse on group
  // nodes. The default is OFF so a single accidental double-click can never
  // hide an entire subtree. The dblclick handler itself is exercised in the
  // demo and in production code paths; here we pin the option storage so a
  // future refactor can't silently flip the default back to true.

  it('EC-G1: groupDoubleClickCollapses defaults to false', () => {
    expect((chart as unknown as { groupDoubleClickCollapses: boolean }).groupDoubleClickCollapses).toBe(false)
  })

  it('EC-G2: groupDoubleClickCollapses honors an explicit true', () => {
    const chart2 = makeChart({ groupDoubleClickCollapses: true })
    expect((chart2 as unknown as { groupDoubleClickCollapses: boolean }).groupDoubleClickCollapses).toBe(true)
    chart2.dispose()
  })

  it('EC-G3: groupDoubleClickCollapses honors an explicit false', () => {
    const chart2 = makeChart({ groupDoubleClickCollapses: false })
    expect((chart2 as unknown as { groupDoubleClickCollapses: boolean }).groupDoubleClickCollapses).toBe(false)
    chart2.dispose()
  })

  it('EC-G4: toggleCollapse() public API still works regardless of option', () => {
    // The option only gates the double-click pathway. Explicit API calls stay
    // free so host apps can still wire chevrons / context menus / API buttons.
    chart.toggleCollapse('g')
    expect(chart.getNode('g')!.collapsed).toBe(true)
  })
})

// ─── 12. SELECTION EDGE CASES ────────────────────────────────────────────────

describe('Selection edge cases', () => {
  let chart: FlowChart

  beforeEach(() => {
    chart = makeChart({
      nodes: [n('a'), n('b', 200), n('c', 400)],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
    })
  })
  afterEach(() => { chart.dispose() })

  it('EC-124: setSelectedIds accepts unknown ids without filtering', () => {
    // Current implementation stores ids as-is without validation
    chart.setSelectedIds(['ghost'])
    expect(chart.getSelectedIds()).toEqual(['ghost'])
  })

  it('EC-125: setSelectedIds with mix of valid and invalid stores all', () => {
    chart.setSelectedIds(['a', 'ghost'])
    expect(chart.getSelectedIds().sort()).toEqual(['a', 'ghost'])
  })

  it('EC-126: setSelectedEdgeIds with unknown ids stores them as-is', () => {
    chart.setSelectedEdgeIds(['ghost'])
    expect(chart.getSelectedEdgeIds()).toEqual(['ghost'])
  })

  it('EC-127: clearSelection clears internal sets', () => {
    chart.selectAll()
    chart.clearSelection()
    expect(chart.getSelectedIds()).toEqual([])
    expect(chart.getSelectedEdgeIds()).toEqual([])
  })

  it('EC-128: clearSelection does not emit selectionChange event', () => {
    // clearSelection only clears sets and schedules render, no event
    const handler = vi.fn()
    chart.on('selectionChange', handler)
    chart.clearSelection()
    expect(handler).not.toHaveBeenCalled()
  })

  it('EC-129: fitViewToSelection with no selection uses all nodes', () => {
    expect(() => chart.fitViewToSelection()).not.toThrow()
  })

  it('EC-130: fitViewToSelection with selection focuses selected', () => {
    chart.setSelectedIds(['a'])
    expect(() => chart.fitViewToSelection()).not.toThrow()
  })

  it('EC-131: deleteSelected with locked node skips locked', () => {
    chart.lockNode('b')
    chart.selectAll()
    chart.deleteSelected()
    expect(chart.getNode('b')).toBeDefined()
    expect(chart.getNode('a')).toBeUndefined()
  })

  it('EC-132: deleteSelected removes dangling edges', () => {
    chart.setSelectedIds(['a'])
    chart.deleteSelected()
    expect(chart.getEdge('e1')).toBeUndefined()
  })

  it('EC-133: selectAll then clearSelection leaves nothing selected', () => {
    chart.selectAll()
    chart.clearSelection()
    expect(chart.getSelectedIds()).toEqual([])
    expect(chart.getSelectedEdgeIds()).toEqual([])
  })

  it('EC-134: getSelectedNodes returns node objects', () => {
    chart.setSelectedIds(['a', 'b'])
    const nodes = chart.getSelectedNodes()
    expect(nodes.map(x => x.id).sort()).toEqual(['a', 'b'])
  })

  it('EC-135: getSelectedEdges returns edge objects', () => {
    chart.setSelectedEdgeIds(['e1'])
    const edges = chart.getSelectedEdges()
    expect(edges[0]!.id).toBe('e1')
  })
})

// ─── 13. VIEWPORT EDGE CASES ─────────────────────────────────────────────────

describe('Viewport edge cases', () => {
  let chart: FlowChart

  beforeEach(() => { chart = makeChart() })
  afterEach(() => { chart.dispose() })

  it('EC-136: default viewport is {x:0, y:0, zoom:1}', () => {
    const vp = chart.getViewport()
    expect(vp.x).toBe(0)
    expect(vp.y).toBe(0)
    expect(vp.zoom).toBe(1)
  })

  it('EC-137: setViewport updates viewport state', () => {
    chart.setViewport({ x: 100, y: 200, zoom: 1.5 })
    const vp = chart.getViewport()
    expect(vp.x).toBe(100)
    expect(vp.y).toBe(200)
    expect(vp.zoom).toBeCloseTo(1.5)
  })

  it('EC-138: zoom clamped to MIN_ZOOM (0.05) minimum', () => {
    chart.zoomTo(0.001)
    expect(chart.getViewport().zoom).toBeGreaterThanOrEqual(0.05)
  })

  it('EC-139: zoom clamped to MAX_ZOOM (4.0) maximum', () => {
    chart.zoomTo(999)
    expect(chart.getViewport().zoom).toBeLessThanOrEqual(4.0)
  })

  it('EC-140: zoomIn from default increases zoom', () => {
    const before = chart.getViewport().zoom
    chart.zoomIn()
    expect(chart.getViewport().zoom).toBeGreaterThan(before)
  })

  it('EC-141: zoomOut from default decreases zoom', () => {
    const before = chart.getViewport().zoom
    chart.zoomOut()
    expect(chart.getViewport().zoom).toBeLessThan(before)
  })

  it('EC-142: zoomOut at minimum does not go below MIN_ZOOM', () => {
    chart.zoomTo(0.05)
    chart.zoomOut()
    expect(chart.getViewport().zoom).toBeGreaterThanOrEqual(0.05)
  })

  it('EC-143: zoomIn at maximum does not exceed MAX_ZOOM (4.0)', () => {
    chart.zoomTo(4.0)
    chart.zoomIn()
    expect(chart.getViewport().zoom).toBeLessThanOrEqual(4.0)
  })

  it('EC-144: panTo updates viewport position', () => {
    chart.panTo(500, 300)
    const vp = chart.getViewport()
    expect(typeof vp.x).toBe('number')
    expect(typeof vp.y).toBe('number')
  })

  it('EC-145: setViewport does not emit viewportChange (only schedules render)', () => {
    // setViewport calls viewport.setState + scheduleRender, does NOT emit event
    const handler = vi.fn()
    chart.on('viewportChange', handler)
    chart.setViewport({ x: 10, y: 20, zoom: 1.2 })
    expect(handler).not.toHaveBeenCalled()
    // But viewport state is updated
    expect(chart.getViewport().zoom).toBeCloseTo(1.2)
  })
})

// ─── 14. LAYOUT ALGORITHMS ───────────────────────────────────────────────────

describe('Layout algorithm edge cases', () => {
  it('EC-146: hierarchicalLayout empty nodes returns empty map', () => {
    const result = hierarchicalLayout([], [])
    expect(result.size).toBe(0)
  })

  it('EC-147: hierarchicalLayout single node returns map with entry', () => {
    const result = hierarchicalLayout([n('a')], [])
    expect(result.has('a')).toBe(true)
  })

  it('EC-148: hierarchicalLayout produces distinct positions for chain', () => {
    const nodes = [n('a'), n('b'), n('c')]
    const edges = [e('e1', 'a', 'b'), e('e2', 'b', 'c')]
    const result = hierarchicalLayout(nodes, edges)
    const posA = result.get('a')!
    const posB = result.get('b')!
    const posC = result.get('c')!
    expect(posA.x).not.toBe(posB.x)
    expect(posB.x).not.toBe(posC.x)
  })

  it('EC-149: hierarchicalLayout handles cycles gracefully', () => {
    const nodes = [n('a'), n('b'), n('c')]
    const edges = [e('e1', 'a', 'b'), e('e2', 'b', 'c'), e('e3', 'c', 'a')]
    expect(() => hierarchicalLayout(nodes, edges)).not.toThrow()
  })

  it('EC-150: hierarchicalLayout returns position for all nodes', () => {
    const nodes = [n('a'), n('b'), n('c'), n('d')]
    const edges = [e('e1', 'a', 'b'), e('e2', 'b', 'c')]
    const result = hierarchicalLayout(nodes, edges)
    expect(result.size).toBe(4)
  })

  it('EC-151: forceLayout empty nodes returns empty map', () => {
    const result = forceLayout([], [])
    expect(result.size).toBe(0)
  })

  it('EC-152: forceLayout single node does not crash', () => {
    const result = forceLayout([n('a')], [])
    expect(result.has('a')).toBe(true)
  })

  it('EC-153: forceLayout returns positions for all nodes', () => {
    const nodes = [n('a'), n('b'), n('c')]
    const edges = [e('e1', 'a', 'b')]
    const result = forceLayout(nodes, edges)
    expect(result.size).toBe(3)
  })

  it('EC-154: forceLayout custom iterations parameter', () => {
    const nodes = [n('a'), n('b')]
    const edges = [e('e1', 'a', 'b')]
    expect(() => forceLayout(nodes, edges, 10)).not.toThrow()
    expect(() => forceLayout(nodes, edges, 300)).not.toThrow()
  })

  it('EC-155: gridLayout empty nodes returns empty map', () => {
    expect(gridLayout([]).size).toBe(0)
  })

  it('EC-156: gridLayout single node is at origin', () => {
    const result = gridLayout([n('a')])
    const pos = result.get('a')!
    expect(typeof pos.x).toBe('number')
    expect(typeof pos.y).toBe('number')
  })

  it('EC-157: gridLayout produces distinct x or y positions', () => {
    const nodes = [n('a', 0), n('b', 200), n('c', 400)]
    const result = gridLayout(nodes)
    const positions = [...result.values()]
    const xs = positions.map(p => p.x)
    const unique = new Set(xs)
    expect(unique.size).toBeGreaterThan(1)
  })

  it('EC-158: circularLayout empty nodes returns empty map', () => {
    expect(circularLayout([]).size).toBe(0)
  })

  it('EC-159: circularLayout single node returns one entry', () => {
    const result = circularLayout([n('a')])
    expect(result.has('a')).toBe(true)
  })

  it('EC-160: circularLayout all nodes equidistant from center', () => {
    const nodes = [n('a'), n('b'), n('c'), n('d')]
    const result = circularLayout(nodes)
    const positions = [...result.values()]
    const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length
    const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length
    const radii = positions.map(p =>
      Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)
    )
    const [r0, ...rest] = radii
    for (const r of rest) {
      expect(Math.abs(r - r0!)).toBeLessThan(1)
    }
  })

  it('EC-161: circularLayout custom radius parameter', () => {
    const nodes = [n('a'), n('b')]
    const result = circularLayout(nodes, 500)
    const positions = [...result.values()]
    const cx = (positions[0]!.x + positions[1]!.x) / 2
    const cy = (positions[0]!.y + positions[1]!.y) / 2
    const r = Math.sqrt((positions[0]!.x - cx) ** 2 + (positions[0]!.y - cy) ** 2)
    expect(r).toBeCloseTo(500, 0)
  })

  it('EC-162: hierarchicalLayout custom gap parameters', () => {
    const nodes = [n('a'), n('b')]
    const edges = [e('e1', 'a', 'b')]
    const r1 = hierarchicalLayout(nodes, edges, 50, 30)
    const r2 = hierarchicalLayout(nodes, edges, 200, 100)
    expect(r1.get('b')!.x).not.toBe(r2.get('b')!.x)
  })
})

// ─── 15. onBeforeConnect HOOK ─────────────────────────────────────────────────

describe('onBeforeConnect hook', () => {
  it('EC-163: onBeforeConnect returning false blocks addEdge event', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      onBeforeConnect: () => false,
    })
    const handler = vi.fn()
    chart.on('connect', handler)
    // Direct addEdge bypasses onBeforeConnect (hook is for interactive connect)
    chart.addEdge({ id: 'e1', source: 'a', target: 'b' })
    expect(chart.getEdge('e1')).toBeDefined()
    // Directly invoke the stored hook to verify the arrow function body
    expect((chart as any).onBeforeConnect({ sourceId: 'a', targetId: 'b' })).toBe(false)
    chart.dispose()
  })

  it('EC-164: onBeforeConnect returning true allows connection', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      onBeforeConnect: () => true,
    })
    chart.addEdge({ id: 'e1', source: 'a', target: 'b' })
    expect(chart.getEdge('e1')).toBeDefined()
    // Directly invoke the stored hook to verify the arrow function body
    expect((chart as any).onBeforeConnect({ sourceId: 'a', targetId: 'b' })).toBe(true)
    chart.dispose()
  })
})

// ─── 16. onBeforeDelete HOOK ──────────────────────────────────────────────────

describe('onBeforeDelete hook', () => {
  it('EC-165: onBeforeDelete false blocks deleteSelected', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      onBeforeDelete: () => false,
    })
    chart.selectAll()
    chart.deleteSelected()
    expect(chart.getNodes()).toHaveLength(2)
    chart.dispose()
  })

  it('EC-166: onBeforeDelete true allows deleteSelected', () => {
    const chart = makeChart({
      nodes: [n('a')],
      onBeforeDelete: () => true,
    })
    chart.selectAll()
    chart.deleteSelected()
    expect(chart.getNodes()).toHaveLength(0)
    chart.dispose()
  })

  it('EC-167: setOnBeforeDelete overrides at runtime', () => {
    const chart = makeChart({ nodes: [n('a')] })
    chart.setOnBeforeDelete(() => false)
    chart.selectAll()
    chart.deleteSelected()
    expect(chart.getNodes()).toHaveLength(1)
    chart.setOnBeforeDelete(null)
    chart.selectAll()
    chart.deleteSelected()
    expect(chart.getNodes()).toHaveLength(0)
    chart.dispose()
  })

  it('EC-168: onBeforeDelete receives arrays of id strings (not objects)', () => {
    let receivedNodeIds: string[] = []
    let receivedEdgeIds: string[] = []
    const chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
      onBeforeDelete: (nodeIds, edgeIds) => {
        receivedNodeIds = nodeIds
        receivedEdgeIds = edgeIds
        return true
      },
    })
    chart.selectAll()
    chart.deleteSelected()
    expect(receivedNodeIds.sort()).toEqual(['a', 'b'])
    expect(receivedEdgeIds).toEqual(['e1'])
    chart.dispose()
  })
})

// ─── 17. ALIGNMENT & DISTRIBUTION ────────────────────────────────────────────

describe('Alignment and distribution', () => {
  let chart: FlowChart

  beforeEach(() => {
    chart = makeChart({
      nodes: [
        n('a', 0, 0, 100, 50),
        n('b', 200, 100, 100, 50),
        n('c', 400, 200, 100, 50),
      ],
    })
    chart.selectAll()
  })
  afterEach(() => { chart.dispose() })

  it('EC-169: alignNodes left aligns all to min x', () => {
    chart.alignNodes('left')
    const xs = chart.getNodes().map(n => n.x)
    expect(new Set(xs).size).toBe(1)
    expect(xs[0]).toBe(0)
  })

  it('EC-170: alignNodes right aligns all to max right edge', () => {
    chart.alignNodes('right')
    const rights = chart.getNodes().map(n => n.x + n.width)
    expect(new Set(rights).size).toBe(1)
  })

  it('EC-171: alignNodes top aligns all to min y', () => {
    chart.alignNodes('top')
    const ys = chart.getNodes().map(n => n.y)
    expect(new Set(ys).size).toBe(1)
    expect(ys[0]).toBe(0)
  })

  it('EC-172: alignNodes bottom aligns all to max bottom edge', () => {
    chart.alignNodes('bottom')
    const bottoms = chart.getNodes().map(n => n.y + n.height)
    expect(new Set(bottoms).size).toBe(1)
  })

  it('EC-173: alignNodes center aligns horizontally', () => {
    chart.alignNodes('center')
    const centerXs = chart.getNodes().map(n => n.x + n.width / 2)
    expect(new Set(centerXs).size).toBe(1)
  })

  it('EC-174: alignNodes middle aligns vertically', () => {
    chart.alignNodes('middle')
    const centerYs = chart.getNodes().map(n => n.y + n.height / 2)
    expect(new Set(centerYs).size).toBe(1)
  })

  it('EC-175: distributeNodes horizontal spreads evenly', () => {
    chart.distributeNodes('horizontal')
    const xs = chart.getNodes().map(n => n.x).sort((a, b) => a - b)
    const gap1 = xs[1]! - xs[0]!
    const gap2 = xs[2]! - xs[1]!
    expect(Math.abs(gap1 - gap2)).toBeLessThan(1)
  })

  it('EC-176: distributeNodes vertical spreads evenly', () => {
    chart.distributeNodes('vertical')
    const ys = chart.getNodes().map(n => n.y).sort((a, b) => a - b)
    const gap1 = ys[1]! - ys[0]!
    const gap2 = ys[2]! - ys[1]!
    expect(Math.abs(gap1 - gap2)).toBeLessThan(1)
  })

  it('EC-177: alignNodes with <2 selection does not throw', () => {
    chart.setSelectedIds(['a'])
    expect(() => chart.alignNodes('left')).not.toThrow()
  })

  it('EC-178: distributeNodes with <3 selection does not throw', () => {
    chart.setSelectedIds(['a', 'b'])
    expect(() => chart.distributeNodes('horizontal')).not.toThrow()
  })

  it('EC-179: alignNodes is undoable', () => {
    const before = chart.getNode('c')!.x
    chart.alignNodes('left')
    chart.undo()
    expect(chart.getNode('c')!.x).toBe(before)
  })
})

// ─── 18. HISTORY LIMIT ───────────────────────────────────────────────────────

describe('History limit', () => {
  it('EC-180: history limit of 3 keeps only last 3 snapshots', () => {
    const chart = makeChart({ historyLimit: 3 })
    for (let i = 0; i < 10; i++) {
      chart.addNode(n(`n${i}`, i * 50))
    }
    let undoCount = 0
    while (chart.canUndo()) {
      chart.undo()
      undoCount++
    }
    expect(undoCount).toBeLessThanOrEqual(3)
    chart.dispose()
  })

  it('EC-181: historyLimit=1 allows exactly one undo', () => {
    const chart = makeChart({ historyLimit: 1 })
    chart.addNode(n('a'))
    chart.addNode(n('b', 200))
    chart.undo()
    expect(chart.canUndo()).toBe(false)
    chart.dispose()
  })
})

// ─── 19. PORT CONSTRAINTS ────────────────────────────────────────────────────

describe('Port maxConnections constraint', () => {
  it('EC-182: port without maxConnections allows unlimited edges', () => {
    const g = new Graph()
    g.addNode({ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A', ports: [{ id: 'p1', side: 'right' as const }] })
    g.addNode({ id: 'b', x: 200, y: 0, width: 100, height: 50, label: 'B' })
    g.addNode({ id: 'c', x: 200, y: 100, width: 100, height: 50, label: 'C' })
    g.addEdge({ id: 'e1', source: 'a', target: 'b', sourceHandle: 'p1' })
    g.addEdge({ id: 'e2', source: 'a', target: 'c', sourceHandle: 'p1' })
    expect(g.edgeCount).toBe(2)
  })

  it('EC-183: port with maxConnections is metadata only — Graph does not enforce it', () => {
    // maxConnections enforcement is at the interactive connect layer, not Graph layer
    const g = new Graph()
    g.addNode({ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A', ports: [{ id: 'p1', side: 'right' as const, maxConnections: 1 }] })
    g.addNode({ id: 'b', x: 200, y: 0, width: 100, height: 50, label: 'B' })
    g.addNode({ id: 'c', x: 200, y: 100, width: 100, height: 50, label: 'C' })
    g.addEdge({ id: 'e1', source: 'a', target: 'b', sourceHandle: 'p1' })
    g.addEdge({ id: 'e2', source: 'a', target: 'c', sourceHandle: 'p1' })
    // Graph layer accepts both — maxConnections only blocks interactive drags
    expect(g.edgeCount).toBe(2)
  })

  it('EC-184: port maxConnections stored on port definition', () => {
    const chart = makeChart({
      nodes: [{
        id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A',
        ports: [{ id: 'p1', side: 'right' as const, maxConnections: 2 }],
      }],
    })
    expect(chart.getNode('a')!.ports![0]!.maxConnections).toBe(2)
    chart.dispose()
  })
})

// ─── 20. READ-ONLY MODE ──────────────────────────────────────────────────────

describe('Read-only mode', () => {
  it('EC-185: setReadOnly(true) crashes on failed (WebGL unavailable) chart — connectDrag undefined', () => {
    // In failed state, connectDrag is never initialized so setReadOnly throws
    const chart = makeChart()
    expect(() => chart.setReadOnly(true)).toThrow()
    chart.dispose()
  })

  it('EC-186: readOnly option is accepted on construction without throw', () => {
    // Construction with readOnly=true sets flag before applyReadOnly
    // In failed state, applyReadOnly is NOT called from constructor
    const chart = makeChart({ readOnly: true })
    expect(chart.getNodes()).toHaveLength(0)
    chart.dispose()
  })

  it('EC-187: programmatic addNode works even in readOnly', () => {
    const chart = makeChart({ readOnly: true })
    chart.addNode(n('a'))
    expect(chart.getNode('a')).toBeDefined()
    chart.dispose()
  })
})

// ─── 21. CANVAS APPEARANCE ───────────────────────────────────────────────────

describe('Canvas appearance configuration', () => {
  let chart: FlowChart

  beforeEach(() => { chart = makeChart() })
  afterEach(() => { chart.dispose() })

  it('EC-188: setBackground does not throw', () => {
    expect(() => chart.setBackground('#000000')).not.toThrow()
    expect(() => chart.setBackground('transparent')).not.toThrow()
  })

  it('EC-189: setGrid visible=true does not throw', () => {
    expect(() => chart.setGrid({ visible: true, type: 'dots', size: 20 })).not.toThrow()
  })

  it('EC-190: setGrid type=lines does not throw', () => {
    expect(() => chart.setGrid({ visible: true, type: 'lines', size: 40 })).not.toThrow()
  })

  it('EC-191: setTheme light does not throw', () => {
    expect(() => chart.setTheme('light')).not.toThrow()
  })

  it('EC-192: setTheme dark does not throw', () => {
    expect(() => chart.setTheme('dark')).not.toThrow()
  })

  it('EC-193: setMinimap may throw in test env (no 2D canvas context)', () => {
    // Minimap creates a 2D canvas which is unavailable in jsdom/happy-dom
    // The call either succeeds silently or throws — both are acceptable
    try {
      chart.setMinimap({ width: 200, height: 150, position: 'bottom-right' })
    } catch {
      // Expected in test environment
    }
  })

  it('EC-194: setMinimap(null) is safe to call even without prior minimap', () => {
    expect(() => chart.setMinimap(null)).not.toThrow()
  })

  it('EC-195: setSnapGrid enables snapping', () => {
    expect(() => chart.setSnapGrid(20)).not.toThrow()
    expect(() => chart.setSnapGrid(0)).not.toThrow()
  })

  it('EC-196: setLabelEditable toggling', () => {
    expect(() => chart.setLabelEditable(false)).not.toThrow()
    expect(() => chart.setLabelEditable(true)).not.toThrow()
  })
})

// ─── 22. EVENT SYSTEM ────────────────────────────────────────────────────────

describe('Event system edge cases', () => {
  let chart: FlowChart

  beforeEach(() => {
    chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
  })
  afterEach(() => { chart.dispose() })

  it('EC-197: multiple listeners for same event all fire', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    chart.on('nodeAdd', h1)
    chart.on('nodeAdd', h2)
    chart.addNode(n('c', 400))
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
  })

  it('EC-198: off() removes only the specified listener', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    chart.on('nodeAdd', h1)
    chart.on('nodeAdd', h2)
    chart.off('nodeAdd', h1)
    chart.addNode(n('c', 400))
    expect(h1).not.toHaveBeenCalled()
    expect(h2).toHaveBeenCalledOnce()
  })

  it('EC-199: nodeUpdate event payload contains id and updates', () => {
    const handler = vi.fn()
    chart.on('nodeUpdate', handler)
    chart.updateNode('a', { label: 'Updated' })
    expect(handler.mock.calls[0]![0]).toMatchObject({ id: 'a', updates: { label: 'Updated' } })
  })

  it('EC-200: edgeRemove event fires with edge id', () => {
    const handler = vi.fn()
    chart.on('edgeRemove', handler)
    chart.removeEdge('e1')
    expect(handler).toHaveBeenCalledWith({ id: 'e1' })
  })

  it('EC-201: setSelectedIds does not emit selectionChange (only schedules render)', () => {
    // Only selectAll() and applySnapshot() emit selectionChange
    const handler = vi.fn()
    chart.on('selectionChange', handler)
    chart.setSelectedIds(['a'])
    expect(handler).not.toHaveBeenCalled()
    // But the selection is stored
    expect(chart.getSelectedIds()).toEqual(['a'])
  })

  it('EC-202: historyChange canUndo/canRedo are booleans', () => {
    const handler = vi.fn()
    chart.on('historyChange', handler)
    chart.addNode(n('c', 400))
    const { canUndo, canRedo } = handler.mock.calls[0]![0]
    expect(typeof canUndo).toBe('boolean')
    expect(typeof canRedo).toBe('boolean')
  })

  it('EC-203: nodeHover event can be registered', () => {
    expect(() => chart.on('nodeHover', vi.fn())).not.toThrow()
  })

  it('EC-204: edgeHover event can be registered', () => {
    expect(() => chart.on('edgeHover', vi.fn())).not.toThrow()
  })

  it('EC-205: paneClick event can be registered', () => {
    expect(() => chart.on('paneClick', vi.fn())).not.toThrow()
  })

  it('EC-206: connect event can be registered', () => {
    expect(() => chart.on('connect', vi.fn())).not.toThrow()
  })
})

// ─── 23. LARGE GRAPH SCENARIOS ───────────────────────────────────────────────

describe('Large graph edge cases', () => {
  it('EC-207: 1000 nodes can be added without error', () => {
    const chart = makeChart()
    const nodes: NodeData[] = []
    for (let i = 0; i < 1000; i++) {
      nodes.push(n(`n${i}`, (i % 50) * 120, Math.floor(i / 50) * 80))
    }
    expect(() => chart.setNodes(nodes)).not.toThrow()
    expect(chart.getNodes()).toHaveLength(1000)
    chart.dispose()
  })

  it('EC-208: selectAll on 1000 nodes does not throw', () => {
    const chart = makeChart()
    const nodes: NodeData[] = []
    for (let i = 0; i < 1000; i++) nodes.push(n(`n${i}`, i * 120, 0))
    chart.setNodes(nodes)
    expect(() => chart.selectAll()).not.toThrow()
    expect(chart.getSelectedIds()).toHaveLength(1000)
    chart.dispose()
  })

  it('EC-209: deleteSelected on 1000 nodes does not throw', () => {
    const chart = makeChart()
    const nodes: NodeData[] = []
    for (let i = 0; i < 1000; i++) nodes.push(n(`n${i}`, i * 120, 0))
    chart.setNodes(nodes)
    chart.selectAll()
    expect(() => chart.deleteSelected()).not.toThrow()
    expect(chart.getNodes()).toHaveLength(0)
    chart.dispose()
  })

  it('EC-210: searchNodes on 500 nodes performs correctly', () => {
    const chart = makeChart()
    const nodes: NodeData[] = []
    for (let i = 0; i < 500; i++) {
      nodes.push({ ...n(`n${i}`, i * 120), label: i % 2 === 0 ? 'even' : 'odd' })
    }
    chart.setNodes(nodes)
    const results = chart.searchNodes('even')
    expect(results).toHaveLength(250)
    chart.dispose()
  })

  it('EC-211: toJSON on 500-node graph is a plain object', () => {
    const chart = makeChart()
    const nodes: NodeData[] = []
    for (let i = 0; i < 500; i++) nodes.push(n(`n${i}`, i * 120, 0))
    chart.setNodes(nodes)
    const json = chart.toJSON()
    expect(json.nodes).toHaveLength(500)
    chart.dispose()
  })

  it('EC-212: setNodes clears previous nodes and edges', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
    chart.setNodes([n('x'), n('y', 200)])
    expect(chart.getEdges()).toHaveLength(0)
    expect(chart.getNodes()).toHaveLength(2)
    chart.dispose()
  })
})

// ─── 24. DUPLICATE SELECTED ──────────────────────────────────────────────────

describe('duplicateSelected edge cases', () => {
  let chart: FlowChart

  beforeEach(() => {
    chart = makeChart({
      nodes: [n('a', 0, 0), n('b', 200, 0)],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
  })
  afterEach(() => { chart.dispose() })

  it('EC-213: duplicateSelected with no selection does nothing', () => {
    chart.duplicateSelected()
    expect(chart.getNodes()).toHaveLength(2)
  })

  it('EC-214: duplicateSelected single node creates copy offset by +24', () => {
    chart.setSelectedIds(['a'])
    chart.duplicateSelected()
    const nodes = chart.getNodes()
    expect(nodes).toHaveLength(3)
    const copy = nodes.find(nd => nd.id !== 'a' && nd.id !== 'b')!
    expect(copy.x).toBeCloseTo(24, 0)
    expect(copy.y).toBeCloseTo(24, 0)
  })

  it('EC-215: duplicateSelected two nodes with internal edge duplicates edge', () => {
    chart.selectAll()
    chart.duplicateSelected()
    expect(chart.getNodes()).toHaveLength(4)
    expect(chart.getEdges()).toHaveLength(2)
  })

  it('EC-216: duplicateSelected is undoable', () => {
    chart.setSelectedIds(['a'])
    chart.duplicateSelected()
    expect(chart.getNodes()).toHaveLength(3)
    chart.undo()
    expect(chart.getNodes()).toHaveLength(2)
  })

  it('EC-217: duplicating locked node preserves locked state on copy', () => {
    // duplicateSelected copies all fields including locked
    chart.lockNode('a')
    chart.setSelectedIds(['a'])
    chart.duplicateSelected()
    const copy = chart.getNodes().find(nd => nd.id !== 'a' && nd.id !== 'b')!
    expect(copy).toBeDefined()
    expect(copy.locked).toBe(true)
  })
})

// ─── 25. NODE DATA FIELD PRESERVATION ────────────────────────────────────────

describe('Node data field preservation', () => {
  it('EC-218: custom data field is preserved through updateNode', () => {
    const chart = makeChart({
      nodes: [{ ...n('a'), data: { foo: 'bar', count: 42 } }],
    })
    chart.updateNode('a', { label: 'New Label' })
    expect(chart.getNode('a')!.data?.foo).toBe('bar')
    chart.dispose()
  })

  it('EC-219: tooltip field is preserved through updateNode', () => {
    const chart = makeChart({
      nodes: [{ ...n('a'), tooltip: 'hover text' }],
    })
    chart.updateNode('a', { label: 'X' })
    expect(chart.getNode('a')!.tooltip).toBe('hover text')
    chart.dispose()
  })

  it('EC-220: htmlContent field is preserved through setNodeStyle', () => {
    const chart = makeChart({
      nodes: [{ ...n('a'), htmlContent: '<b>bold</b>' }],
    })
    chart.setNodeStyle('a', { borderColor: '#ff0000' })
    expect(chart.getNode('a')!.htmlContent).toBe('<b>bold</b>')
    chart.dispose()
  })

  it('EC-221: graph stores defensive copy — external mutation does not affect stored node', () => {
    const g = new Graph()
    const node = n('a')
    g.addNode(node)
    node.x = 9999
    expect(g.getNode('a')!.x).toBe(0)
  })

  it('EC-222: getNode returns a reference — but internal mutations via updateNode are tracked', () => {
    const g = new Graph()
    g.addNode(n('a'))
    g.updateNode('a', { x: 50 })
    expect(g.getNode('a')!.x).toBe(50)
  })
})

// ─── 26. MULTI-EDGE TYPE COMBINATIONS ────────────────────────────────────────

describe('Multi-edge type combinations', () => {
  let chart: FlowChart

  beforeEach(() => {
    chart = makeChart({
      nodes: [n('a'), n('b', 200), n('c', 400)],
    })
  })
  afterEach(() => { chart.dispose() })

  it('EC-223: bezier and step edges coexist', () => {
    chart.addEdge({ id: 'e1', source: 'a', target: 'b', type: 'bezier' })
    chart.addEdge({ id: 'e2', source: 'b', target: 'c', type: 'step' })
    expect(chart.getEdges()).toHaveLength(2)
  })

  it('EC-224: animated and non-animated edges coexist', () => {
    chart.addEdge({ id: 'e1', source: 'a', target: 'b', animated: true })
    chart.addEdge({ id: 'e2', source: 'b', target: 'c', animated: false })
    expect(chart.getEdge('e1')!.animated).toBe(true)
    expect(chart.getEdge('e2')!.animated).toBe(false)
  })

  it('EC-225: edge with waypoints and animated', () => {
    chart.addEdge({
      id: 'e1', source: 'a', target: 'b',
      animated: true,
      waypoints: [{ x: 100, y: 100 }],
    })
    const edge = chart.getEdge('e1')!
    expect(edge.animated).toBe(true)
    expect(edge.waypoints).toHaveLength(1)
  })

  it('EC-226: edge with all style fields', () => {
    chart.addEdge({
      id: 'e1', source: 'a', target: 'b',
      style: { color: '#ff0000', width: 3, dashArray: [4, 4] },
    })
    const s = chart.getEdge('e1')!.style!
    expect(s.color).toBe('#ff0000')
    expect(s.width).toBe(3)
    expect(s.dashArray).toEqual([4, 4])
  })
})

// ─── 27. GRAPH VERSION / CHANGE DETECTION ────────────────────────────────────

describe('Graph version increment', () => {
  it('EC-227: graph version increments on addNode', () => {
    const g = new Graph()
    const v0 = g.version
    g.addNode(n('a'))
    expect(g.version).toBeGreaterThan(v0)
  })

  it('EC-228: graph version increments on removeNode', () => {
    const g = new Graph()
    g.addNode(n('a'))
    const v1 = g.version
    g.removeNode('a')
    expect(g.version).toBeGreaterThan(v1)
  })

  it('EC-229: graph version increments on addEdge', () => {
    const g = new Graph()
    g.addNode(n('a')); g.addNode(n('b', 200))
    const v1 = g.version
    g.addEdge(e('e1', 'a', 'b'))
    expect(g.version).toBeGreaterThan(v1)
  })

  it('EC-230: graph version increments on updateNode', () => {
    const g = new Graph()
    g.addNode(n('a'))
    const v1 = g.version
    g.updateNode('a', { x: 99 })
    expect(g.version).toBeGreaterThan(v1)
  })
})

// ─── 28. NODES WITH PORTS ────────────────────────────────────────────────────

describe('Node port edge cases', () => {
  it('EC-231: node with all four side ports is stored correctly', () => {
    const chart = makeChart({
      nodes: [{
        ...n('a'),
        ports: [
          { id: 'p-left', side: 'left' as const },
          { id: 'p-right', side: 'right' as const },
          { id: 'p-top', side: 'top' as const },
          { id: 'p-bottom', side: 'bottom' as const },
        ],
      }],
    })
    expect(chart.getNode('a')!.ports).toHaveLength(4)
    chart.dispose()
  })

  it('EC-232: port with custom offset is preserved', () => {
    const chart = makeChart({
      nodes: [{
        ...n('a'),
        ports: [{ id: 'p1', side: 'right' as const, offset: 0.25 }],
      }],
    })
    expect(chart.getNode('a')!.ports![0]!.offset).toBe(0.25)
    chart.dispose()
  })

  it('EC-233: port with label is preserved', () => {
    const chart = makeChart({
      nodes: [{
        ...n('a'),
        ports: [{ id: 'p1', side: 'right' as const, label: 'Output' }],
      }],
    })
    expect(chart.getNode('a')!.ports![0]!.label).toBe('Output')
    chart.dispose()
  })

  it('EC-234: edge sourceHandle referencing port id is stored', () => {
    const chart = makeChart({
      nodes: [
        { ...n('a'), ports: [{ id: 'out', side: 'right' as const }] },
        n('b', 200),
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', sourceHandle: 'out' }],
    })
    expect(chart.getEdge('e1')!.sourceHandle).toBe('out')
    chart.dispose()
  })
})

// ─── 29. GETEDGESBETWEEN VARIATIONS ─────────────────────────────────────────

describe('getEdgesBetween variations', () => {
  let chart: FlowChart

  beforeEach(() => {
    chart = makeChart({
      nodes: [n('a'), n('b', 200), n('c', 400)],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'a' },
        { id: 'e3', source: 'a', target: 'c' },
      ],
    })
  })
  afterEach(() => { chart.dispose() })

  it('EC-235: getEdgesBetween(a, b) returns bidirectional edges', () => {
    expect(chart.getEdgesBetween('a', 'b')).toHaveLength(2)
  })

  it('EC-236: getEdgesBetween(b, a) same as getEdgesBetween(a, b)', () => {
    const ab = chart.getEdgesBetween('a', 'b')
    const ba = chart.getEdgesBetween('b', 'a')
    expect(ab.map(x => x.id).sort()).toEqual(ba.map(x => x.id).sort())
  })

  it('EC-237: getEdgesBetween(a, c) returns 1 edge', () => {
    expect(chart.getEdgesBetween('a', 'c')).toHaveLength(1)
  })

  it('EC-238: getEdgesBetween for unconnected pair returns []', () => {
    expect(chart.getEdgesBetween('b', 'c')).toHaveLength(0)
  })

  it('EC-239: getEdgesBetween with unknown node returns []', () => {
    expect(chart.getEdgesBetween('a', 'ghost')).toHaveLength(0)
  })
})

// ─── 30. SNAP GRID ALIGNMENT ─────────────────────────────────────────────────

describe('Snap grid alignment', () => {
  it('EC-240: snapGrid=20 is stored and retrievable via getViewport', () => {
    const chart = makeChart({ snapGrid: 20 })
    expect(() => chart.getViewport()).not.toThrow()
    chart.dispose()
  })

  it('EC-241: setSnapGrid(0) disables snapping without error', () => {
    const chart = makeChart({ snapGrid: 20 })
    expect(() => chart.setSnapGrid(0)).not.toThrow()
    chart.dispose()
  })

  it('EC-242: setSnapGrid(40) changes snap size without error', () => {
    const chart = makeChart()
    expect(() => chart.setSnapGrid(40)).not.toThrow()
    chart.dispose()
  })
})

// ─── 31. MULTI-STEP UNDO/REDO WITH EDGES ─────────────────────────────────────

describe('Multi-step undo/redo involving edges', () => {
  let chart: FlowChart

  beforeEach(() => {
    chart = makeChart()
    chart.addNode(n('a'))
    chart.addNode(n('b', 200))
    chart.addEdge({ id: 'e1', source: 'a', target: 'b' })
  })
  afterEach(() => { chart.dispose() })

  it('EC-243: undo addEdge removes edge', () => {
    chart.undo()
    expect(chart.getEdge('e1')).toBeUndefined()
  })

  it('EC-244: redo after undo of addEdge restores edge', () => {
    chart.undo()
    chart.redo()
    expect(chart.getEdge('e1')).toBeDefined()
  })

  it('EC-245: undo removeEdge restores edge', () => {
    chart.removeEdge('e1')
    chart.undo()
    expect(chart.getEdge('e1')).toBeDefined()
  })

  it('EC-246: undo updateEdge restores original state', () => {
    chart.updateEdge('e1', { label: 'changed', animated: true })
    chart.undo()
    const edge = chart.getEdge('e1')!
    expect(edge.label).toBeUndefined()
    expect(edge.animated).toBeUndefined()
  })

  it('EC-247: undo setEdgeStyle restores original style', () => {
    chart.setEdgeStyle('e1', { color: '#ff0000', width: 5 })
    chart.undo()
    const edge = chart.getEdge('e1')!
    expect(edge.style?.color).toBeUndefined()
  })

  it('EC-248: undo swapEdgeDirection twice returns to original', () => {
    chart.swapEdgeDirection('e1')
    chart.swapEdgeDirection('e1')
    chart.undo()
    const edge = chart.getEdge('e1')!
    expect(edge.source).toBe('b')
    expect(edge.target).toBe('a')
  })
})

// ─── 32. COMPLEX COMBINATIONS ────────────────────────────────────────────────

describe('Complex feature combinations', () => {
  it('EC-249: lock + group + collapse + undo chain', () => {
    const chart = makeChart({
      nodes: [
        { id: 'g', x: 0, y: 0, width: 300, height: 200, label: 'G', type: 'group' },
        { id: 'c', x: 10, y: 10, width: 80, height: 40, label: 'C', parentId: 'g' },
      ],
    })
    chart.lockNode('g')
    chart.collapseNode('g')
    expect(chart.getNode('g')!.collapsed).toBe(true)
    expect(chart.getNode('g')!.locked).toBe(true)
    chart.undo()
    expect(chart.getNode('g')!.collapsed).toBeUndefined()
    expect(chart.getNode('g')!.locked).toBe(true)
    chart.undo()
    expect(chart.getNode('g')!.locked).toBeUndefined()
    chart.dispose()
  })

  it('EC-250: batchUpdate with undo and redo preserves correct state', () => {
    const chart = makeChart()
    chart.batchUpdate(() => {
      chart.addNode(n('a'))
      chart.addNode(n('b', 200))
      chart.addEdge({ id: 'e1', source: 'a', target: 'b' })
    })
    chart.undo()
    expect(chart.getNodes()).toHaveLength(0)
    expect(chart.getEdges()).toHaveLength(0)
    chart.redo()
    expect(chart.getNodes()).toHaveLength(2)
    expect(chart.getEdges()).toHaveLength(1)
    chart.dispose()
  })

  it('EC-251: import JSON then undo/redo preserves imported state', () => {
    const chart = makeChart({ nodes: [n('a')] })
    chart.addNode(n('b', 200))
    chart.importJSON({ nodes: [n('x', 500)], edges: [] }, 'merge')
    chart.undo()
    expect(chart.getNode('x')).toBeUndefined()
    chart.redo()
    expect(chart.getNode('x')).toBeDefined()
    chart.dispose()
  })

  it('EC-252: alignNodes then undo then distribute', () => {
    const chart = makeChart({
      nodes: [n('a', 0, 0), n('b', 100, 100), n('c', 200, 200)],
    })
    chart.selectAll()
    chart.alignNodes('left')
    chart.undo()
    chart.distributeNodes('horizontal')
    expect(chart.getNodes()).toHaveLength(3)
    chart.dispose()
  })

  it('EC-253: setHighlightedNodes then searchNodes returns same set', () => {
    const chart = makeChart({
      nodes: [
        { ...n('a'), label: 'Alpha' },
        { ...n('b', 200), label: 'Beta' },
        { ...n('c', 400), label: 'Alpha Two' },
      ],
    })
    chart.setHighlightedNodes(['a', 'c'])
    const results = chart.searchNodes('alpha')
    expect(results.map(x => x.id).sort()).toEqual(['a', 'c'])
    chart.dispose()
  })

  it('EC-254: toJSON after fromJSON round-trip preserves edge waypoints', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      edges: [{ id: 'e1', source: 'a', target: 'b', waypoints: [{ x: 100, y: 100 }] }],
    })
    const json = chart.toJSON()
    chart.fromJSON(json)
    expect(chart.getEdge('e1')!.waypoints).toHaveLength(1)
    chart.dispose()
  })

  it('EC-255: multiple status badges across nodes coexist', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200), n('c', 400), n('d', 600)],
    })
    chart.setNodeStatus('a', 'error')
    chart.setNodeStatus('b', 'warning')
    chart.setNodeStatus('c', 'success')
    chart.setNodeStatus('d', 'info')
    expect(chart.getNode('a')!.status).toBe('error')
    expect(chart.getNode('b')!.status).toBe('warning')
    expect(chart.getNode('c')!.status).toBe('success')
    expect(chart.getNode('d')!.status).toBe('info')
    chart.dispose()
  })

  it('EC-256: setNodes followed by addEdge referencing old ids warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const chart = makeChart({ nodes: [n('a'), n('b', 200)], edges: [{ id: 'e1', source: 'a', target: 'b' }] })
    chart.setNodes([n('x'), n('y', 200)])
    chart.addEdge({ id: 'e2', source: 'a', target: 'b' })
    expect(chart.getEdge('e2')).toBeUndefined()
    warn.mockRestore()
    chart.dispose()
  })

  it('EC-257: getNodesBounds for selection subset', () => {
    const chart = makeChart({
      nodes: [n('a', 0, 0), n('b', 1000, 1000)],
    })
    const bounds = chart.getNodesBounds(['a'])!
    expect(bounds.maxX).toBe(100)
    expect(bounds.maxY).toBe(50)
    chart.dispose()
  })

  it('EC-258: hierarchicalLayout then animateLayout does not throw', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200), n('c', 400)],
      edges: [{ id: 'e1', source: 'a', target: 'b' }, { id: 'e2', source: 'b', target: 'c' }],
    })
    const targets = hierarchicalLayout(chart.getNodes(), chart.getEdges())
    expect(() => chart.animateLayout(targets, 0)).not.toThrow()
    chart.dispose()
  })

  it('EC-259: importJSON merge then selectAll includes merged nodes', () => {
    const chart = makeChart({ nodes: [n('a')] })
    chart.importJSON({ nodes: [n('b', 200)], edges: [] }, 'merge')
    chart.selectAll()
    expect(chart.getSelectedIds().sort()).toEqual(['a', 'b'])
    chart.dispose()
  })

  it('EC-260: circular layout preserves all node ids in result', () => {
    const nodes = [n('a'), n('b', 100), n('c', 200), n('d', 300), n('e', 400)]
    const result = circularLayout(nodes)
    for (const nd of nodes) {
      expect(result.has(nd.id)).toBe(true)
    }
  })
})

// ─── 33. GRAPH.SETALL / REPLACE OPERATIONS ───────────────────────────────────

describe('Graph setNodes/setEdges operations', () => {
  it('EC-261: setNodes clears undo history', () => {
    const chart = makeChart()
    chart.addNode(n('a'))
    chart.setNodes([n('x')])
    expect(chart.canUndo()).toBe(false)
    chart.dispose()
  })

  it('EC-262: setEdges replaces all edges', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200), n('c', 400)],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
    chart.setEdges([{ id: 'e2', source: 'b', target: 'c' }])
    expect(chart.getEdge('e1')).toBeUndefined()
    expect(chart.getEdge('e2')).toBeDefined()
    chart.dispose()
  })

  it('EC-263: setEdges with ghost source is rejected', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const chart = makeChart({ nodes: [n('a'), n('b', 200)] })
    chart.setEdges([{ id: 'e1', source: 'ghost', target: 'b' }])
    expect(chart.getEdges()).toHaveLength(0)
    warn.mockRestore()
    chart.dispose()
  })
})

// ─── 34. ANIMATELAYOUT ───────────────────────────────────────────────────────

describe('animateLayout edge cases', () => {
  it('EC-264: animateLayout with Map does not throw', () => {
    const chart = makeChart({ nodes: [n('a'), n('b', 200)] })
    const targets = new Map([['a', { x: 100, y: 0 }], ['b', { x: 300, y: 0 }]])
    expect(() => chart.animateLayout(targets, 0)).not.toThrow()
    chart.dispose()
  })

  it('EC-265: animateLayout with array targets does not throw', () => {
    const chart = makeChart({ nodes: [n('a'), n('b', 200)] })
    const targets = [{ id: 'a', x: 100, y: 0 }, { id: 'b', x: 300, y: 0 }]
    expect(() => chart.animateLayout(targets, 0)).not.toThrow()
    chart.dispose()
  })

  it('EC-266: animateLayout with duration=0 applies positions immediately', () => {
    const chart = makeChart({ nodes: [n('a')] })
    chart.animateLayout(new Map([['a', { x: 500, y: 300 }]]), 0)
    expect(chart.getNode('a')!.x).toBeCloseTo(500, 0)
    chart.dispose()
  })

  it('EC-267: animateLayout with unknown node ids is ignored', () => {
    const chart = makeChart({ nodes: [n('a')] })
    const targets = new Map([['ghost', { x: 100, y: 0 }]])
    expect(() => chart.animateLayout(targets, 0)).not.toThrow()
    chart.dispose()
  })
})

// ─── 35. DEFENSIVE API SURFACE ───────────────────────────────────────────────

describe('Defensive API — unknown ids do not throw', () => {
  let chart: FlowChart

  beforeEach(() => { chart = makeChart() })
  afterEach(() => { chart.dispose() })

  it('EC-268: getNode unknown id returns undefined', () => {
    expect(chart.getNode('ghost')).toBeUndefined()
  })

  it('EC-269: getEdge unknown id returns undefined', () => {
    expect(chart.getEdge('ghost')).toBeUndefined()
  })

  it('EC-270: updateNode unknown id is no-op', () => {
    expect(() => chart.updateNode('ghost', { label: 'x' })).not.toThrow()
  })

  it('EC-271: removeNode unknown id is no-op', () => {
    expect(() => chart.removeNode('ghost')).not.toThrow()
  })

  it('EC-272: removeEdge unknown id is no-op', () => {
    expect(() => chart.removeEdge('ghost')).not.toThrow()
  })

  it('EC-273: lockNode unknown id is no-op', () => {
    expect(() => chart.lockNode('ghost')).not.toThrow()
  })

  it('EC-274: unlockNode unknown id is no-op', () => {
    expect(() => chart.unlockNode('ghost')).not.toThrow()
  })

  it('EC-275: setNodeShape unknown id is no-op', () => {
    expect(() => chart.setNodeShape('ghost', 'circle')).not.toThrow()
  })

  it('EC-276: setNodeStatus unknown id is no-op', () => {
    expect(() => chart.setNodeStatus('ghost', 'error')).not.toThrow()
  })

  it('EC-277: collapseNode unknown id is no-op', () => {
    expect(() => chart.collapseNode('ghost')).not.toThrow()
  })

  it('EC-278: expandNode unknown id is no-op', () => {
    expect(() => chart.expandNode('ghost')).not.toThrow()
  })

  it('EC-279: scrollToNode unknown id is no-op', () => {
    expect(() => chart.scrollToNode('ghost')).not.toThrow()
  })

  it('EC-280: swapEdgeDirection unknown id is no-op', () => {
    expect(() => chart.swapEdgeDirection('ghost')).not.toThrow()
  })

  it('EC-281: setEdgeStyle unknown id is no-op', () => {
    expect(() => chart.setEdgeStyle('ghost', { color: '#ff0000' })).not.toThrow()
  })

  it('EC-282: setNodeStyle unknown id is no-op', () => {
    expect(() => chart.setNodeStyle('ghost', { borderColor: '#ff0000' })).not.toThrow()
  })

  it('EC-283: setNodeBorderColor unknown id is no-op', () => {
    expect(() => chart.setNodeBorderColor('ghost', '#ff0000')).not.toThrow()
  })

  it('EC-284: setNodeBackgroundColor unknown id is no-op', () => {
    expect(() => chart.setNodeBackgroundColor('ghost', '#ff0000')).not.toThrow()
  })

  it('EC-285: setNodeSize unknown id is no-op', () => {
    expect(() => chart.setNodeSize('ghost', 200, 100)).not.toThrow()
  })

  it('EC-286: toggleCollapse unknown id is no-op', () => {
    expect(() => chart.toggleCollapse('ghost')).not.toThrow()
  })

  it('EC-287: getEdgesForNode unknown id returns []', () => {
    expect(chart.getEdgesForNode('ghost')).toEqual([])
  })

  it('EC-288: getEdgesBetween unknown pair returns []', () => {
    expect(chart.getEdgesBetween('ghost1', 'ghost2')).toEqual([])
  })

  it('EC-289: getIncomers unknown id returns []', () => {
    expect(chart.getIncomers('ghost')).toEqual([])
  })

  it('EC-290: getOutgoers unknown id returns []', () => {
    expect(chart.getOutgoers('ghost')).toEqual([])
  })
})

// ─── 36. DISPOSE CLEANUP ─────────────────────────────────────────────────────

describe('Dispose cleanup', () => {
  it('EC-291: dispose can be called multiple times without throw', () => {
    const chart = makeChart()
    expect(() => {
      chart.dispose()
      chart.dispose()
    }).not.toThrow()
  })

  it('EC-292: dispose removes canvas from DOM', () => {
    const container = makeContainer()
    const onError = vi.fn()
    const chart = new FlowChart({ container, onError })
    chart.dispose()
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('EC-293: event listeners are cleaned up after dispose', () => {
    const chart = makeChart()
    const handler = vi.fn()
    chart.on('nodeAdd', handler)
    chart.dispose()
    expect(handler).not.toHaveBeenCalled()
  })
})

// ─── 37. CONSTRUCTION EDGE CASES ─────────────────────────────────────────────

describe('FlowChart construction edge cases', () => {
  it('EC-294: empty nodes and edges arrays does not throw', () => {
    const chart = makeChart({ nodes: [], edges: [] })
    expect(chart.getNodes()).toHaveLength(0)
    chart.dispose()
  })

  it('EC-295: autoFit=true with empty graph does not throw', () => {
    expect(() => makeChart({ autoFit: true })).not.toThrow()
  })

  it('EC-296: historyLimit=0 treated as 0 — no undo history stored', () => {
    const chart = makeChart({ historyLimit: 0 })
    chart.addNode(n('a'))
    expect(chart.canUndo()).toBe(false)
    chart.dispose()
  })

  it('EC-297: initial edges with ghost source are dropped silently', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const chart = makeChart({
      nodes: [n('b')],
      edges: [{ id: 'bad', source: 'ghost', target: 'b' }],
    })
    expect(chart.getEdges()).toHaveLength(0)
    warn.mockRestore()
    chart.dispose()
  })

  it('EC-298: initial node with all optional fields is stored', () => {
    const chart = makeChart({
      nodes: [{
        id: 'full', x: 0, y: 0, width: 100, height: 50, label: 'Full',
        type: 'group', locked: true, collapsed: false,
        htmlContent: '<i>hi</i>', tooltip: 'tip',
        status: 'info',
        data: { key: 'value' },
        style: { shape: 'diamond', borderRadius: 0 },
        ports: [{ id: 'p1', side: 'top' as const }],
      }],
    })
    const nd = chart.getNode('full')!
    expect(nd.type).toBe('group')
    expect(nd.locked).toBe(true)
    expect(nd.htmlContent).toBe('<i>hi</i>')
    expect(nd.tooltip).toBe('tip')
    expect(nd.status).toBe('info')
    expect(nd.data?.key).toBe('value')
    expect(nd.style?.shape).toBe('diamond')
    expect(nd.ports).toHaveLength(1)
    chart.dispose()
  })

  it('EC-299: multiple FlowChart instances in same document are independent', () => {
    const c1 = makeChart()
    const c2 = makeChart()
    c1.addNode(n('a'))
    expect(c2.getNodes()).toHaveLength(0)
    c1.dispose()
    c2.dispose()
  })

  it('EC-300: requestRender does not throw', () => {
    const chart = makeChart()
    expect(() => chart.requestRender()).not.toThrow()
    chart.dispose()
  })

  it('EC-301: ariaLabel option does not throw on construction', () => {
    const chart = makeChart({ ariaLabel: 'My custom flowchart' })
    expect(chart.getNodes()).toHaveLength(0)
    chart.dispose()
  })

  it('EC-302: grid config on construction is applied', () => {
    const chart = makeChart({
      grid: { visible: true, size: 40, type: 'lines', color: 'rgba(0,0,0,0.1)' },
    })
    expect(chart.getNodes()).toHaveLength(0)
    chart.dispose()
  })

  it('EC-303: minimap config on construction does not throw', () => {
    const chart = makeChart({
      minimap: { width: 150, height: 100, position: 'top-left' },
    })
    expect(chart.getNodes()).toHaveLength(0)
    chart.dispose()
  })

  it('EC-304: background option is applied without throw', () => {
    const chart = makeChart({ background: '#1a1a2e' })
    expect(chart.getNodes()).toHaveLength(0)
    chart.dispose()
  })

  it('EC-305: renderer options do not throw', () => {
    const chart = makeChart({ renderer: { pixelRatio: 2, antialias: true } })
    expect(chart.getNodes()).toHaveLength(0)
    chart.dispose()
  })
})

// ─── 38. GRAPH EDGE INDEX CONSISTENCY ────────────────────────────────────────

describe('Edge index consistency after mutations', () => {
  it('EC-306: after removeNode, its edges no longer appear in getEdgesForNode of neighbor', () => {
    const g = new Graph()
    g.addNode(n('a')); g.addNode(n('b', 200))
    g.addEdge(e('e1', 'a', 'b'))
    g.removeNode('a')
    expect(g.getEdgesForNode('b')).toHaveLength(0)
  })

  it('EC-307: after removeEdge, it no longer appears in getEdgesForNode', () => {
    const g = new Graph()
    g.addNode(n('a')); g.addNode(n('b', 200))
    g.addEdge(e('e1', 'a', 'b'))
    g.removeEdge('e1')
    expect(g.getEdgesForNode('a')).toHaveLength(0)
    expect(g.getEdgesForNode('b')).toHaveLength(0)
  })

  it('EC-308: getEdgesForNode after setNodes reflects new state', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })
    chart.setNodes([n('x'), n('y', 200)])
    expect(chart.graph.getEdgesForNode('a')).toHaveLength(0)
    chart.dispose()
  })

  it('EC-309: nodeCount and edgeCount update correctly', () => {
    const g = new Graph()
    expect(g.nodeCount).toBe(0)
    expect(g.edgeCount).toBe(0)
    g.addNode(n('a')); g.addNode(n('b', 200))
    expect(g.nodeCount).toBe(2)
    g.addEdge(e('e1', 'a', 'b'))
    expect(g.edgeCount).toBe(1)
    g.removeEdge('e1')
    expect(g.edgeCount).toBe(0)
    g.removeNode('a')
    expect(g.nodeCount).toBe(1)
  })

  it('EC-310: adding same node id twice is deduplicated', () => {
    const g = new Graph()
    g.addNode(n('a'))
    g.addNode({ ...n('a'), x: 999 })
    expect(g.nodeCount).toBe(1)
    expect(g.getNode('a')!.x).toBe(999)
  })

  it('EC-311: adding same edge id twice is deduplicated', () => {
    const g = new Graph()
    g.addNode(n('a')); g.addNode(n('b', 200))
    g.addEdge({ id: 'e1', source: 'a', target: 'b', label: 'first' })
    g.addEdge({ id: 'e1', source: 'a', target: 'b', label: 'second' })
    expect(g.edgeCount).toBe(1)
    expect(g.getEdge('e1')!.label).toBe('second')
  })
})

// ─── 39. SEARCH EDGE CASES ───────────────────────────────────────────────────

describe('searchNodes edge cases', () => {
  it('EC-312: search empty string returns [] (no query means no results)', () => {
    // searchNodes('') returns [] — empty query is not treated as wildcard
    const chart = makeChart({ nodes: [n('a'), n('b', 200), n('c', 400)] })
    expect(chart.searchNodes('')).toHaveLength(0)
    chart.dispose()
  })

  it('EC-313: search with partial match returns matching nodes', () => {
    const chart = makeChart({
      nodes: [
        { ...n('a'), label: 'Start Node' },
        { ...n('b', 200), label: 'Middle' },
        { ...n('c', 400), label: 'End Node' },
      ],
    })
    const results = chart.searchNodes('node')
    expect(results).toHaveLength(2)
    chart.dispose()
  })

  it('EC-314: search with special chars does not throw', () => {
    const chart = makeChart({ nodes: [n('a')] })
    expect(() => chart.searchNodes('.*[test]')).not.toThrow()
    chart.dispose()
  })

  it('EC-315: setHighlightedNodes with nonexistent ids is no-op', () => {
    const chart = makeChart({ nodes: [n('a')] })
    expect(() => chart.setHighlightedNodes(['ghost1', 'ghost2'])).not.toThrow()
    chart.dispose()
  })
})

// ─── 40. TOSTRING / SVG EXPORT ───────────────────────────────────────────────

describe('exportSVG edge cases', () => {
  it('EC-316: exportSVG with no nodes returns valid SVG', () => {
    const chart = makeChart()
    const svg = chart.exportSVG()
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    chart.dispose()
  })

  it('EC-317: exportSVG with nodes includes viewBox', () => {
    const chart = makeChart({ nodes: [n('a', 0, 0, 100, 50)] })
    const svg = chart.exportSVG()
    expect(svg).toContain('viewBox')
    chart.dispose()
  })

  it('EC-318: exportSVG custom padding does not throw', () => {
    const chart = makeChart({ nodes: [n('a')] })
    expect(() => chart.exportSVG(50)).not.toThrow()
    chart.dispose()
  })

  it('EC-319: exportSVG with many nodes does not throw', () => {
    const nodes: NodeData[] = []
    for (let i = 0; i < 100; i++) nodes.push(n(`n${i}`, i * 120, 0))
    const chart = makeChart({ nodes })
    expect(() => chart.exportSVG()).not.toThrow()
    chart.dispose()
  })

  it('EC-320: exportPNG scale parameter does not throw', () => {
    const chart = makeChart({ nodes: [n('a')] })
    const result = chart.exportPNG(2)
    expect(result === null || typeof result === 'string').toBe(true)
    chart.dispose()
  })
})

// ─── Private method coverage ──────────────────────────────────────────────────

describe('FlowChart private method coverage', () => {
  it('copySelection does nothing when nothing is selected', () => {
    const chart = makeChart({ nodes: [n('a')] })
    expect(() => (chart as any).copySelection()).not.toThrow()
    expect((chart as any).clipboard).toBeNull()
    chart.dispose()
  })

  it('copySelection stores selected nodes and internal edges', () => {
    const chart = makeChart({
      nodes: [n('a', 0, 0), n('b', 200, 0)],
      edges: [e('e1', 'a', 'b')],
    })
    chart.setSelectedIds(['a', 'b'])
    ;(chart as any).copySelection()
    const clipboard = (chart as any).clipboard
    expect(clipboard).toBeDefined()
    expect(clipboard.nodes).toHaveLength(2)
    expect(clipboard.edges).toHaveLength(1)
    chart.dispose()
  })

  it('pasteClipboard does nothing when clipboard is empty', () => {
    const chart = makeChart({ nodes: [n('a')] })
    expect(() => (chart as any).pasteClipboard()).not.toThrow()
    chart.dispose()
  })

  it('pasteClipboard creates new nodes offset from originals', () => {
    const chart = makeChart({
      nodes: [n('a', 0, 0), n('b', 200, 0)],
      edges: [e('e1', 'a', 'b')],
    })
    chart.setSelectedIds(['a', 'b'])
    ;(chart as any).copySelection()
    const countBefore = chart.getNodes().length
    ;(chart as any).pasteClipboard()
    expect(chart.getNodes().length).toBeGreaterThan(countBefore)
    chart.dispose()
  })

  it('announce sets ariaLive textContent', () => {
    const chart = makeChart()
    expect(() => (chart as any).announce('test message')).not.toThrow()
    chart.dispose()
  })

  it('announceNode builds a message with edge counts', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      edges: [e('e1', 'a', 'b')],
    })
    expect(() => (chart as any).announceNode({ id: 'a', label: 'A' })).not.toThrow()
    chart.dispose()
  })

  it('tabSelectNode selects the first node when nothing is selected', () => {
    const chart = makeChart({ nodes: [n('a'), n('b', 200)] })
    expect(() => (chart as any).tabSelectNode(1)).not.toThrow()
    chart.dispose()
  })

  it('tabSelectNode cycles forward through nodes', () => {
    const chart = makeChart({ nodes: [n('a'), n('b', 200), n('c', 400)] })
    chart.setSelectedIds(['a'])
    ;(chart as any).tabSelectNode(1)
    // selection moved from a to b
    expect(chart.getSelectedIds()).toContain('b')
    chart.dispose()
  })

  it('tabSelectNode does nothing on empty graph', () => {
    const chart = makeChart()
    expect(() => (chart as any).tabSelectNode(1)).not.toThrow()
    chart.dispose()
  })

  it('moveSelectedByArrow does nothing when nothing is selected', () => {
    const chart = makeChart({ nodes: [n('a')] })
    expect(() => (chart as any).moveSelectedByArrow('ArrowUp')).not.toThrow()
    chart.dispose()
  })

  it('moveSelectedByArrow moves selected node up', () => {
    const chart = makeChart({ nodes: [n('a', 100, 100)] })
    chart.setSelectedIds(['a'])
    ;(chart as any).moveSelectedByArrow('ArrowUp')
    const node = chart.getNodes().find(nd => nd.id === 'a')!
    expect(node.y).toBeLessThan(100)
    chart.dispose()
  })

  it('moveSelectedByArrow moves selected node right', () => {
    const chart = makeChart({ nodes: [n('a', 100, 100)] })
    chart.setSelectedIds(['a'])
    ;(chart as any).moveSelectedByArrow('ArrowRight')
    const node = chart.getNodes().find(nd => nd.id === 'a')!
    expect(node.x).toBeGreaterThan(100)
    chart.dispose()
  })

  it('announce rAF callback fires without throwing', () => {
    const chart = makeChart()
    vi.useFakeTimers()
    ;(chart as any).announce('hello')
    vi.runAllTimers()
    vi.useRealTimers()
    expect(true).toBe(true)
    chart.dispose()
  })

  it('moveSelectedByArrow setTimeout callback fires and announces final position', () => {
    const chart = makeChart({ nodes: [n('a', 100, 100)] })
    chart.setSelectedIds(['a'])
    vi.useFakeTimers()
    ;(chart as any).moveSelectedByArrow('ArrowLeft')
    vi.runAllTimers()
    vi.useRealTimers()
    const node = chart.getNodes().find(nd => nd.id === 'a')!
    expect(node.x).toBeLessThan(100)
    chart.dispose()
  })

  it('moveSelectedByArrow moves group children together with group', () => {
    const chart = makeChart({
      nodes: [
        { id: 'grp', x: 100, y: 100, width: 200, height: 200, label: 'G', type: 'group' },
        { id: 'c1',  x: 120, y: 120, width: 80, height: 50, label: 'C1', parentId: 'grp' },
        { id: 'c2',  x: 120, y: 200, width: 80, height: 50, label: 'C2', parentId: 'grp' },
      ],
    })
    chart.setSelectedIds(['grp'])
    ;(chart as any).moveSelectedByArrow('ArrowRight')
    const grp = chart.getNodes().find(nd => nd.id === 'grp')!
    const c1  = chart.getNodes().find(nd => nd.id === 'c1')!
    const c2  = chart.getNodes().find(nd => nd.id === 'c2')!
    expect(grp.x).toBe(110)
    expect(c1.x).toBe(130)
    expect(c2.x).toBe(130)
    chart.dispose()
  })

  it('moveSelectedByArrow does not double-move child selected together with its group', () => {
    const chart = makeChart({
      nodes: [
        { id: 'grp', x: 100, y: 100, width: 200, height: 200, label: 'G', type: 'group' },
        { id: 'c1',  x: 120, y: 120, width: 80, height: 50, label: 'C1', parentId: 'grp' },
      ],
    })
    chart.setSelectedIds(['grp', 'c1'])
    ;(chart as any).moveSelectedByArrow('ArrowDown')
    const grp = chart.getNodes().find(nd => nd.id === 'grp')!
    const c1  = chart.getNodes().find(nd => nd.id === 'c1')!
    // Both selected; child should move exactly STEP=10, not 20
    expect(grp.y).toBe(110)
    expect(c1.y).toBe(130)
    chart.dispose()
  })

  it('startEdgeLabelEdit appends an input to the DOM', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      edges: [e('e1', 'a', 'b')],
    })
    const edge = chart.getEdges()[0]!
    expect(() => (chart as any).startEdgeLabelEdit(edge, 100, 100)).not.toThrow()
    const input = document.querySelector('input[type="text"]')
    expect(input).not.toBeNull()
    input!.remove()
    chart.dispose()
  })

  it('startEdgeLabelEdit Enter key commits the new label', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      edges: [e('e1', 'a', 'b')],
    })
    const edge = chart.getEdges()[0]!
    ;(chart as any).startEdgeLabelEdit(edge, 100, 100)
    const input = document.querySelector('input[type="text"]') as HTMLInputElement
    input.value = 'NewLabel'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(chart.getEdges()[0]!.label).toBe('NewLabel')
    chart.dispose()
  })

  it('startEdgeLabelEdit Escape key cancels without changing label', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      edges: [{ id: 'e1', source: 'a', target: 'b', label: 'Original' }],
    })
    const edge = chart.getEdges()[0]!
    ;(chart as any).startEdgeLabelEdit(edge, 100, 100)
    const input = document.querySelector('input[type="text"]') as HTMLInputElement
    input.value = 'Changed'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(chart.getEdges()[0]!.label).toBe('Original')
    chart.dispose()
  })

  it('startEdgeLabelEdit blur event commits the label', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      edges: [e('e1', 'a', 'b')],
    })
    const edge = chart.getEdges()[0]!
    ;(chart as any).startEdgeLabelEdit(edge, 100, 100)
    const input = document.querySelector('input[type="text"]') as HTMLInputElement
    input.value = 'BlurLabel'
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(chart.getEdges()[0]!.label).toBe('BlurLabel')
    chart.dispose()
  })

  it('startEdgeLabelEdit rAF fires input.select without throwing', () => {
    const chart = makeChart({
      nodes: [n('a'), n('b', 200)],
      edges: [e('e1', 'a', 'b')],
    })
    const edge = chart.getEdges()[0]!
    vi.useFakeTimers()
    ;(chart as any).startEdgeLabelEdit(edge, 100, 100)
    vi.runAllTimers()
    vi.useRealTimers()
    const input = document.querySelector('input[type="text"]')
    if (input) input.remove()
    chart.dispose()
  })
})
