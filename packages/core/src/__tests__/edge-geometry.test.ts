import { describe, it, expect } from 'vitest'
import { edgePathPoints, edgeMidpoint, edgeBoundingBox, edgePathFingerprint } from '../renderer/webgl/util/edge-geometry'
import type { EdgeData } from '../graph/edge'
import type { NodeData } from '../graph/node'

const src: NodeData = { id: 's', label: 's', x: 0,   y: 0, width: 100, height: 60 }
const tgt: NodeData = { id: 't', label: 't', x: 400, y: 0, width: 100, height: 60 }

describe('edgePathPoints — every renderer branch', () => {
  it('default (bezier) returns sampled curve, starts at src right and ends at tgt left', () => {
    const e: EdgeData = { id: 'e', source: 's', target: 't' }
    const pts = edgePathPoints(e, src, tgt)
    expect(pts.length).toBeGreaterThan(2)
    expect(pts[0]).toEqual([100, 30])
    expect(pts[pts.length - 1]).toEqual([400, 30])
  })

  it('straight returns exactly 2 points (handles)', () => {
    const e: EdgeData = { id: 'e', source: 's', target: 't', type: 'straight' }
    expect(edgePathPoints(e, src, tgt)).toEqual([[100, 30], [400, 30]])
  })

  it('step returns the orthogonal polyline corners', () => {
    const e: EdgeData = { id: 'e', source: 's', target: 't', type: 'step', sourceHandle: 'right', targetHandle: 'left' }
    const pts = edgePathPoints(e, src, tgt)
    expect(pts[0]).toEqual([100, 30])
    expect(pts[pts.length - 1]).toEqual([400, 30])
    expect(pts.length).toBe(4)
  })

  it('smoothstep with a real vertical offset adds arc samples around the corners', () => {
    const tgtOff: NodeData = { id: 't', label: 't', x: 400, y: 200, width: 100, height: 60 }
    const e: EdgeData = { id: 'e', source: 's', target: 't', type: 'smoothstep', sourceHandle: 'right', targetHandle: 'left' }
    const pts = edgePathPoints(e, src, tgtOff)
    expect(pts[0]).toEqual([100, 30])
    expect(pts[pts.length - 1]).toEqual([400, 230])
    expect(pts.length).toBeGreaterThan(4)
  })

  it('waypoints override type — polyline through user-added points', () => {
    const e: EdgeData = {
      id: 'e', source: 's', target: 't', type: 'bezier',
      waypoints: [{ x: 200, y: 200 }, { x: 300, y: 200 }],
    }
    expect(edgePathPoints(e, src, tgt)).toEqual([
      [100, 30], [200, 200], [300, 200], [400, 30],
    ])
  })

  it('handles default to source-right / target-left', () => {
    const e: EdgeData = { id: 'e', source: 's', target: 't', type: 'straight' }
    expect(edgePathPoints(e, src, tgt)[0]).toEqual([100, 30])
    expect(edgePathPoints(e, src, tgt)[1]).toEqual([400, 30])
  })

  it('explicit handles route through the chosen sides', () => {
    const e: EdgeData = { id: 'e', source: 's', target: 't', type: 'straight', sourceHandle: 'bottom', targetHandle: 'top' }
    const pts = edgePathPoints(e, src, tgt)
    expect(pts[0]).toEqual([50, 60])
    expect(pts[1]).toEqual([450, 0])
  })
})

describe('edgeMidpoint — arc-length walk', () => {
  it('straight: halfway between handles', () => {
    const e: EdgeData = { id: 'e', source: 's', target: 't', type: 'straight' }
    expect(edgeMidpoint(e, src, tgt)).toEqual([250, 30])
  })

  it('step horizontal: lies on the mid leg', () => {
    const e: EdgeData = { id: 'e', source: 's', target: 't', type: 'step', sourceHandle: 'right', targetHandle: 'left' }
    const [mx, my] = edgeMidpoint(e, src, tgt)
    expect(my).toBe(30)
    expect(mx).toBeGreaterThanOrEqual(100)
    expect(mx).toBeLessThanOrEqual(400)
  })

  it('waypoint inserted at (250, 200): midpoint by arc length lies near the waypoint', () => {
    const e: EdgeData = {
      id: 'e', source: 's', target: 't',
      waypoints: [{ x: 250, y: 200 }],
    }
    // src.right=(100,30), waypoint=(250,200), tgt.left=(400,30)
    // leg1 = hypot(150,170) ≈ 226.7, leg2 = hypot(150,-170) ≈ 226.7
    // total ≈ 453.4, half ≈ 226.7 → arrives exactly at the waypoint (within FP slack)
    const [mx, my] = edgeMidpoint(e, src, tgt)
    expect(mx).toBeCloseTo(250, 1)
    expect(my).toBeCloseTo(200, 1)
  })

  it('bezier midpoint is roughly halfway between handles (within sampling tolerance)', () => {
    const e: EdgeData = { id: 'e', source: 's', target: 't' }
    const [mx] = edgeMidpoint(e, src, tgt)
    expect(mx).toBeGreaterThan(200)
    expect(mx).toBeLessThan(300)
  })
})

describe('edgeBoundingBox — rendered path AABB', () => {
  it('straight: tight AABB on the segment', () => {
    const e: EdgeData = { id: 'e', source: 's', target: 't', type: 'straight' }
    expect(edgeBoundingBox(e, src, tgt)).toEqual({ minX: 100, minY: 30, maxX: 400, maxY: 30 })
  })

  it('waypoints push the AABB out of the src/tgt envelope', () => {
    const e: EdgeData = {
      id: 'e', source: 's', target: 't',
      waypoints: [{ x: 250, y: 800 }],
    }
    const bb = edgeBoundingBox(e, src, tgt)
    expect(bb.maxY).toBeGreaterThanOrEqual(800)
  })

  it('step: AABB includes the corner', () => {
    const tgt2: NodeData = { id: 't', label: 't', x: 200, y: 200, width: 80, height: 60 }
    const e: EdgeData = { id: 'e', source: 's', target: 't', type: 'step', sourceHandle: 'right', targetHandle: 'top' }
    const bb = edgeBoundingBox(e, src, tgt2)
    expect(bb.maxX).toBeGreaterThanOrEqual(240)
    expect(bb.maxY).toBeGreaterThanOrEqual(200)
  })
})

describe('edgePathFingerprint — captures every input affecting the path', () => {
  function fp(edge: EdgeData) { return edgePathFingerprint(edge, src, tgt) }

  it('changes when type changes', () => {
    expect(fp({ id: 'e', source: 's', target: 't', type: 'bezier' }))
      .not.toBe(fp({ id: 'e', source: 's', target: 't', type: 'step' }))
  })

  it('changes when waypoints change', () => {
    expect(fp({ id: 'e', source: 's', target: 't' }))
      .not.toBe(fp({ id: 'e', source: 's', target: 't', waypoints: [{ x: 250, y: 200 }] }))
  })

  it('changes when pathOptions.borderRadius changes', () => {
    expect(fp({ id: 'e', source: 's', target: 't', type: 'smoothstep' }))
      .not.toBe(fp({ id: 'e', source: 's', target: 't', type: 'smoothstep', pathOptions: { borderRadius: 24 } }))
  })

  it('stays the same when only label changes (label is not in fingerprint)', () => {
    expect(fp({ id: 'e', source: 's', target: 't' }))
      .toBe(fp({ id: 'e', source: 's', target: 't', label: 'A' }))
  })
})
