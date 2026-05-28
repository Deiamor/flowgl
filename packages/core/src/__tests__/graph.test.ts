import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Graph } from '../graph/graph'
import type { NodeData } from '../graph/node'
import type { EdgeData } from '../graph/edge'

const node = (id: string, x = 0, y = 0): NodeData => ({
  id, label: id, x, y, width: 120, height: 60,
})

const edge = (id: string, source: string, target: string): EdgeData => ({
  id, source, target,
})

describe('Graph', () => {
  let g: Graph

  beforeEach(() => { g = new Graph() })

  it('adds and retrieves nodes', () => {
    g.addNode(node('a'))
    g.addNode(node('b'))
    expect(g.nodeCount).toBe(2)
    expect(g.getNode('a')?.id).toBe('a')
  })

  it('stores a defensive copy of added node', () => {
    const n = node('a')
    g.addNode(n)
    n.x = 999
    expect(g.getNode('a')?.x).toBe(0)
  })

  it('updateNode merges changes', () => {
    g.addNode(node('a'))
    g.updateNode('a', { x: 50, label: 'updated' })
    const updated = g.getNode('a')
    expect(updated?.x).toBe(50)
    expect(updated?.label).toBe('updated')
    expect(updated?.y).toBe(0)
  })

  it('removeNode deletes the node', () => {
    g.addNode(node('a'))
    g.removeNode('a')
    expect(g.getNode('a')).toBeUndefined()
    expect(g.nodeCount).toBe(0)
  })

  it('addEdge rejects ghost source', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    g.addNode(node('b'))
    g.addEdge(edge('e1', 'missing', 'b'))
    expect(g.edgeCount).toBe(0)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("source node 'missing'"))
    warn.mockRestore()
  })

  it('addEdge rejects ghost target', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    g.addNode(node('a'))
    g.addEdge(edge('e1', 'a', 'missing'))
    expect(g.edgeCount).toBe(0)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("target node 'missing'"))
    warn.mockRestore()
  })

  it('addEdge succeeds when both nodes exist', () => {
    g.addNode(node('a'))
    g.addNode(node('b'))
    g.addEdge(edge('e1', 'a', 'b'))
    expect(g.edgeCount).toBe(1)
    expect(g.getEdge('e1')?.source).toBe('a')
  })

  it('removeNode cascades to connected edges', () => {
    g.addNode(node('a'))
    g.addNode(node('b'))
    g.addEdge(edge('e1', 'a', 'b'))
    g.removeNode('a')
    expect(g.edgeCount).toBe(0)
    expect(g.nodeCount).toBe(1)
  })

  it('removeEdge removes only the edge', () => {
    g.addNode(node('a'))
    g.addNode(node('b'))
    g.addEdge(edge('e1', 'a', 'b'))
    g.removeEdge('e1')
    expect(g.edgeCount).toBe(0)
    expect(g.nodeCount).toBe(2)
  })

  it('updateEdge updates source and nodeEdgeIndex', () => {
    g.addNode(node('a'))
    g.addNode(node('b'))
    g.addNode(node('c'))
    g.addEdge(edge('e1', 'a', 'b'))
    g.updateEdge('e1', { source: 'c' })
    expect(g.getEdge('e1')?.source).toBe('c')
    // Removing c should cascade-delete e1
    g.removeNode('c')
    expect(g.edgeCount).toBe(0)
  })

  it('clear empties all collections', () => {
    g.addNode(node('a'))
    g.addNode(node('b'))
    g.addEdge(edge('e1', 'a', 'b'))
    g.clear()
    expect(g.nodeCount).toBe(0)
    expect(g.edgeCount).toBe(0)
  })

  it('getNodes and getEdges return arrays', () => {
    g.addNode(node('x'))
    g.addNode(node('y'))
    g.addEdge(edge('e1', 'x', 'y'))
    expect(Array.isArray(g.getNodes())).toBe(true)
    expect(g.getNodes()).toHaveLength(2)
    expect(Array.isArray(g.getEdges())).toBe(true)
    expect(g.getEdges()).toHaveLength(1)
  })
})
