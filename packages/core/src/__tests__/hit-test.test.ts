import { describe, it, expect } from 'vitest'
import { HitTester } from '../interaction/hit-test'
import type { NodeData } from '../graph/node'

const nd = (id: string, x: number, y: number, w = 100, h = 50): NodeData => ({
  id, label: id, x, y, width: w, height: h,
})

describe('HitTester', () => {
  const ht = new HitTester()

  // ── findNodeAt ────────────────────────────────────────────────────────────

  it('returns null for empty node list', () => {
    expect(ht.findNodeAt([], 50, 50)).toBeNull()
  })

  it('returns node when point is inside it', () => {
    const nodes = [nd('a', 0, 0)]
    expect(ht.findNodeAt(nodes, 50, 25)?.id).toBe('a')
  })

  it('returns null when point is outside all nodes', () => {
    const nodes = [nd('a', 0, 0)]
    expect(ht.findNodeAt(nodes, 200, 200)).toBeNull()
  })

  it('returns null when point is exactly outside right edge', () => {
    const nodes = [nd('a', 0, 0, 100, 50)]
    expect(ht.findNodeAt(nodes, 101, 25)).toBeNull()
  })

  it('returns node when point is exactly on left edge', () => {
    const nodes = [nd('a', 0, 0)]
    expect(ht.findNodeAt(nodes, 0, 25)?.id).toBe('a')
  })

  it('returns node when point is exactly on right edge', () => {
    const nodes = [nd('a', 0, 0, 100, 50)]
    expect(ht.findNodeAt(nodes, 100, 25)?.id).toBe('a')
  })

  it('returns node when point is exactly on top edge', () => {
    const nodes = [nd('a', 0, 0)]
    expect(ht.findNodeAt(nodes, 50, 0)?.id).toBe('a')
  })

  it('returns node when point is exactly on bottom edge', () => {
    const nodes = [nd('a', 0, 0, 100, 50)]
    expect(ht.findNodeAt(nodes, 50, 50)?.id).toBe('a')
  })

  it('returns topmost (last in array) when overlapping', () => {
    const nodes = [nd('a', 0, 0), nd('b', 0, 0)]
    expect(ht.findNodeAt(nodes, 50, 25)?.id).toBe('b')
  })

  it('returns first node when second does not overlap point', () => {
    const nodes = [nd('a', 0, 0), nd('b', 500, 500)]
    expect(ht.findNodeAt(nodes, 50, 25)?.id).toBe('a')
  })

  it('handles negative coordinates', () => {
    const nodes = [nd('a', -200, -100, 100, 50)]
    expect(ht.findNodeAt(nodes, -150, -75)?.id).toBe('a')
    expect(ht.findNodeAt(nodes, 0, 0)).toBeNull()
  })

  it('handles large coordinates', () => {
    const nodes = [nd('a', 10000, 10000, 100, 50)]
    expect(ht.findNodeAt(nodes, 10050, 10025)?.id).toBe('a')
  })

  it('returns null when point is 1px outside top', () => {
    const nodes = [nd('a', 0, 10, 100, 50)]
    expect(ht.findNodeAt(nodes, 50, 9)).toBeNull()
  })

  it('finds node among many when only one matches', () => {
    const nodes = [
      nd('a', 0, 0),
      nd('b', 200, 0),
      nd('c', 400, 0),
      nd('d', 600, 0),
    ]
    expect(ht.findNodeAt(nodes, 250, 25)?.id).toBe('b')
  })

  // ── findNodesInBox ────────────────────────────────────────────────────────

  it('returns empty for empty node list', () => {
    expect(ht.findNodesInBox([], 0, 0, 100, 100)).toEqual([])
  })

  it('returns node when fully inside box', () => {
    const nodes = [nd('a', 10, 10, 50, 30)]
    const result = ht.findNodesInBox(nodes, 0, 0, 100, 100)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('a')
  })

  it('returns empty when node is completely outside box', () => {
    const nodes = [nd('a', 200, 200, 50, 30)]
    expect(ht.findNodesInBox(nodes, 0, 0, 100, 100)).toHaveLength(0)
  })

  it('returns node when partially overlapping box (AABB intersection)', () => {
    const nodes = [nd('a', 50, 50, 100, 50)]
    const result = ht.findNodesInBox(nodes, 0, 0, 80, 80)
    expect(result).toHaveLength(1)
  })

  it('excludes node just touching box right edge', () => {
    // node.x = 100 >= maxX=100, so no overlap (strict <)
    const nodes = [nd('a', 100, 0, 50, 50)]
    expect(ht.findNodesInBox(nodes, 0, 0, 100, 100)).toHaveLength(0)
  })

  it('returns multiple overlapping nodes', () => {
    const nodes = [nd('a', 0, 0), nd('b', 10, 10), nd('c', 500, 500)]
    const result = ht.findNodesInBox(nodes, 0, 0, 200, 200)
    expect(result.map(n => n.id).sort()).toEqual(['a', 'b'])
  })

  it('box that exactly matches node boundaries captures it', () => {
    const nodes = [nd('a', 0, 0, 100, 50)]
    const result = ht.findNodesInBox(nodes, 0, 0, 100, 50)
    // node right=100 > minX=0 ✓, node left=0 < maxX=100 ✓
    // node bottom=50 > minY=0 ✓, node top=0 < maxY=50 ✓
    expect(result).toHaveLength(1)
  })

  it('box to the left of all nodes returns empty', () => {
    const nodes = [nd('a', 100, 0), nd('b', 200, 0)]
    expect(ht.findNodesInBox(nodes, -100, -100, 50, 100)).toHaveLength(0)
  })

  it('single-pixel box hits node when inside', () => {
    const nodes = [nd('a', 0, 0, 100, 50)]
    const result = ht.findNodesInBox(nodes, 50, 25, 51, 26)
    expect(result).toHaveLength(1)
  })
})
