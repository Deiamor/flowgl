// Floats per vertex for edge triangle-strip geometry
export const EDGE_FLOATS_PER_VERT = 7  // pos(2) + arcLen(1) + color(4)
export const BEZIER_SEGMENTS = 32

/**
 * Compute waypoints for an orthogonal (step) edge.
 * The path exits source in the handle direction, turns 90°, and enters target
 * from the opposite of targetHandle's direction.
 */
export function stepWaypoints(
  sx: number, sy: number, sourceHandle: string | undefined,
  ex: number, ey: number, targetHandle: string | undefined,
): [number, number][] {
  const isH = (h: string | undefined) => h === 'left' || h === 'right' || h == null
  const srcH = isH(sourceHandle)
  const tgtH = isH(targetHandle)

  if (srcH && tgtH) {
    const mx = (sx + ex) / 2
    return [[sx, sy], [mx, sy], [mx, ey], [ex, ey]]
  }
  if (!srcH && !tgtH) {
    const my = (sy + ey) / 2
    return [[sx, sy], [sx, my], [ex, my], [ex, ey]]
  }
  if (srcH && !tgtH) {
    return [[sx, sy], [ex, sy], [ex, ey]]
  }
  return [[sx, sy], [sx, ey], [ex, ey]]
}

/**
 * Take the sharp orthogonal polyline from `stepWaypoints` and fillet every
 * interior 90° corner with a quarter-circle of radius `r`. Returns a denser
 * polyline; each interior corner contributes `segments` extra samples.
 *
 * `r` is automatically clamped to half the shorter incident segment so the
 * arc never crosses the previous/next segment endpoints.
 *
 * The same sampled polyline is used by both renderers — WebGL feeds it into
 * `buildPolylineStrip`, Canvas2D walks it with `lineTo`. Identical geometry
 * on both = T5 parity for `'smoothstep'`.
 */
export function smoothStepWaypoints(
  sx: number, sy: number, sourceHandle: string | undefined,
  ex: number, ey: number, targetHandle: string | undefined,
  radius = 8,
  segments = 8,
): [number, number][] {
  const corners = stepWaypoints(sx, sy, sourceHandle, ex, ey, targetHandle)
  if (corners.length <= 2 || radius <= 0 || segments < 1) return corners

  const out: [number, number][] = [corners[0]!]
  for (let i = 1; i < corners.length - 1; i++) {
    const prev = corners[i - 1]!
    const curr = corners[i]!
    const next = corners[i + 1]!
    const v1x = curr[0] - prev[0], v1y = curr[1] - prev[1]
    const v2x = next[0] - curr[0], v2y = next[1] - curr[1]
    const l1 = Math.hypot(v1x, v1y)
    const l2 = Math.hypot(v2x, v2y)
    const r = Math.min(radius, l1 / 2, l2 / 2)
    if (r <= 0) { out.push(curr); continue }
    const u1x = v1x / l1, u1y = v1y / l1
    const u2x = v2x / l2, u2y = v2y / l2
    const t1x = curr[0] - u1x * r, t1y = curr[1] - u1y * r
    const t2x = curr[0] + u2x * r, t2y = curr[1] + u2y * r
    // Arc center: from T1 perpendicular to incoming direction, inward.
    // cross sign picks which side of v1 the arc curves to (matches v2's side).
    const cross = u1x * u2y - u1y * u2x
    const sign = cross >= 0 ? 1 : -1
    const cx = t1x + (-u1y) * r * sign
    const cy = t1y +  u1x * r * sign
    const a1 = Math.atan2(t1y - cy, t1x - cx)
    let a2 = Math.atan2(t2y - cy, t2x - cx)
    if (sign > 0) { if (a2 < a1) a2 += 2 * Math.PI }
    else          { if (a2 > a1) a2 -= 2 * Math.PI }
    out.push([t1x, t1y])
    for (let s = 1; s <= segments; s++) {
      const t = s / segments
      const a = a1 + (a2 - a1) * t
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
    }
  }
  out.push(corners[corners.length - 1]!)
  return out
}

