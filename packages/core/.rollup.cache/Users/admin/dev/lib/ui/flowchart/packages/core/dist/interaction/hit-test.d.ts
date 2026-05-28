import type { NodeData } from '../graph/node';
export declare class HitTester {
    findNodeAt(nodes: NodeData[], wx: number, wy: number): NodeData | null;
    findNodesInBox(nodes: NodeData[], minX: number, minY: number, maxX: number, maxY: number): NodeData[];
}
//# sourceMappingURL=hit-test.d.ts.map