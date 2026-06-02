import type { EdgeData } from '../graph/edge'
import { DEFAULT_EDGE_STYLE } from '../graph/edge'
import type { NodeData } from '../graph/node'
import { cubicBezierPoint, edgeControlPoints } from '../renderer/webgl/util/bezier'
import { handleXY } from '../renderer/webgl/util/handle-xy'

const SAMPLES    = 40  // points sampled along the bezier for hit detection
const MIN_HIT_PX = 8   // minimum screen-space tolerance in pixels

export class EdgeHitTester {
  /** Returns the topmost edge whose bezier passes within the hit area of (wx, wy).
   *  Hit area = max(MIN_HIT_PX, visual half-width) in screen pixels. */
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
      // threshold in world units: at least MIN_HIT_PX screen px, at least visual half-width
      const threshold = Math.max(MIN_HIT_PX / zoom, edgeHalfWidth)

      const [sx, sy] = handleXY(src, edge.sourceHandle ?? 'right')
      const [ex, ey] = handleXY(tgt, edge.targetHandle ?? 'left')
      const [c1x, c1y, c2x, c2y] = edgeControlPoints(
        sx, sy, edge.sourceHandle,
        ex, ey, edge.targetHandle,
      )

      for (let j = 0; j <= SAMPLES; j++) {
        const [px, py] = cubicBezierPoint(
          j / SAMPLES,
          sx, sy, c1x, c1y, c2x, c2y, ex, ey,
        )
        if (Math.hypot(wx - px, wy - py) <= threshold) return edge
      }
    }
    return null
  }
}
