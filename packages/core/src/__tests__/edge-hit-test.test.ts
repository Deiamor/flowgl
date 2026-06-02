import { describe, it, expect } from 'vitest'
import { EdgeHitTester } from '../interaction/edge-hit-test'
import type { EdgeData } from '../graph/edge'
import type { NodeData } from '../graph/node'

const nd = (id: string, x: number, y: number, w = 100, h = 50, extra: Partial<NodeData> = {}): NodeData => ({
  id, label: id, x, y, width: w, height: h, ...extra,
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

  it('very small zoom → large world-space threshold → hits edge from far away', () => {
    // At zoom=0.01, threshold = 8/0.01 = 800 world units; anything within 800 units hits
    const nodes = [nd('a', 0, 0), nd('b', 200, 0)]
    const edges: EdgeData[] = [{ id: 'e1', source: 'a', target: 'b' }]
    const result = ht.findEdgeAt(edges, makeMap(nodes), 150, 300, 0.01)
    expect(result).not.toBeNull()
  })

  it('self-loop (source === target) — returns finite result, no crash', () => {
    const nodes = [nd('a', 100, 100)]
    const edges: EdgeData[] = [{ id: 'e1', source: 'a', target: 'a' }]
    // Self-loop won't throw; result may or may not hit depending on curve shape
    expect(() => ht.findEdgeAt(edges, makeMap(nodes), 200, 125, 1)).not.toThrow()
  })

  it('all four handle combinations — no crash', () => {
    const nodes = [nd('a', 0, 0), nd('b', 200, 100)]
    const sides = ['left', 'right', 'top', 'bottom'] as const
    for (const src of sides) {
      for (const tgt of sides) {
        const edges: EdgeData[] = [{ id: 'e', source: 'a', target: 'b', sourceHandle: src, targetHandle: tgt }]
        expect(() => ht.findEdgeAt(edges, makeMap(nodes), 100, 50, 1)).not.toThrow()
      }
    }
  })

  it('edge with named port handles — no crash', () => {
    const nodes = [
      nd('a', 0, 0, 100, 50, { ports: [{ id: 'out', side: 'right', offset: 0.5 }] }),
      nd('b', 200, 0),
    ]
    const edges: EdgeData[] = [{ id: 'e1', source: 'a', target: 'b', sourceHandle: 'out' }]
    expect(() => ht.findEdgeAt(edges, makeMap(nodes), 150, 25, 1)).not.toThrow()
  })
})
