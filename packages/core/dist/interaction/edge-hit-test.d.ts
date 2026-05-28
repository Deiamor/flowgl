import type { EdgeData } from '../graph/edge';
import type { NodeData } from '../graph/node';
export declare class EdgeHitTester {
    /** Returns the topmost edge whose bezier passes within HIT_PX/zoom of (wx, wy). */
    findEdgeAt(edges: EdgeData[], nodeMap: Map<string, NodeData>, wx: number, wy: number, zoom: number): EdgeData | null;
}
//# sourceMappingURL=edge-hit-test.d.ts.map