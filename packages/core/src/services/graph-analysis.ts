import type { Graph } from '../graph/graph'
import type { NodeData } from '../graph/node'

/**
 * Read-only graph queries that traverse adjacency without mutating state.
 * Extracted from `FlowChart` so callers (and tests) can reuse the algorithms
 * against any `Graph` instance.
 */

export function getIncomers(graph: Graph, nodeId: string): NodeData[] {
  const result: NodeData[] = []
  for (const edge of graph.getEdgesForNode(nodeId)) {
    if (edge.target === nodeId) {
      const node = graph.getNode(edge.source)
      if (node) result.push(node)
    }
  }
  return result
}

export function getOutgoers(graph: Graph, nodeId: string): NodeData[] {
  const result: NodeData[] = []
  for (const edge of graph.getEdgesForNode(nodeId)) {
    if (edge.source === nodeId) {
      const node = graph.getNode(edge.target)
      if (node) result.push(node)
    }
  }
  return result
}

export function getConnectedNodes(graph: Graph, nodeId: string): NodeData[] {
  const seen = new Set<string>()
  const result: NodeData[] = []
  for (const edge of graph.getEdgesForNode(nodeId)) {
    const otherId = edge.source === nodeId ? edge.target : edge.source
    if (!seen.has(otherId)) {
      seen.add(otherId)
      const node = graph.getNode(otherId)
      if (node) result.push(node)
    }
  }
  return result
}

/** Detect a directed cycle in the graph. O(V+E) via 3-color DFS. */
export function hasCycle(graph: Graph): boolean {
  const nodes = graph.getNodes()
  const adj = new Map<string, string[]>()
  for (const n of nodes) adj.set(n.id, [])
  for (const e of graph.getEdges()) adj.get(e.source)?.push(e.target)

  const WHITE = 0, GREY = 1, BLACK = 2
  const color = new Map<string, number>()
  for (const n of nodes) color.set(n.id, WHITE)

  const dfs = (id: string): boolean => {
    color.set(id, GREY)
    for (const neighbor of adj.get(id) ?? []) {
      const c = color.get(neighbor) ?? WHITE
      if (c === GREY) return true
      if (c === WHITE && dfs(neighbor)) return true
    }
    color.set(id, BLACK)
    return false
  }

  for (const n of nodes) {
    if ((color.get(n.id) ?? WHITE) === WHITE && dfs(n.id)) return true
  }
  return false
}

/**
 * Enumerate up to 100 paths from `sourceId` to `targetId`. Returns an empty
 * array when source === target. Each path is the sequence of node IDs.
 */
export function findPaths(graph: Graph, sourceId: string, targetId: string): string[][] {
  if (sourceId === targetId) return []
  const adj = new Map<string, string[]>()
  for (const n of graph.getNodes()) adj.set(n.id, [])
  for (const e of graph.getEdges()) adj.get(e.source)?.push(e.target)

  const results: string[][] = []
  const visited = new Set<string>()

  const dfs = (current: string, path: string[]): void => {
    if (current === targetId) { results.push([...path]); return }
    if (results.length >= 100) return
    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        path.push(neighbor)
        dfs(neighbor, path)
        path.pop()
        visited.delete(neighbor)
      }
    }
  }

  visited.add(sourceId)
  dfs(sourceId, [sourceId])
  return results
}
