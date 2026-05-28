import type { NodeData } from './node'
import type { EdgeData } from './edge'

export class Graph {
  private nodes = new Map<string, NodeData>()
  private edges = new Map<string, EdgeData>()
  // nodeId → set of edgeIds connected to it (for fast cascade-delete)
  private nodeEdgeIndex = new Map<string, Set<string>>()

  addNode(node: NodeData): void {
    this.nodes.set(node.id, { ...node })
    if (!this.nodeEdgeIndex.has(node.id)) {
      this.nodeEdgeIndex.set(node.id, new Set())
    }
  }

  removeNode(id: string): void {
    const connected = this.nodeEdgeIndex.get(id)
    if (connected) {
      for (const edgeId of connected) {
        const edge = this.edges.get(edgeId)
        if (edge) {
          const other = edge.source === id ? edge.target : edge.source
          this.nodeEdgeIndex.get(other)?.delete(edgeId)
        }
        this.edges.delete(edgeId)
      }
    }
    this.nodes.delete(id)
    this.nodeEdgeIndex.delete(id)
  }

  updateNode(id: string, updates: Partial<Omit<NodeData, 'id'>>): void {
    const node = this.nodes.get(id)
    if (node) this.nodes.set(id, { ...node, ...updates })
  }

  addEdge(edge: EdgeData): void {
    if (!this.nodes.has(edge.source)) {
      console.warn(`[Graph] addEdge: source node '${edge.source}' does not exist`)
      return
    }
    if (!this.nodes.has(edge.target)) {
      console.warn(`[Graph] addEdge: target node '${edge.target}' does not exist`)
      return
    }
    this.edges.set(edge.id, { ...edge })
    this.nodeEdgeIndex.get(edge.source)!.add(edge.id)
    this.nodeEdgeIndex.get(edge.target)!.add(edge.id)
  }

  removeEdge(id: string): void {
    const edge = this.edges.get(id)
    if (edge) {
      this.nodeEdgeIndex.get(edge.source)?.delete(id)
      this.nodeEdgeIndex.get(edge.target)?.delete(id)
    }
    this.edges.delete(id)
  }

  updateEdge(id: string, updates: Partial<Omit<EdgeData, 'id'>>): void {
    const edge = this.edges.get(id)
    if (!edge) return
    if (updates.source !== undefined && updates.source !== edge.source) {
      this.nodeEdgeIndex.get(edge.source)?.delete(id)
      this.nodeEdgeIndex.get(updates.source)?.add(id)
    }
    if (updates.target !== undefined && updates.target !== edge.target) {
      this.nodeEdgeIndex.get(edge.target)?.delete(id)
      this.nodeEdgeIndex.get(updates.target)?.add(id)
    }
    this.edges.set(id, { ...edge, ...updates })
  }

  getNode(id: string): NodeData | undefined {
    return this.nodes.get(id)
  }

  getEdge(id: string): EdgeData | undefined {
    return this.edges.get(id)
  }

  getNodes(): NodeData[] {
    return Array.from(this.nodes.values())
  }

  getEdges(): EdgeData[] {
    return Array.from(this.edges.values())
  }

  get nodeCount(): number {
    return this.nodes.size
  }

  get edgeCount(): number {
    return this.edges.size
  }

  clear(): void {
    this.nodes.clear()
    this.edges.clear()
    this.nodeEdgeIndex.clear()
  }
}
