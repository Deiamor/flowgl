import { describe, it, expect } from 'vitest'
import {
  stepWaypoints,
  buildStraightStrip,
  buildPolylineStrip,
  edgeControlPoints,
  cubicBezierPoint,
  buildBezierStrip,
  EDGE_FLOATS_PER_VERT,
  BEZIER_SEGMENTS,
} from '../renderer/webgl/util/bezier'

// ── helpers ────────────────────────────────────────────────────────────────

/** Extract position of vertex i from a flat strip buffer */
function vertPos(data: Float32Array, i: number): [number, number] {
  const base = i * EDGE_FLOATS_PER_VERT
  return [data[base]!, data[base + 1]!]
}

// ── stepWaypoints ──────────────────────────────────────────────────────────

describe('stepWaypoints', () => {
  it('H→H: returns 4-point horizontal Z-path', () => {
    const pts = stepWaypoints(0, 0, 'right', 100, 50, 'left')
    expect(pts).toHaveLength(4)
    const [p0, p1, p2, p3] = pts
    expect(p0).toEqual([0, 0])
    expect(p1![0]).toBe(50)   // midpoint x
    expect(p1![1]).toBe(0)    // same y as source
    expect(p2![0]).toBe(50)   // midpoint x
    expect(p2![1]).toBe(50)   // same y as target
    expect(p3).toEqual([100, 50])
  })

  it('V→V: returns 4-point vertical Z-path', () => {
    const pts = stepWaypoints(0, 0, 'top', 100, 100, 'bottom')
    expect(pts).toHaveLength(4)
    const my = (0 + 100) / 2
    expect(pts[1]).toEqual([0, my])
    expect(pts[2]).toEqual([100, my])
  })

  it('H→V (srcH, !tgtH): returns 3-point L-path', () => {
    const pts = stepWaypoints(0, 0, 'right', 100, 50, 'top')
    expect(pts).toHaveLength(3)
    expect(pts[1]).toEqual([100, 0])
    expect(pts[2]).toEqual([100, 50])
  })

  it('V→H (!srcH, tgtH): returns 3-point L-path', () => {
    const pts = stepWaypoints(0, 0, 'bottom', 100, 50, 'left')
    expect(pts).toHaveLength(3)
    expect(pts[1]).toEqual([0, 50])
    expect(pts[2]).toEqual([100, 50])
  })

  it('undefined handles → treated as horizontal', () => {
    const pts = stepWaypoints(0, 0, undefined, 100, 50, undefined)
    expect(pts).toHaveLength(4)
  })

  it('same source and target point — no crash', () => {
    const pts = stepWaypoints(50, 50, 'right', 50, 50, 'left')
    expect(pts.length).toBeGreaterThan(0)
  })

  it('source to the right of target (backward) — midpoint still between them', () => {
    const pts = stepWaypoints(200, 100, 'right', 50, 100, 'left')
    // midpoint x = (200 + 50)/2 = 125
    expect(pts[1]![0]).toBeCloseTo(125)
  })
})

// ── edgeControlPoints ─────────────────────────────────────────────────────

describe('edgeControlPoints', () => {
  it('right→left forward: control points are between source and target', () => {
    const [c1x, c1y, c2x, c2y] = edgeControlPoints(0, 25, 'right', 200, 25, 'left')
    expect(c1x).toBeGreaterThan(0)
    expect(c1x).toBeLessThan(200)
    expect(c2x).toBeGreaterThan(0)
    expect(c2x).toBeLessThan(200)
    expect(c1y).toBeCloseTo(25)
    expect(c2y).toBeCloseTo(25)
  })

  it('right→left backward (target behind source): boosts control arms outward', () => {
    // Target is to the LEFT of source — backward mode
    const [c1x, , c2x] = edgeControlPoints(200, 25, 'right', 0, 25, 'left')
    // In backward mode both arms extend outward (U-shape)
    expect(c1x).toBeGreaterThan(200)
    expect(c2x).toBeLessThan(0)
  })

  it('top→bottom vertical forward', () => {
    const [c1x, c1y, c2x, c2y] = edgeControlPoints(50, 0, 'top', 50, 200, 'bottom')
    expect(c1y).toBeLessThan(0)     // arm extends upward (away from source)
    expect(c2y).toBeGreaterThan(200) // arm extends downward
    expect(c1x).toBeCloseTo(50)
    expect(c2x).toBeCloseTo(50)
  })

  it('bottom→top vertical backward: boosts control arms', () => {
    const [, c1y, , c2y] = edgeControlPoints(50, 200, 'bottom', 50, 0, 'top')
    expect(c1y).toBeGreaterThan(200)
    expect(c2y).toBeLessThan(0)
  })

  it('default handles (right→left)', () => {
    const [c1x, c1y, c2x, c2y] = edgeControlPoints(0, 0, undefined, 200, 0, undefined)
    expect(typeof c1x).toBe('number')
    expect(typeof c1y).toBe('number')
    expect(typeof c2x).toBe('number')
    expect(typeof c2y).toBe('number')
    expect(isFinite(c1x)).toBe(true)
    expect(isFinite(c2x)).toBe(true)
  })

  it('left→right handles', () => {
    const [c1x, , c2x] = edgeControlPoints(200, 25, 'left', 0, 25, 'right')
    expect(isFinite(c1x)).toBe(true)
    expect(isFinite(c2x)).toBe(true)
  })

  it('zero-distance edge (self-loop) — returns finite values', () => {
    const [c1x, c1y, c2x, c2y] = edgeControlPoints(100, 100, 'right', 100, 100, 'left')
    expect(isFinite(c1x)).toBe(true)
    expect(isFinite(c1y)).toBe(true)
    expect(isFinite(c2x)).toBe(true)
    expect(isFinite(c2y)).toBe(true)
  })

  it('large cross-axis distance — returns finite (no overflow)', () => {
    const [c1x, c1y, c2x, c2y] = edgeControlPoints(0, 0, 'right', -10, 10000, 'left')
    expect(isFinite(c1x)).toBe(true)
    expect(isFinite(c1y)).toBe(true)
    expect(isFinite(c2x)).toBe(true)
    expect(isFinite(c2y)).toBe(true)
  })

  it('all four source handle directions produce finite output', () => {
    const sides = ['left', 'right', 'top', 'bottom', undefined] as const
    for (const src of sides) {
      for (const tgt of sides) {
        const result = edgeControlPoints(0, 0, src, 100, 100, tgt)
        for (const v of result) expect(isFinite(v)).toBe(true)
      }
    }
  })
})

