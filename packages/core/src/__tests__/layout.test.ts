import { describe, it, expect } from 'vitest'
import { hierarchicalLayout, forceLayout, gridLayout, circularLayout } from '../layout/auto-layout'
import type { NodeData } from '../graph/node'
import type { EdgeData } from '../graph/edge'

const node = (id: string): NodeData => ({
  id, label: id, x: 0, y: 0, width: 120, height: 60,
})

const edge = (id: string, source: string, target: string): EdgeData => ({
  id, source, target,
})

describe('hierarchicalLayout', () => {
  it('returns empty map for zero nodes', () => {
    expect(hierarchicalLayout([], []).size).toBe(0)
  })

  it('positions every node', () => {
    const nodes = [node('a'), node('b'), node('c')]
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')]
    const result = hierarchicalLayout(nodes, edges)
    expect(result.size).toBe(3)
    for (const n of nodes) {
      expect(result.has(n.id)).toBe(true)
    }
  })

  it('places root at layer 0 (leftmost x)', () => {
    const nodes = [node('root'), node('child')]
    const edges = [edge('e1', 'root', 'child')]
    const result = hierarchicalLayout(nodes, edges)
    expect(result.get('root')!.x).toBeLessThan(result.get('child')!.x)
  })

  it('handles a cycle without throwing', () => {
    const nodes = [node('a'), node('b')]
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')]
    expect(() => hierarchicalLayout(nodes, edges)).not.toThrow()
    const result = hierarchicalLayout(nodes, edges)
    expect(result.size).toBe(2)
  })

  it('places a diamond topology with source leftmost', () => {
    const nodes = [node('s'), node('l'), node('r'), node('t')]
    const edges = [
      edge('e1', 's', 'l'), edge('e2', 's', 'r'),
      edge('e3', 'l', 't'), edge('e4', 'r', 't'),
    ]
    const result = hierarchicalLayout(nodes, edges)
    expect(result.get('s')!.x).toBeLessThan(result.get('t')!.x)
  })

  it('handles a single isolated node', () => {
    const result = hierarchicalLayout([node('solo')], [])
    expect(result.size).toBe(1)
  })
})

describe('forceLayout', () => {
  it('returns empty map for zero nodes', () => {
    expect(forceLayout([], []).size).toBe(0)
  })

  it('positions every node', () => {
    const nodes = [node('a'), node('b'), node('c')]
    const edges = [edge('e1', 'a', 'b')]
    const result = forceLayout(nodes, edges)
    expect(result.size).toBe(3)
  })

  it('output positions are finite numbers', () => {
    const nodes = [node('a'), node('b')]
    const edges = [edge('e1', 'a', 'b')]
    const result = forceLayout(nodes, edges)
    for (const [, pos] of result) {
      expect(isFinite(pos.x)).toBe(true)
      expect(isFinite(pos.y)).toBe(true)
    }
  })
})

describe('gridLayout', () => {
  it('returns empty map for zero nodes', () => {
    expect(gridLayout([], 40).size).toBe(0)
  })

  it('positions every node', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => node(`n${i}`))
    const result = gridLayout(nodes)
    expect(result.size).toBe(5)
  })

  it('places nodes in a grid pattern (rows and cols)', () => {
    const nodes = Array.from({ length: 4 }, (_, i) => node(`n${i}`))
    const result = gridLayout(nodes, 0)
    const positions = [...result.values()]
    const xs = new Set(positions.map(p => p.x))
    const ys = new Set(positions.map(p => p.y))
    // 4 nodes → 2×2 grid → 2 distinct x values and 2 distinct y values
    expect(xs.size).toBe(2)
    expect(ys.size).toBe(2)
  })
})

describe('circularLayout', () => {
  it('returns empty map for zero nodes', () => {
    expect(circularLayout([]).size).toBe(0)
  })

  it('positions a single node at (0, 0)', () => {
    const result = circularLayout([node('solo')])
    expect(result.get('solo')).toEqual({ x: 0, y: 0 })
  })

  it('positions every node', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => node(`n${i}`))
    const result = circularLayout(nodes)
    expect(result.size).toBe(5)
  })

  it('all nodes are equidistant from the center', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => node(`n${i}`))
    const result = circularLayout(nodes)
    const distances = [...result.values()].map(p => {
      const cx = p.x + 60, cy = p.y + 30  // add half node dims to get center
      return Math.round(Math.hypot(cx, cy))
    })
    const first = distances[0]!
    for (const d of distances) expect(d).toBe(first)
  })

  it('respects explicit radius', () => {
    const nodes = [node('a'), node('b'), node('c'), node('d')]
    const r = 200
    const result = circularLayout(nodes, r)
    for (const [, pos] of result) {
      const cx = pos.x + 60, cy = pos.y + 30
      expect(Math.round(Math.hypot(cx, cy))).toBeCloseTo(r, -1)
    }
  })

  it('output positions are finite numbers', () => {
    const nodes = Array.from({ length: 8 }, (_, i) => node(`n${i}`))
    const result = circularLayout(nodes)
    for (const [, pos] of result) {
      expect(isFinite(pos.x)).toBe(true)
      expect(isFinite(pos.y)).toBe(true)
    }
  })
})
