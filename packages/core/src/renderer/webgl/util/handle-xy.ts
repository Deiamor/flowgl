import type { NodeData } from '../../../graph/node'

/** Returns the world-space (x, y) coordinate of a handle on a node.
 *  Resolves named port IDs from node.ports before falling back to the
 *  standard four sides (top / right / bottom / left). */
export function handleXY(node: NodeData, side: string | undefined): [number, number] {
  const cx = node.x + node.width  / 2
  const cy = node.y + node.height / 2

  if (side && node.ports?.length) {
    const port = node.ports.find(p => p.id === side)
    if (port) {
      const off = port.offset ?? 0.5
      switch (port.side) {
        case 'left':   return [node.x,              node.y + off * node.height]
        case 'right':  return [node.x + node.width, node.y + off * node.height]
        case 'top':    return [node.x + off * node.width, node.y]
        case 'bottom': return [node.x + off * node.width, node.y + node.height]
      }
    }
  }

  switch (side) {
    case 'left':   return [node.x,              cy]
    case 'top':    return [cx,                  node.y]
    case 'bottom': return [cx,                  node.y + node.height]
    default:       return [node.x + node.width, cy]
  }
}