// ── cubicBezierPoint ───────────────────────────────────────────────────────

describe('cubicBezierPoint', () => {
  it('t=0 returns start point', () => {
    const [x, y] = cubicBezierPoint(0, 10, 20, 30, 40, 50, 60, 70, 80)
    expect(x).toBeCloseTo(10)
    expect(y).toBeCloseTo(20)
  })

  it('t=1 returns end point', () => {
    const [x, y] = cubicBezierPoint(1, 10, 20, 30, 40, 50, 60, 70, 80)
    expect(x).toBeCloseTo(70)
    expect(y).toBeCloseTo(80)
  })

  it('t=0.5 on straight line is midpoint', () => {
    // Degenerate bezier: all control points on the line (0,0)→(100,0)
    const [x, y] = cubicBezierPoint(0.5, 0, 0, 0, 0, 100, 0, 100, 0)
    // Standard cubic: 0.125*0 + 0.375*0 + 0.375*100 + 0.125*100 = 50
    expect(x).toBeCloseTo(50)
    expect(y).toBeCloseTo(0)
  })

  it('collinear control points: t=0.5 midpoint', () => {
    const [x] = cubicBezierPoint(0.5, 0, 0, 33, 0, 67, 0, 100, 0)
    expect(x).toBeCloseTo(50)
  })
})

// ── buildStraightStrip ─────────────────────────────────────────────────────

describe('buildStraightStrip', () => {
  it('returns 4 vertices × 7 floats', () => {
    const data = buildStraightStrip(0, 0, 100, 0, 1, 0, 0, 1, 2)
    expect(data.length).toBe(4 * EDGE_FLOATS_PER_VERT)
  })

  it('perpendicular offset is halfWidth on horizontal edge', () => {
    const hw = 3
    const data = buildStraightStrip(0, 25, 100, 25, 1, 0, 0, 1, hw)
    // v0 top (sx+ux, sy+uy), v1 bottom (sx-ux, sy-uy)
    // horizontal edge: ux=0, uy=hw
    expect(vertPos(data, 0)[1]).toBeCloseTo(25 + hw)
    expect(vertPos(data, 1)[1]).toBeCloseTo(25 - hw)
  })

  it('zero-length edge — no crash, returns finite data', () => {
    const data = buildStraightStrip(50, 50, 50, 50, 1, 0, 0, 1, 2)
    expect(data.length).toBe(4 * EDGE_FLOATS_PER_VERT)
    for (const v of data) expect(isFinite(v)).toBe(true)
  })

  it('diagonal edge — perpendicular offset is correct magnitude', () => {
    const hw = 4
    const data = buildStraightStrip(0, 0, 100, 100, 1, 0, 0, 1, hw)
    // v0 and v1 should be exactly 2*hw apart
    const [x0, y0] = vertPos(data, 0)
    const [x1, y1] = vertPos(data, 1)
    const dist = Math.hypot(x0 - x1, y0 - y1)
    expect(dist).toBeCloseTo(hw * 2)
  })
})

// ── buildPolylineStrip ────────────────────────────────────────────────────

