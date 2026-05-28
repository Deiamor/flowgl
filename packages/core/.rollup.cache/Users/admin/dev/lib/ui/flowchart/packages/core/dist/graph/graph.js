export class Graph {
    constructor() {
        this.nodes = new Map();
        this.edges = new Map();
        // nodeId → set of edgeIds connected to it (for fast cascade-delete)
        this.nodeEdgeIndex = new Map();
    }
    addNode(node) {
        this.nodes.set(node.id, { ...node });
        if (!this.nodeEdgeIndex.has(node.id)) {
            this.nodeEdgeIndex.set(node.id, new Set());
        }
    }
    removeNode(id) {
        const connected = this.nodeEdgeIndex.get(id);
        if (connected) {
            for (const edgeId of connected) {
                const edge = this.edges.get(edgeId);
                if (edge) {
                    const other = edge.source === id ? edge.target : edge.source;
                    this.nodeEdgeIndex.get(other)?.delete(edgeId);
                }
                this.edges.delete(edgeId);
            }
        }
        this.nodes.delete(id);
        this.nodeEdgeIndex.delete(id);
    }
    updateNode(id, updates) {
        const node = this.nodes.get(id);
        if (node)
            this.nodes.set(id, { ...node, ...updates });
    }
    addEdge(edge) {
        if (!this.nodes.has(edge.source)) {
            console.warn(`[Graph] addEdge: source node '${edge.source}' does not exist`);
            return;
        }
        if (!this.nodes.has(edge.target)) {
            console.warn(`[Graph] addEdge: target node '${edge.target}' does not exist`);
            return;
        }
        this.edges.set(edge.id, { ...edge });
        this.nodeEdgeIndex.get(edge.source).add(edge.id);
        this.nodeEdgeIndex.get(edge.target).add(edge.id);
    }
    removeEdge(id) {
        const edge = this.edges.get(id);
        if (edge) {
            this.nodeEdgeIndex.get(edge.source)?.delete(id);
            this.nodeEdgeIndex.get(edge.target)?.delete(id);
        }
        this.edges.delete(id);
    }
    updateEdge(id, updates) {
        const edge = this.edges.get(id);
        if (!edge)
            return;
        if (updates.source !== undefined && updates.source !== edge.source) {
            this.nodeEdgeIndex.get(edge.source)?.delete(id);
            this.nodeEdgeIndex.get(updates.source)?.add(id);
        }
        if (updates.target !== undefined && updates.target !== edge.target) {
            this.nodeEdgeIndex.get(edge.target)?.delete(id);
            this.nodeEdgeIndex.get(updates.target)?.add(id);
        }
        this.edges.set(id, { ...edge, ...updates });
    }
    getNode(id) {
        return this.nodes.get(id);
    }
    getEdge(id) {
        return this.edges.get(id);
    }
    getNodes() {
        return Array.from(this.nodes.values());
    }
    getEdges() {
        return Array.from(this.edges.values());
    }
    get nodeCount() {
        return this.nodes.size;
    }
    get edgeCount() {
        return this.edges.size;
    }
    clear() {
        this.nodes.clear();
        this.edges.clear();
        this.nodeEdgeIndex.clear();
    }
}
//# sourceMappingURL=graph.js.map