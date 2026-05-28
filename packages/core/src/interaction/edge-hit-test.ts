import type { EdgeData } from '../graph/edge'
import type { NodeData } from '../graph/node'
import { cubicBezierPoint, edgeControlPoints } from '../renderer/webgl/util/bezier'

const SAMPLES   = 40   // points sampled along the bezier for hit detection
const HIT_PX    = 8    // screen-space tolerance in pixels

function handleXY(node: NodeData, side: string | undefined): [number, number] {
  const cx = node.x + node.width  / 2
  const cy = node.y + node.height / 2
  switch (side) {
    case 'top':    return [cx, node.y]
    case 'bottom': return [cx, node.y + node.height]
    case 'left':   return [node.x, cy]
    case 'right':  return [node.x + node.width, cy]
    default:       return [node.x + node.width, cy]
  }
}

export class EdgeHitTester {
  /** Returns the topmost edge whose bezier passes within HIT_PX/zoom of (wx, wy). */
  findEdgeAt(
    edges: EdgeData[],
    nodeMap: Map<string, NodeData>,
    wx: number,
    wy: number,
    zoom: number,
  ): EdgeData | null {
    const threshold = HIT_PX / zoom

    for (let i = edges.length - 1; i >= 0; i--) {
      const edge = edges[i]!
      const src = nodeMap.get(edge.source)
      const tgt = nodeMap.get(edge.target)
      if (!src || !tgt) continue

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
