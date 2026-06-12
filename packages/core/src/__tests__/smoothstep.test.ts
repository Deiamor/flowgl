import { describe, it, expect } from 'vitest'
import { stepWaypoints, smoothStepWaypoints } from '../renderer/webgl/util/bezier'

describe('smoothStepWaypoints — 0.7.0', () => {
  it('left→left handles: sharp polyline has 4 points; rounded has 4 + 2*(arc samples + start tangent)', () => {
    // For a horizontal-to-horizontal step routing there are 2 interior corners.
    // Each interior corner contributes 1 start-tangent + N arc samples.
    const sharp = stepWaypoints(0, 0, 'right', 200, 100, 'left')
    expect(sharp.length).toBe(4)
    const rounded = smoothStepWaypoints(0, 0, 'right', 200, 100, 'left', 10, 8)
    // expected: start corner + 2 interior corners * (1 tangent + 8 arc) + end corner
    expect(rounded.length).toBe(1 + 2 * (1 + 8) + 1)
  })

  it('top→top handles: vertical routing, 2 interior corners get rounded', () => {
    const sharp = stepWaypoints(0, 0, 'bottom', 100, 200, 'top')
    expect(sharp.length).toBe(4)
    const rounded = smoothStepWaypoints(0, 0, 'bottom', 100, 200, 'top', 10, 8)
    expect(rounded.length).toBe(1 + 2 * (1 + 8) + 1)
  })

  it('mixed handles (right→top): only 1 interior corner', () => {
    const sharp = stepWaypoints(0, 0, 'right', 200, 100, 'top')
    expect(sharp.length).toBe(3)
    const rounded = smoothStepWaypoints(0, 0, 'right', 200, 100, 'top', 10, 8)
    expect(rounded.length).toBe(1 + 1 * (1 + 8) + 1)
  })

  it('radius 0 returns the original sharp polyline', () => {
    const sharp = stepWaypoints(0, 0, 'right', 200, 100, 'left')
    const r0 = smoothStepWaypoints(0, 0, 'right', 200, 100, 'left', 0, 8)
    expect(r0).toEqual(sharp)
  })

  it('arc radius is clamped to half the shorter incident segment', () => {
    // Source at (0, 0), target at (10, 100) — incident segment lengths
    // are short. Asking for radius 1000 should still produce finite,
    // non-NaN points whose distance from the corner is ≤ half-segment.
    const pts = smoothStepWaypoints(0, 0, 'bottom', 10, 100, 'top', 1000, 8)
    for (const [x, y] of pts) {
      expect(Number.isFinite(x)).toBe(true)
      expect(Number.isFinite(y)).toBe(true)
    }
  })

  it('arcSegments < 1 falls back to sharp polyline', () => {
    const sharp = stepWaypoints(0, 0, 'right', 200, 100, 'left')
    const noArc = smoothStepWaypoints(0, 0, 'right', 200, 100, 'left', 10, 0)
    expect(noArc).toEqual(sharp)
  })

  it('first and last points of the smoothed polyline match endpoints', () => {
    const pts = smoothStepWaypoints(50, 50, 'right', 250, 150, 'left', 10, 6)
    expect(pts[0]).toEqual([50, 50])
    expect(pts[pts.length - 1]).toEqual([250, 150])
  })

  it('tangent point of the first corner sits exactly `r` away from the corner along the incoming axis', () => {
    // step path: (0,0) → (100, 0) → (100, 100) → (200, 100)
    // First interior corner at (100, 0), incoming along +x. Tangent point
    // (start of arc) should be at (100 - r, 0) = (90, 0).
    const pts = smoothStepWaypoints(0, 0, 'right', 200, 100, 'left', 10, 4)
    const tangent = pts[1]!
    expect(tangent[0]).toBeCloseTo(90, 5)
    expect(tangent[1]).toBeCloseTo(0, 5)
  })

  it('arc samples form points whose distance from the arc center equals r', () => {
    // First corner at (100, 0), arc center at (90, 10) for r=10.
    // Pick the next arc samples and verify they're at distance 10 from (90, 10).
    const pts = smoothStepWaypoints(0, 0, 'right', 200, 100, 'left', 10, 8)
    // pts[1] = tangent (90, 0). pts[2..9] = 8 arc samples.
    for (let i = 2; i < 10; i++) {
      const [x, y] = pts[i]!
      const d = Math.hypot(x - 90, y - 10)
      expect(d).toBeCloseTo(10, 5)
    }
  })
})

describe('smoothstep edge — chart-side', () => {
  it('FlowChart accepts type: "smoothstep" and round-trips through toJSON/fromJSON', async () => {
    const { FlowChart } = await import('../flowchart')
    const div = document.createElement('div')
    Object.defineProperty(div, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 }),
    })
    document.body.appendChild(div)
    const chart = new FlowChart({
      container: div,
      nodes: [
        { id: 'a', label: 'A', x: 0, y: 0, width: 80, height: 50 },
        { id: 'b', label: 'B', x: 200, y: 100, width: 80, height: 50 },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b', type: 'smoothstep', pathOptions: { borderRadius: 12 } },
      ],
      onError: () => {},
    })
    const e = chart.getEdges()[0]
    expect(e?.type).toBe('smoothstep')
    expect(e?.pathOptions?.borderRadius).toBe(12)
    chart.dispose()
    div.remove()
  })
})
