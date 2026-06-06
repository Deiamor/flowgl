import type { NodeData } from './node';
import type { EdgeData } from './edge';
export declare class Graph {
    private nodes;
    private edges;
    private nodeEdgeIndex;
    version: number;
    addNode(node: NodeData): void;
    removeNode(id: string): void;
    updateNode(id: string, updates: Partial<Omit<NodeData, 'id'>>): void;
    /** Replace a node entirely (no field merging). Used to remove optional fields. */
    replaceNode(node: NodeData): void;
    addEdge(edge: EdgeData): void;
    removeEdge(id: string): void;
    updateEdge(id: string, updates: Partial<Omit<EdgeData, 'id'>>): void;
    getNode(id: string): NodeData | undefined;
    getEdge(id: string): EdgeData | undefined;
    getNodes(): NodeData[];
    getEdges(): EdgeData[];
    /** O(degree) — uses the edge index instead of scanning all edges. */
    getEdgesForNode(nodeId: string): EdgeData[];
    get nodeCount(): number;
    get edgeCount(): number;
    clear(): void;
}
//# sourceMappingURL=graph.d.ts.map