/**
 * Build a triangle strip for a straight line between two points.
 */
export function buildStraightStrip(
  sx: number, sy: number,
  ex: number, ey: number,
  r: number, g: number, b: number, a: number,
  halfWidth: number,
): Float32Array {
  const dx = ex - sx, dy = ey - sy
  const len = Math.hypot(dx, dy) || 1
  const ux = (-dy / len) * halfWidth, uy = (dx / len) * halfWidth
  const arcLen = len
  const data = new Float32Array(4 * EDGE_FLOATS_PER_VERT)
  let c = 0
  const write = (x: number, y: number, arc: number): void => {
    data[c++] = x; data[c++] = y; data[c++] = arc
    data[c++] = r; data[c++] = g; data[c++] = b; data[c++] = a
  }
  write(sx + ux, sy + uy, 0)
  write(sx - ux, sy - uy, 0)
  write(ex + ux, ey + uy, arcLen)
  write(ex - ux, ey - uy, arcLen)
  return data
}

/**
 * Build a triangle strip for a polyline (step/orthogonal routing).
 * Miters corners by computing per-vertex normals from adjacent segments.
 */
export function buildPolylineStrip(
  pts: [number, number][],
  r: number, g: number, b: number, a: number,
  halfWidth: number,
): Float32Array {
  if (pts.length < 2) return new Float32Array(0)

  const n = pts.length
  const data = new Float32Array(n * 2 * EDGE_FLOATS_PER_VERT)
  let c = 0, arcLen = 0

  const write = (x: number, y: number, arc: number): void => {
    data[c++] = x; data[c++] = y; data[c++] = arc
    data[c++] = r; data[c++] = g; data[c++] = b; data[c++] = a
  }

  for (let i = 0; i < n; i++) {
    const [px, py] = pts[i]!
    if (i > 0) {
      const [qx, qy] = pts[i - 1]!
      arcLen += Math.hypot(px - qx, py - qy)
    }

    let nx: number, ny: number
    if (i === 0) {
      const [qx, qy] = pts[1]!
      const dx = qx - px, dy = qy - py
      const l = Math.hypot(dx, dy) || 1
      nx = -dy / l; ny = dx / l
    } else if (i === n - 1) {
      const [qx, qy] = pts[n - 2]!
      const dx = px - qx, dy = py - qy
      const l = Math.hypot(dx, dy) || 1
      nx = -dy / l; ny = dx / l
    } else {
      // Miter: average the two segment normals
      const [ax, ay] = pts[i - 1]!
      const [bx, by] = pts[i + 1]!
      const d1x = px - ax, d1y = py - ay
      const d2x = bx - px, d2y = by - py
      const l1 = Math.hypot(d1x, d1y) || 1
      const l2 = Math.hypot(d2x, d2y) || 1
      const n1x = -d1y / l1, n1y = d1x / l1
      const n2x = -d2y / l2, n2y = d2x / l2
      nx = (n1x + n2x) / 2
      ny = (n1y + n2y) / 2
      // Normalize miter length to maintain halfWidth
      const ml = Math.hypot(nx, ny) || 1
      nx /= ml; ny /= ml
    }

    const ux = nx * halfWidth, uy = ny * halfWidth
    write(px + ux, py + uy, arcLen)
    write(px - ux, py - uy, arcLen)
  }
  return data
}

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
  // forward: cap at axisDist*0.45 so c1 never crosses c2 (prevents S-kink).
  // backward: boost with cross-axis so U-curve inflection stays away from t≈0/1.
  const mag = (forward: boolean, axisDist: number, crossDist: number): number =>
    forward
      ? Math.min(Math.max(Math.hypot(axisDist, crossDist) * 0.35, 40), axisDist * 0.45)
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
