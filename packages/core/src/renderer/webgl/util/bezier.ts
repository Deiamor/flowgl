// Floats per vertex for edge triangle-strip geometry
export const EDGE_FLOATS_PER_VERT = 7  // pos(2) + arcLen(1) + color(4)
export const BEZIER_SEGMENTS = 16

/**
 * Compute cubic bezier control points that respect handle exit/entry directions.
 *
 * Uses axis-aware magnitude with a "backwards boost": when the target lies
 * behind the source handle's exit direction, the control offset is increased
 * using the cross-axis distance so the inflection point moves away from t≈0/1
 * and the curve looks like a clean U-arc instead of a tight S.
 */
export function edgeControlPoints(
  sx: number, sy: number, sourceHandle: string | undefined,
  ex: number, ey: number, targetHandle: string | undefined,
): [number, number, number, number] {
  const dx    = ex - sx
  const dy    = ey - sy
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  // Offset magnitude along a handle axis.
  // forward=true  → target is ahead; proportional to axis distance (min 50).
  // forward=false → target is behind; add cross-axis component so the U-curve
  //                 extends far enough to avoid a pinched inflection near t=0/1.
  const mag = (forward: boolean, axisDist: number, crossDist: number): number =>
    forward
      ? Math.max(axisDist * 0.4, 50)
      : Math.max(axisDist * 0.4 + crossDist * 0.5, 80)

  let c1x: number, c1y: number
  switch (sourceHandle) {
    case 'left':   c1x = sx - mag(dx <= 0, absDx, absDy); c1y = sy;                          break
    case 'top':    c1x = sx;                               c1y = sy - mag(dy <= 0, absDy, absDx); break
    case 'bottom': c1x = sx;                               c1y = sy + mag(dy >= 0, absDy, absDx); break
    default:       c1x = sx + mag(dx >= 0, absDx, absDy); c1y = sy;                          break
  }

  let c2x: number, c2y: number
  switch (targetHandle) {
    case 'right':  c2x = ex + mag(dx <= 0, absDx, absDy); c2y = ey;                          break
    case 'top':    c2x = ex;                               c2y = ey - mag(dy <= 0, absDy, absDx); break
    case 'bottom': c2x = ex;                               c2y = ey + mag(dy >= 0, absDy, absDx); break
    default:       c2x = ex - mag(dx >= 0, absDx, absDy); c2y = ey;                          break
  }

  return [c1x, c1y, c2x, c2y]
}

export function cubicBezierPoint(
  t: number,
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  p3x: number, p3y: number,
): [number, number] {
  const mt = 1 - t, mt2 = mt * mt, t2 = t * t
  return [
    mt2 * mt * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t2 * t * p3x,
    mt2 * mt * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t2 * t * p3y,
  ]
}

export function buildBezierStrip(
  sx: number, sy: number,
  c1x: number, c1y: number,
  c2x: number, c2y: number,
  ex: number, ey: number,
  r: number, g: number, b: number, a: number,
  halfWidth: number,
  segments = BEZIER_SEGMENTS,
): Float32Array {
  const pts: [number, number][] = []
  for (let i = 0; i <= segments; i++) {
    pts.push(cubicBezierPoint(i / segments, sx, sy, c1x, c1y, c2x, c2y, ex, ey))
  }

  const vertCount = (segments + 1) * 2
  const data = new Float32Array(vertCount * EDGE_FLOATS_PER_VERT)
  let arcLen = 0, cursor = 0

  const write = (x: number, y: number, arc: number): void => {
    data[cursor++] = x; data[cursor++] = y
    data[cursor++] = arc
    data[cursor++] = r; data[cursor++] = g; data[cursor++] = b; data[cursor++] = a
  }

  for (let i = 0; i <= segments; i++) {
    const [px, py] = pts[i]!
    if (i > 0) {
      const [qx, qy] = pts[i - 1]!
      arcLen += Math.hypot(px - qx, py - qy)
    }
    // Central difference for interior points: smoothly interpolates through
    // inflection points, preventing the 180° normal flip that causes kinks.
    let nx: number, ny: number
    if (i === 0) {
      const [qx, qy] = pts[1]!
      nx = qy - py; ny = px - qx
    } else if (i === segments) {
      const [qx, qy] = pts[segments - 1]!
      nx = py - qy; ny = qx - px
    } else {
      const [ax, ay] = pts[i - 1]!
      const [bx, by] = pts[i + 1]!
      nx = by - ay; ny = ax - bx
    }
    const len = Math.hypot(nx, ny) || 1
    const ux = nx / len * halfWidth, uy = ny / len * halfWidth
    write(px + ux, py + uy, arcLen)
    write(px - ux, py - uy, arcLen)
  }
  return data
}
