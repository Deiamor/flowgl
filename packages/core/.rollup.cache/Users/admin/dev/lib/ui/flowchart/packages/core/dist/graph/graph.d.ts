import type { NodeData } from './node';
import type { EdgeData } from './edge';
export declare class Graph {
    private nodes;
    private edges;
    private nodeEdgeIndex;
    addNode(node: NodeData): void;
    removeNode(id: string): void;
    updateNode(id: string, updates: Partial<Omit<NodeData, 'id'>>): void;
    addEdge(edge: EdgeData): void;
    removeEdge(id: string): void;
    updateEdge(id: string, updates: Partial<Omit<EdgeData, 'id'>>): void;
    getNode(id: string): NodeData | undefined;
    getEdge(id: string): EdgeData | undefined;
    getNodes(): NodeData[];
    getEdges(): EdgeData[];
    get nodeCount(): number;
    get edgeCount(): number;
    clear(): void;
}
//# sourceMappingURL=graph.d.ts.map