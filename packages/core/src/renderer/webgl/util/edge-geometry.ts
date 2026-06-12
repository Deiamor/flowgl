// Shared edge geometry helpers — single source of truth for the 4-branch
// path decision used by all renderers AND every label/anchor/hit/cull
// consumer.
//
// Prior to 0.8.1 every consumer of edge geometry (hit testing, label
// position in 3 renderers, HTML label overlay, EdgeToolbar anchor, SVG
// export, viewport culling, atlas cache key) re-derived the path
// individually — and most of them got at least one branch wrong. The
// regression that triggered this rewrite: dragging the middle of a
// bezier edge inserted a waypoint, the renderer switched to a polyline,
// but the hit tester kept aiming at the original bezier so clicks
// missed. Six other consumers had the same class of bug.
//
// Going forward, anything that needs to know "where the edge actually
// is" reads it from here.

import type { EdgeData } from '../../../graph/edge'
import {
  DEFAULT_SMOOTHSTEP_BORDER_RADIUS,
  DEFAULT_SMOOTHSTEP_ARC_SEGMENTS,
} from '../../../graph/edge'
import type { NodeData } from '../../../graph/node'
import { handleXY } from './handle-xy'
import {
  cubicBezierPoint,
  edgeControlPoints,
  stepWaypoints,
  smoothStepWaypoints,
  BEZIER_SEGMENTS,
} from './bezier'

/**
 * Returns the actual rendered polyline for `edge`, in source-to-target
 * order. Walks the same 4-branch decision as Canvas2D + WebGL2 renderers:
 *   waypoints override → straight → step → smoothstep → bezier (sampled)
 *
 * For the bezier case the curve is sampled at `BEZIER_SEGMENTS+1` points
 * (the same sampling the WebGL2 polyline strip builder uses), so the
 * returned points approximate the bezier closely enough for label
 * positioning, hit testing, culling, and SVG export. This is intentional
 * — the bezier midpoint by arc length is not closed-form, and the
 * renderer also approximates.
 */
export function edgePathPoints(
  edge: EdgeData,
  src: NodeData,
  tgt: NodeData,
): [number, number][] {
  const [sx, sy] = handleXY(src, edge.sourceHandle ?? 'right')
  const [ex, ey] = handleXY(tgt, edge.targetHandle ?? 'left')

  if (edge.waypoints && edge.waypoints.length > 0) {
    return [[sx, sy], ...edge.waypoints.map(w => [w.x, w.y] as [number, number]), [ex, ey]]
  }
  if (edge.type === 'straight') return [[sx, sy], [ex, ey]]
  if (edge.type === 'step') return stepWaypoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle)
  if (edge.type === 'smoothstep') {
    const br = edge.pathOptions?.borderRadius ?? DEFAULT_SMOOTHSTEP_BORDER_RADIUS
    const seg = edge.pathOptions?.arcSegments ?? DEFAULT_SMOOTHSTEP_ARC_SEGMENTS
    return smoothStepWaypoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle, br, seg)
  }
  const [c1x, c1y, c2x, c2y] = edgeControlPoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle)
  const out: [number, number][] = []
  for (let i = 0; i <= BEZIER_SEGMENTS; i++) {
    out.push(cubicBezierPoint(i / BEZIER_SEGMENTS, sx, sy, c1x, c1y, c2x, c2y, ex, ey))
  }
  return out
}

/**
 * World-space midpoint by arc length along the edge's rendered path.
 * Use for label anchors, toolbar anchors, EdgeLabel HTML overlays —
 * anywhere a "halfway along the visible line" position is needed.
 *
 * The arc-length walk is robust to non-uniform sampling (e.g. dense
 * arc-segment samples on smoothstep corners do not pull the midpoint
 * toward the corners).
 */
export function edgeMidpoint(
  edge: EdgeData,
  src: NodeData,
  tgt: NodeData,
): [number, number] {
  const pts = edgePathPoints(edge, src, tgt)
  if (pts.length < 2) return pts[0] ?? [0, 0]
  let total = 0
  const segLens: number[] = new Array(pts.length - 1)
  for (let i = 0; i + 1 < pts.length; i++) {
    const d = Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1])
    segLens[i] = d
    total += d
  }
  if (total === 0) return pts[0]!
  const half = total / 2
  let cum = 0
  for (let i = 0; i < segLens.length; i++) {
    const next = cum + segLens[i]!
    if (next >= half) {
      const t = (half - cum) / (segLens[i] || 1)
      const a = pts[i]!, b = pts[i + 1]!
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    }
    cum = next
  }
  return pts[pts.length - 1]!
}

/**
 * Tight world-space AABB of the rendered path (includes waypoints, step
 * corners, smoothstep arc samples). Use for viewport culling — the
 * endpoint-only AABB previously used by `cullEdges` was incorrect for
 * waypoint-edited and step-routed edges.
 */
export function edgeBoundingBox(
  edge: EdgeData,
  src: NodeData,
  tgt: NodeData,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const pts = edgePathPoints(edge, src, tgt)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Stable fingerprint that captures every input affecting the rendered
 * path. Use as a cache key wherever you cache per-edge geometry. Prior
 * caches (atlas SDF labels, WebGL strip cache) keyed only on src/tgt
 * positions, so identical-endpoint edges with different `type`,
 * `waypoints`, or `pathOptions` collided.
 */
export function edgePathFingerprint(edge: EdgeData, src: NodeData, tgt: NodeData): string {
  const wpts = edge.waypoints ? edge.waypoints.map(w => `${w.x},${w.y}`).join(';') : ''
  const po = edge.pathOptions ? `${edge.pathOptions.borderRadius ?? ''},${edge.pathOptions.arcSegments ?? ''}` : ''
  return `${src.x},${src.y},${src.width},${src.height}|${tgt.x},${tgt.y},${tgt.width},${tgt.height}|${edge.sourceHandle ?? ''},${edge.targetHandle ?? ''}|${edge.type ?? ''}|${po}|${wpts}`
}
