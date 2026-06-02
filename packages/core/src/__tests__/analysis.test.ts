import { describe, it, expect, beforeEach } from 'vitest'
import { Graph } from '../graph/graph'

// Test graph analysis logic directly via Graph since FlowChart needs WebGL.
// The analysis methods in FlowChart are thin wrappers over graph.getEdges()/getNodes().

function buildGraph(
  nodes: { id: string }[],
  edges: { id: string; source: string; target: string }[],
): Graph {
  const g = new Graph()
  for (const n of nodes) g.addNode({ id: n.id, x: 0, y: 0, width: 100, height: 50, label: n.id })
  for (const e of edges) g.addEdge({ id: e.id, source: e.source, target: e.target })
  return g
}

// Replicate analysis functions here (same logic as flowchart.ts) so we can unit-test them.

function getIncomers(g: Graph, nodeId: string) {
  const result = []
  for (const edge of g.getEdges()) {
    if (edge.target === nodeId) {
      const node = g.getNode(edge.source)
      if (node) result.push(node)
    }
  }
  return result
}

function getOutgoers(g: Graph, nodeId: string) {
  const result = []
  for (const edge of g.getEdges()) {
    if (edge.source === nodeId) {
      const node = g.getNode(edge.target)
      if (node) result.push(node)
    }
  }
  return result
}

function getConnectedNodes(g: Graph, nodeId: string) {
  const seen = new Set<string>()
  const result = []
  for (const edge of g.getEdges()) {
    let other: string | null = null
    if (edge.source === nodeId) other = edge.target
    else if (edge.target === nodeId) other = edge.source
    if (other && !seen.has(other)) {
      seen.add(other)
      const node = g.getNode(other)
      if (node) result.push(node)
    }
  }
  return result
}

function hasCycle(g: Graph): boolean {
  const nodes = g.getNodes()
  const adj = new Map<string, string[]>()
  for (const n of nodes) adj.set(n.id, [])
  for (const e of g.getEdges()) adj.get(e.source)?.push(e.target)

  const WHITE = 0, GREY = 1, BLACK = 2
  const color = new Map<string, number>()
  for (const n of nodes) color.set(n.id, WHITE)

  const dfs = (id: string): boolean => {
    color.set(id, GREY)
    for (const nb of adj.get(id) ?? []) {
      const c = color.get(nb) ?? WHITE
      if (c === GREY) return true
      if (c === WHITE && dfs(nb)) return true
    }
    color.set(id, BLACK)
    return false
  }

  for (const n of nodes) {
    if ((color.get(n.id) ?? WHITE) === WHITE && dfs(n.id)) return true
  }
  return false
}

function findPaths(g: Graph, sourceId: string, targetId: string): string[][] {
  if (sourceId === targetId) return []
  const adj = new Map<string, string[]>()
  for (const n of g.getNodes()) adj.set(n.id, [])
  for (const e of g.getEdges()) adj.get(e.source)?.push(e.target)

  const results: string[][] = []
  const visited = new Set<string>()

  const dfs = (current: string, path: string[]): void => {
    if (current === targetId) { results.push([...path]); return }
    if (results.length >= 100) return
    for (const nb of adj.get(current) ?? []) {
      if (!visited.has(nb)) {
        visited.add(nb)
        path.push(nb)
        dfs(nb, path)
        path.pop()
        visited.delete(nb)
      }
    }
  }

  visited.add(sourceId)
  dfs(sourceId, [sourceId])
  return results
}

describe('Graph analysis', () => {
  describe('getIncomers', () => {
    it('returns nodes that point to the given node', () => {
      const g = buildGraph(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        [{ id: 'e1', source: 'a', target: 'c' }, { id: 'e2', source: 'b', target: 'c' }],
      )
      const ids = getIncomers(g, 'c').map(n => n.id).sort()
      expect(ids).toEqual(['a', 'b'])
    })

    it('returns empty array when no incomers', () => {
      const g = buildGraph([{ id: 'a' }], [])
      expect(getIncomers(g, 'a')).toEqual([])
    })
  })

  describe('getOutgoers', () => {
    it('returns nodes that the given node points to', () => {
      const g = buildGraph(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        [{ id: 'e1', source: 'a', target: 'b' }, { id: 'e2', source: 'a', target: 'c' }],
      )
      const ids = getOutgoers(g, 'a').map(n => n.id).sort()
      expect(ids).toEqual(['b', 'c'])
    })
  })

  describe('getConnectedNodes', () => {
    it('returns all directly connected nodes regardless of direction', () => {
      const g = buildGraph(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        [{ id: 'e1', source: 'a', target: 'b' }, { id: 'e2', source: 'c', target: 'a' }],
      )
      const ids = getConnectedNodes(g, 'a').map(n => n.id).sort()
      expect(ids).toEqual(['b', 'c'])
    })

    it('deduplicates nodes reachable via multiple edges', () => {
      const g = buildGraph(
        [{ id: 'a' }, { id: 'b' }],
        [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'a' },
        ],
      )
      expect(getConnectedNodes(g, 'a')).toHaveLength(1)
    })
  })

  describe('hasCycle', () => {
    it('returns false for a DAG', () => {
      const g = buildGraph(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        [{ id: 'e1', source: 'a', target: 'b' }, { id: 'e2', source: 'b', target: 'c' }],
      )
      expect(hasCycle(g)).toBe(false)
    })

    it('returns true for a direct self-loop', () => {
      const g = buildGraph([{ id: 'a' }], [{ id: 'e1', source: 'a', target: 'a' }])
      expect(hasCycle(g)).toBe(true)
    })

    it('returns true for a 3-node cycle', () => {
      const g = buildGraph(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'c' },
          { id: 'e3', source: 'c', target: 'a' },
        ],
      )
      expect(hasCycle(g)).toBe(true)
    })

    it('returns false for an empty graph', () => {
      const g = buildGraph([], [])
      expect(hasCycle(g)).toBe(false)
    })
  })

  describe('findPaths', () => {
    it('finds the single path in a linear chain', () => {
      const g = buildGraph(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        [{ id: 'e1', source: 'a', target: 'b' }, { id: 'e2', source: 'b', target: 'c' }],
      )
      const paths = findPaths(g, 'a', 'c')
      expect(paths).toHaveLength(1)
      expect(paths[0]).toEqual(['a', 'b', 'c'])
    })

    it('finds two paths when branching exists', () => {
      const g = buildGraph(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
        [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'a', target: 'c' },
          { id: 'e3', source: 'b', target: 'd' },
          { id: 'e4', source: 'c', target: 'd' },
        ],
      )
      const paths = findPaths(g, 'a', 'd')
      expect(paths).toHaveLength(2)
      const flat = paths.map(p => p.join('-')).sort()
      expect(flat).toEqual(['a-b-d', 'a-c-d'])
    })

    it('returns empty array when no path exists', () => {
      const g = buildGraph(
        [{ id: 'a' }, { id: 'b' }],
        [],
      )
      expect(findPaths(g, 'a', 'b')).toEqual([])
    })

    it('returns empty array when source equals target (no self-path)', () => {
      const g = buildGraph([{ id: 'a' }], [])
      expect(findPaths(g, 'a', 'a')).toEqual([])
    })
  })
})
