import type { EdgeData } from '../graph/edge'
import { DEFAULT_EDGE_STYLE } from '../graph/edge'
import type { NodeData } from '../graph/node'
import { edgePathPoints } from '../renderer/webgl/util/edge-geometry'

const MIN_HIT_PX = 8 // minimum screen-space tolerance in pixels

/**
 * Picks the topmost edge whose rendered geometry passes within the hit
 * area of (wx, wy). Routes through the shared `edgePathPoints` helper so
 * it stays in lockstep with what every renderer / label / toolbar draws.
 *
 * 0.8.1 history note: pre-rewrite this sampled a bezier unconditionally,
 * ignoring `waypoints` + `type`. After a user dragged the middle of an
 * edge to insert a waypoint, the visible shape switched to a polyline
 * but the hit test kept aiming at the old curve. Reported 2026-06-13;
 * the fix moved every consumer of edge geometry behind one shared helper.
 */
export class EdgeHitTester {
  findEdgeAt(
    edges: EdgeData[],
    nodeMap: Map<string, NodeData>,
    wx: number,
    wy: number,
    zoom: number,
  ): EdgeData | null {
    for (let i = edges.length - 1; i >= 0; i--) {
      const edge = edges[i]!
      const src = nodeMap.get(edge.source)
      const tgt = nodeMap.get(edge.target)
      if (!src || !tgt) continue

      const edgeHalfWidth = (edge.style?.width ?? DEFAULT_EDGE_STYLE.width) / 2
      const threshold = Math.max(MIN_HIT_PX / zoom, edgeHalfWidth)

      const pts = edgePathPoints(edge, src, tgt)
      for (let j = 0; j + 1 < pts.length; j++) {
        const a = pts[j]!, b = pts[j + 1]!
        if (pointToSegmentDistance(wx, wy, a[0], a[1], b[0], b[1]) <= threshold) return edge
      }
    }
    return null
  }
}

function pointToSegmentDistance(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const qx = ax + t * dx, qy = ay + t * dy
  return Math.hypot(px - qx, py - qy)
}
