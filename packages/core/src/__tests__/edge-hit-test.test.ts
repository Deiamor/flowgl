import { describe, it, expect } from 'vitest'
import { EdgeHitTester } from '../interaction/edge-hit-test'
import type { EdgeData } from '../graph/edge'
import type { NodeData } from '../graph/node'

const nd = (id: string, x: number, y: number, w = 100, h = 50): NodeData => ({
  id, label: id, x, y, width: w, height: h,
})

function makeMap(nodes: NodeData[]): Map<string, NodeData> {
  return new Map(nodes.map(n => [n.id, n]))
}

describe('EdgeHitTester', () => {
  const ht = new EdgeHitTester()

  it('returns null for empty edge list', () => {
    expect(ht.findEdgeAt([], new Map(), 50, 50, 1)).toBeNull()
  })

  it('skips edge when source node missing from map', () => {
    const edges: EdgeData[] = [{ id: 'e1', source: 'a', target: 'b' }]
    const nodeMap = makeMap([nd('b', 200, 0)])
    expect(ht.findEdgeAt(edges, nodeMap, 150, 25, 1)).toBeNull()
  })

  it('skips edge when target node missing from map', () => {
    const edges: EdgeData[] = [{ id: 'e1', source: 'a', target: 'b' }]
    const nodeMap = makeMap([nd('a', 0, 0)])
    expect(ht.findEdgeAt(edges, nodeMap, 150, 25, 1)).toBeNull()
  })

  it('returns null when clicking far from all edges', () => {
    const nodes = [nd('a', 0, 0), nd('b', 200, 0)]
    const edges: EdgeData[] = [{ id: 'e1', source: 'a', target: 'b' }]
    // Click far away from the bezier
    expect(ht.findEdgeAt(edges, makeMap(nodes), 150, 500, 1)).toBeNull()
  })

  it('returns edge when clicking near the edge midpoint', () => {
    // a→b horizontal, bezier midpoint is near (150, 25)
    const nodes = [nd('a', 0, 0), nd('b', 200, 0)]
    const edges: EdgeData[] = [{ id: 'e1', source: 'a', target: 'b' }]
    // At zoom=1, threshold = max(8px, 1px) = 8 world units
    const result = ht.findEdgeAt(edges, makeMap(nodes), 150, 25, 1)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('e1')
  })

  it('returns topmost (last in array) edge when overlapping', () => {
    const nodes = [nd('a', 0, 0), nd('b', 200, 0)]
    const edges: EdgeData[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'a', target: 'b' },
    ]
    const result = ht.findEdgeAt(edges, makeMap(nodes), 150, 25, 1)
    expect(result?.id).toBe('e2')
  })

  it('returns null when clicking very far from a short edge', () => {
    const nodes = [nd('a', 0, 0, 10, 10), nd('b', 20, 0, 10, 10)]
    const edges: EdgeData[] = [{ id: 'e1', source: 'a', target: 'b' }]
    expect(ht.findEdgeAt(edges, makeMap(nodes), 1000, 1000, 1)).toBeNull()
  })

  it('respects zoom — threshold is MIN_HIT_PX / zoom in world units', () => {
    const nodes = [nd('a', 0, 0), nd('b', 200, 0)]
    const edges: EdgeData[] = [{ id: 'e1', source: 'a', target: 'b' }]
    // At zoom=2, world threshold = 8/2 = 4 units
    const nearResult = ht.findEdgeAt(edges, makeMap(nodes), 150, 22, 2)
    const farResult  = ht.findEdgeAt(edges, makeMap(nodes), 150, 50, 2)
    expect(nearResult).not.toBeNull()
    expect(farResult).toBeNull()
  })

  it('uses edge style width in threshold calculation', () => {
    const nodes = [nd('a', 0, 0), nd('b', 200, 0)]
    // Wide edge (width=20) → threshold = max(8, 10) = 10 world units
    const edges: EdgeData[] = [{ id: 'e1', source: 'a', target: 'b', style: { width: 20 } }]
    // Should hit at wy=34 (9 units off the midpoint wy=25)
    const result = ht.findEdgeAt(edges, makeMap(nodes), 150, 34, 1)
    expect(result).not.toBeNull()
  })

  it('finds edge with non-default handles', () => {
    const nodes = [nd('a', 0, 0), nd('b', 0, 200)]
    const edges: EdgeData[] = [{ id: 'e1', source: 'a', target: 'b', sourceHandle: 'bottom', targetHandle: 'top' }]
    // Vertical connection: source bottom = (50, 50), target top = (50, 200)
    const result = ht.findEdgeAt(edges, makeMap(nodes), 50, 125, 1)
    expect(result).not.toBeNull()
  })
})
