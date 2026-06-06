import type { NodeData } from '../graph/node';
import type { EdgeData } from '../graph/edge';
export type LayoutAlgorithm = 'hierarchical' | 'force' | 'grid';
export interface LayoutWorkerRequest {
    id: number;
    algorithm: LayoutAlgorithm;
    nodes: NodeData[];
    edges: EdgeData[];
    gapX?: number;
    gapY?: number;
    gap?: number;
    iterations?: number;
}
export interface LayoutWorkerResponse {
    id: number;
    result: {
        id: string;
        x: number;
        y: number;
    }[];
    error?: string;
}
//# sourceMappingURL=layout-worker.d.ts.map