describe('buildPolylineStrip', () => {
  it('returns empty array for 0 points', () => {
    expect(buildPolylineStrip([], 1, 0, 0, 1, 2).length).toBe(0)
  })

  it('returns empty array for 1 point', () => {
    expect(buildPolylineStrip([[0, 0]], 1, 0, 0, 1, 2).length).toBe(0)
  })

  it('2 points → 2 × 2 vertices × 7 floats', () => {
    const pts: [number, number][] = [[0, 0], [100, 0]]
    const data = buildPolylineStrip(pts, 1, 0, 0, 1, 3)
    expect(data.length).toBe(2 * 2 * EDGE_FLOATS_PER_VERT)
  })

  it('4-point step path (L-shape) — no NaN', () => {
    const pts: [number, number][] = [[0, 25], [50, 25], [50, 75], [100, 75]]
    const data = buildPolylineStrip(pts, 1, 0, 0, 1, 2)
    expect(data.length).toBe(4 * 2 * EDGE_FLOATS_PER_VERT)
    for (const v of data) {
      expect(isNaN(v)).toBe(false)
      expect(isFinite(v)).toBe(true)
    }
  })

  it('duplicate consecutive points (zero-length segment) — no NaN', () => {
    const pts: [number, number][] = [[0, 0], [50, 0], [50, 0], [100, 0]]
    const data = buildPolylineStrip(pts, 1, 0, 0, 1, 2)
    for (const v of data) {
      expect(isNaN(v)).toBe(false)
      expect(isFinite(v)).toBe(true)
    }
  })

  it('perpendicular offset equals halfWidth at endpoints', () => {
    const pts: [number, number][] = [[0, 0], [100, 0]]
    const hw = 5
    const data = buildPolylineStrip(pts, 1, 0, 0, 1, hw)
    // First pair: v0=(0, +hw), v1=(0, -hw)
    expect(vertPos(data, 0)[1]).toBeCloseTo(hw)
    expect(vertPos(data, 1)[1]).toBeCloseTo(-hw)
  })

  it('180-degree U-turn (collinear points) — no NaN', () => {
    // All points on the same line with a reversal
    const pts: [number, number][] = [[0, 0], [50, 0], [0, 0]]
    const data = buildPolylineStrip(pts, 1, 0, 0, 1, 2)
    for (const v of data) {
      expect(isNaN(v)).toBe(false)
      expect(isFinite(v)).toBe(true)
    }
  })
})

// ── buildBezierStrip ───────────────────────────────────────────────────────

describe('buildBezierStrip', () => {
  it('returns (segments+1)*2 vertices × 7 floats', () => {
    const data = buildBezierStrip(0, 0, 30, 0, 70, 100, 100, 100, 1, 0, 0, 1, 2)
    expect(data.length).toBe((BEZIER_SEGMENTS + 1) * 2 * EDGE_FLOATS_PER_VERT)
  })

  it('custom segments count respected', () => {
    const segs = 8
    const data = buildBezierStrip(0, 0, 30, 0, 70, 0, 100, 0, 1, 0, 0, 1, 2, segs)
    expect(data.length).toBe((segs + 1) * 2 * EDGE_FLOATS_PER_VERT)
  })

  it('first vertex pair is at start point', () => {
    const data = buildBezierStrip(10, 20, 40, 20, 60, 80, 90, 80, 1, 0, 0, 1, 3)
    // v0 and v1 are offset perpendicular from the start, so their average ≈ start
    const [x0, y0] = vertPos(data, 0)
    const [x1, y1] = vertPos(data, 1)
    expect((x0 + x1) / 2).toBeCloseTo(10)
    expect((y0 + y1) / 2).toBeCloseTo(20)
  })

  it('last vertex pair is at end point', () => {
    const segs = 16
    const data = buildBezierStrip(0, 0, 30, 0, 70, 100, 100, 100, 1, 0, 0, 1, 3, segs)
    const last0 = segs * 2       // second-to-last pair
    const last1 = segs * 2 + 1
    const [x0, y0] = vertPos(data, last0)
    const [x1, y1] = vertPos(data, last1)
    expect((x0 + x1) / 2).toBeCloseTo(100)
    expect((y0 + y1) / 2).toBeCloseTo(100)
  })

  it('no NaN or Infinity in output', () => {
    const data = buildBezierStrip(0, 0, 50, -50, 150, 50, 200, 0, 0.5, 0.5, 0.5, 1, 4)
    for (const v of data) {
      expect(isNaN(v)).toBe(false)
      expect(isFinite(v)).toBe(true)
    }
  })

  it('degenerate (all control points same) — no NaN', () => {
    const data = buildBezierStrip(50, 50, 50, 50, 50, 50, 50, 50, 1, 0, 0, 1, 2)
    for (const v of data) {
      expect(isNaN(v)).toBe(false)
      expect(isFinite(v)).toBe(true)
    }
  })

  it('perpendicular width at midpoint ≈ 2 × halfWidth on straight bezier', () => {
    const hw = 5
    // Straight-line bezier: control points on the line
    const segs = 4
    const data = buildBezierStrip(0, 0, 25, 0, 75, 0, 100, 0, 1, 0, 0, 1, hw, segs)
    // Middle segment index = segs/2 = 2; vertex pair (4, 5)
    const [x0, y0] = vertPos(data, 4)
    const [x1, y1] = vertPos(data, 5)
    const dist = Math.hypot(x0 - x1, y0 - y1)
    expect(dist).toBeCloseTo(hw * 2, 1)
  })
})
