import { describe, it, expect } from 'vitest'
import { cullNodes } from '../renderer/webgl/cull'
import type { NodeData } from '../graph/node'
import type { AABB } from '../viewport/viewport'

function nd(id: string, x: number, y: number, w = 100, h = 50, extra: Partial<NodeData> = {}): NodeData {
  return { id, label: id, x, y, width: w, height: h, ...extra }
}

const BOUNDS: AABB = { minX: 0, minY: 0, maxX: 800, maxY: 600 }

describe('cullNodes', () => {
  it('returns nodes fully inside viewport', () => {
    const nodes = [nd('a', 100, 100)]
    expect(cullNodes(nodes, BOUNDS)).toHaveLength(1)
  })

  it('culls nodes fully outside viewport (right)', () => {
    const nodes = [nd('a', 900, 100)]
    expect(cullNodes(nodes, BOUNDS)).toHaveLength(0)
  })

  it('culls nodes fully outside viewport (bottom)', () => {
    const nodes = [nd('a', 100, 700)]
    expect(cullNodes(nodes, BOUNDS)).toHaveLength(0)
  })

  it('includes node that partially overlaps right edge (x <= maxX)', () => {
    const nodes = [nd('a', 750, 100, 200)]
    expect(cullNodes(nodes, BOUNDS)).toHaveLength(1)
  })

  it('culls node whose left edge is past maxX', () => {
    const nodes = [nd('a', 801, 100)]
    expect(cullNodes(nodes, BOUNDS)).toHaveLength(0)
  })

  it('includes node that partially overlaps left edge (x+w >= minX)', () => {
    const nodes = [nd('a', -50, 100, 100)]
    expect(cullNodes(nodes, BOUNDS)).toHaveLength(1)
  })

  // ── Group / child culling fix ──────────────────────────────────────────────

  it('child inside visible group is kept even when child is beyond viewport edge', () => {
    // Group spans x=600..1000 (partially off screen to the right)
    // but its left edge (600) is within maxX=800 → group is visible
    const group = nd('g', 600, 0, 400, 500, { type: 'group' })
    // Child is at x=850 (beyond maxX=800) — normally would be culled
    const child = nd('c', 850, 100, 100, 50, { parentId: 'g' })
    const result = cullNodes([group, child], BOUNDS)
    expect(result.map(n => n.id)).toContain('c')
    expect(result.map(n => n.id)).toContain('g')
  })

  it('child of culled group is also culled', () => {
    // Group is fully off screen to the right
    const group = nd('g', 900, 0, 200, 200, { type: 'group' })
    const child = nd('c', 950, 50, 80, 40, { parentId: 'g' })
    const result = cullNodes([group, child], BOUNDS)
    expect(result).toHaveLength(0)
  })

  it('child without parentId is culled independently', () => {
    const child = nd('c', 900, 100)
    expect(cullNodes([child], BOUNDS)).toHaveLength(0)
  })

  it('child of visible group at extreme offset is preserved', () => {
    // Simulates dragging group right until child is well outside viewport
    const group = nd('g', 400, 100, 800, 400, { type: 'group' })
    const child = nd('c', 1100, 200, 100, 50, { parentId: 'g' })
    const result = cullNodes([group, child], BOUNDS)
    expect(result.map(n => n.id)).toContain('c')
  })

  it('multiple children of visible group all kept', () => {
    const group = nd('g', 600, 0, 400, 600, { type: 'group' })
    const c1 = nd('c1', 850, 50,  80, 40, { parentId: 'g' })
    const c2 = nd('c2', 900, 200, 80, 40, { parentId: 'g' })
    const c3 = nd('c3', 650, 400, 80, 40, { parentId: 'g' }) // inside viewport
    const result = cullNodes([group, c1, c2, c3], BOUNDS)
    expect(result).toHaveLength(4)
  })

  it('node with parentId pointing to non-group node is culled independently', () => {
    // Regular node (not type='group') used as parent — should not grant cull exemption
    const parent = nd('p', 100, 100)
    const child  = nd('c', 900, 100, 100, 50, { parentId: 'p' })
    const result = cullNodes([parent, child], BOUNDS)
    expect(result.map(n => n.id)).not.toContain('c')
  })

  it('group at left edge (x+width just inside minX) is visible', () => {
    const group = nd('g', -300, 100, 350, 100, { type: 'group' })
    const child = nd('c', -200, 120, 80, 40, { parentId: 'g' })
    const result = cullNodes([group, child], BOUNDS)
    expect(result.map(n => n.id)).toContain('g')
    expect(result.map(n => n.id)).toContain('c')
  })

  it('group fully off-screen to left — child also culled', () => {
    const group = nd('g', -400, 100, 100, 100, { type: 'group' })
    const child = nd('c', -350, 120, 50, 50, { parentId: 'g' })
    expect(cullNodes([group, child], BOUNDS)).toHaveLength(0)
  })
})
