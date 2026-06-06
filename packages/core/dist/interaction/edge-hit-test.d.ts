import type { EdgeData } from '../graph/edge';
import type { NodeData } from '../graph/node';
export declare class EdgeHitTester {
    /** Returns the topmost edge whose bezier passes within the hit area of (wx, wy).
     *  Hit area = max(MIN_HIT_PX, visual half-width) in screen pixels. */
    findEdgeAt(edges: EdgeData[], nodeMap: Map<string, NodeData>, wx: number, wy: number, zoom: number): EdgeData | null;
}
//# sourceMappingURL=edge-hit-test.d.ts.map