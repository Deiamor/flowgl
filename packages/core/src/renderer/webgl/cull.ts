import type { NodeData } from '../../graph/node'
import type { EdgeData } from '../../graph/edge'
import type { AABB } from '../../viewport/viewport'

const EDGE_CULL_PADDING = 200

export function cullNodes(nodes: NodeData[], bounds: AABB): NodeData[] {
  // First pass: collect visible group IDs so children are not culled when
  // their parent group is still partially in view.
  const visibleGroupIds = new Set<string>()
  for (const n of nodes) {
    if (
      n.type === 'group' &&
      n.x + n.width  >= bounds.minX && n.x <= bounds.maxX &&
      n.y + n.height >= bounds.minY && n.y <= bounds.maxY
    ) {
      visibleGroupIds.add(n.id)
    }
  }

  return nodes.filter(n => {
    if (n.parentId && visibleGroupIds.has(n.parentId)) return true
    return (
      n.x + n.width  >= bounds.minX && n.x <= bounds.maxX &&
      n.y + n.height >= bounds.minY && n.y <= bounds.maxY
    )
  })
}

export function cullEdges(
  edges: EdgeData[],
  nodeMap: Map<string, NodeData>,
  bounds: AABB,
): EdgeData[] {
  const padded: AABB = {
    minX: bounds.minX - EDGE_CULL_PADDING,
    minY: bounds.minY - EDGE_CULL_PADDING,
    maxX: bounds.maxX + EDGE_CULL_PADDING,
    maxY: bounds.maxY + EDGE_CULL_PADDING,
  }
  return edges.filter(e => {
    const src = nodeMap.get(e.source)
    const tgt = nodeMap.get(e.target)
    if (!src || !tgt) return false
    const minX = Math.min(src.x, tgt.x)
    const minY = Math.min(src.y, tgt.y)
    const maxX = Math.max(src.x + src.width, tgt.x + tgt.width)
    const maxY = Math.max(src.y + src.height, tgt.y + tgt.height)
    return maxX >= padded.minX && minX <= padded.maxX &&
           maxY >= padded.minY && minY <= padded.maxY
  })
}

export function computeNodeBounds(nodes: NodeData[]): AABB {
  if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x + n.width  > maxX) maxX = n.x + n.width
    if (n.y + n.height > maxY) maxY = n.y + n.height
  }
  return { minX, minY, maxX, maxY }
}
