import { describe, it, expect } from 'vitest'
import { hierarchicalLayout, forceLayout, gridLayout, circularLayout } from '../layout/auto-layout'
import type { NodeData } from '../graph/node'
import type { EdgeData } from '../graph/edge'

const node = (id: string, extra: Partial<NodeData> = {}): NodeData => ({
  id, label: id, x: 0, y: 0, width: 120, height: 60, ...extra,
})

const childNode = (id: string, parentId: string, x = 10, y = 10): NodeData =>
  node(id, { parentId, x, y })

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

  it('child nodes (parentId set) follow their parent translation (0.9.1)', () => {
    // Parent originally at (50, 60); child at world (60, 70) inside it.
    // Once the parent gets a new position from the layout, the child
    // moves by the same delta — pre-0.9.1 the result skipped children
    // entirely, so they stayed at their absolute world coords and
    // visually "flew out" of the group.
    const parent = node('p', { type: 'group', x: 50, y: 60 })
    const child  = childNode('c', 'p', 60, 70)
    const result = hierarchicalLayout([parent, child], [])
    expect(result.has('p')).toBe(true)
    expect(result.has('c')).toBe(true)
    const parentNew = result.get('p')!
    const childNew  = result.get('c')!
    expect(childNew.x).toBe(parentNew.x + (60 - 50))
    expect(childNew.y).toBe(parentNew.y + (70 - 60))
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

  it('child nodes follow their parent translation (0.9.1)', () => {
    const parent = node('p', { type: 'group', x: 0, y: 0 })
    const child  = childNode('c', 'p', 15, 25)
    const result = forceLayout([parent, child], [])
    expect(result.has('p')).toBe(true)
    expect(result.has('c')).toBe(true)
    const parentNew = result.get('p')!
    const childNew  = result.get('c')!
    expect(childNew.x).toBe(parentNew.x + 15)
    expect(childNew.y).toBe(parentNew.y + 25)
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

  it('child nodes follow their parent translation (0.9.1 — the reported bug)', () => {
    // User: "그리드 정렬 하니깐 그룹 내부에 있는 노드들이 엉뚱한 곳으로
    // 튕겨나가네?" — pre-0.9.1 gridLayout only positioned roots; the
    // child's absolute world coords stayed at the OLD spot while the
    // parent jumped to a new grid cell. Visually the children "flew
    // out" of the group.
    const parent = node('p', { type: 'group', x: 300, y: 200 })
    const child  = childNode('c', 'p', 310, 220) // 10, 20 inside the parent
    const result = gridLayout([parent, child])
    expect(result.has('p')).toBe(true)
    expect(result.has('c')).toBe(true)
    const parentNew = result.get('p')!
    const childNew  = result.get('c')!
    // Child preserves its relative offset (10, 20) from the parent.
    expect(childNew.x - parentNew.x).toBe(310 - 300)
    expect(childNew.y - parentNew.y).toBe(220 - 200)
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

  it('child nodes follow their parent translation (0.9.1)', () => {
    const parent = node('p', { type: 'group', x: 0, y: 0 })
    const child  = childNode('c', 'p', 5, 8)
    const other  = node('q')
    const result = circularLayout([parent, child, other])
    expect(result.has('p')).toBe(true)
    expect(result.has('q')).toBe(true)
    expect(result.has('c')).toBe(true)
    // 2 roots + 1 child = 3 entries
    expect(result.size).toBe(3)
    const pNew = result.get('p')!
    const cNew = result.get('c')!
    expect(cNew.x - pNew.x).toBe(5)
    expect(cNew.y - pNew.y).toBe(8)
  })
})

describe('addChildTranslations — nested groups + multi-child (0.9.1)', () => {
  it('two children of the same parent both follow', () => {
    const parent = node('p', { type: 'group', x: 100, y: 100 })
    const c1 = childNode('c1', 'p', 110, 110)
    const c2 = childNode('c2', 'p', 130, 140)
    const result = gridLayout([parent, c1, c2])
    expect(result.size).toBe(3)
    const pN = result.get('p')!
    expect(result.get('c1')!.x - pN.x).toBe(10)
    expect(result.get('c1')!.y - pN.y).toBe(10)
    expect(result.get('c2')!.x - pN.x).toBe(30)
    expect(result.get('c2')!.y - pN.y).toBe(40)
  })

  it('grandchildren follow when the top-level grandparent moves', () => {
    // Top group `g` contains nested group `n`, which contains leaf `l`.
    const g = node('g', { type: 'group', x: 0, y: 0 })
    const n = node('n', { parentId: 'g', type: 'group', x: 20, y: 30 })
    const l = node('l', { parentId: 'n', x: 25, y: 40 })
    const result = gridLayout([g, n, l])
    expect(result.has('g')).toBe(true)
    expect(result.has('n')).toBe(true)
    expect(result.has('l')).toBe(true)
    const gN = result.get('g')!
    expect(result.get('n')!.x - gN.x).toBe(20)
    expect(result.get('n')!.y - gN.y).toBe(30)
    expect(result.get('l')!.x - gN.x).toBe(25)
    expect(result.get('l')!.y - gN.y).toBe(40)
  })

  it('child whose offset was zero gets translated to the same exact spot as the parent', () => {
    const p = node('p', { type: 'group', x: 0, y: 0 })
    const c = childNode('c', 'p', 0, 0)
    const result = gridLayout([p, c])
    expect(result.get('c')).toEqual(result.get('p'))
  })
})
