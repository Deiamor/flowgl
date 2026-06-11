import type { Graph } from '../graph/graph'
import type { NodeData } from '../graph/node'

export type AlignAxis = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
export type DistributeAxis = 'horizontal' | 'vertical'

/**
 * Align a set of nodes along the given axis. Mutations are written through
 * `graph.updateNode`; the caller is responsible for calling `beforeMutation`
 * before and scheduling a render after.
 *
 * Returns the number of nodes that were touched (callers can use this to
 * decide whether to emit a history entry).
 */
export function alignNodes(graph: Graph, nodes: NodeData[], axis: AlignAxis): number {
  if (nodes.length < 2) return 0
  switch (axis) {
    case 'left': {
      const min = Math.min(...nodes.map(n => n.x))
      for (const n of nodes) graph.updateNode(n.id, { x: min })
      break
    }
    case 'right': {
      const max = Math.max(...nodes.map(n => n.x + n.width))
      for (const n of nodes) graph.updateNode(n.id, { x: max - n.width })
      break
    }
    case 'center': {
      const mid = nodes.reduce((s, n) => s + n.x + n.width / 2, 0) / nodes.length
      for (const n of nodes) graph.updateNode(n.id, { x: mid - n.width / 2 })
      break
    }
    case 'top': {
      const min = Math.min(...nodes.map(n => n.y))
      for (const n of nodes) graph.updateNode(n.id, { y: min })
      break
    }
    case 'bottom': {
      const max = Math.max(...nodes.map(n => n.y + n.height))
      for (const n of nodes) graph.updateNode(n.id, { y: max - n.height })
      break
    }
    case 'middle': {
      const mid = nodes.reduce((s, n) => s + n.y + n.height / 2, 0) / nodes.length
      for (const n of nodes) graph.updateNode(n.id, { y: mid - n.height / 2 })
      break
    }
  }
  return nodes.length
}

/**
 * Distribute nodes with equal gaps along the chosen axis. Endpoints stay
 * fixed; only interior nodes are moved.
 */
export function distributeNodes(graph: Graph, nodes: NodeData[], axis: DistributeAxis): number {
  if (nodes.length < 3) return 0
  if (axis === 'horizontal') {
    const sorted = [...nodes].sort((a, b) => a.x - b.x)
    const first = sorted[0]!
    const last  = sorted[sorted.length - 1]!
    const totalSpan      = (last.x + last.width) - first.x
    const totalNodeWidth = sorted.reduce((s, n) => s + n.width, 0)
    const gap = (totalSpan - totalNodeWidth) / (sorted.length - 1)
    let cursor = first.x + first.width
    for (let i = 1; i < sorted.length - 1; i++) {
      cursor += gap
      graph.updateNode(sorted[i]!.id, { x: cursor })
      cursor += sorted[i]!.width
    }
  } else {
    const sorted = [...nodes].sort((a, b) => a.y - b.y)
    const first = sorted[0]!
    const last  = sorted[sorted.length - 1]!
    const totalSpan       = (last.y + last.height) - first.y
    const totalNodeHeight = sorted.reduce((s, n) => s + n.height, 0)
    const gap = (totalSpan - totalNodeHeight) / (sorted.length - 1)
    let cursor = first.y + first.height
    for (let i = 1; i < sorted.length - 1; i++) {
      cursor += gap
      graph.updateNode(sorted[i]!.id, { y: cursor })
      cursor += sorted[i]!.height
    }
  }
  return nodes.length
}
