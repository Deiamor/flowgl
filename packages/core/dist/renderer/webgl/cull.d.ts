import type { NodeData } from '../../graph/node';
import type { EdgeData } from '../../graph/edge';
import type { AABB } from '../../viewport/viewport';
export declare function cullNodes(nodes: NodeData[], bounds: AABB): NodeData[];
export declare function cullEdges(edges: EdgeData[], nodeMap: Map<string, NodeData>, bounds: AABB): EdgeData[];
export declare function computeNodeBounds(nodes: NodeData[]): AABB;
//# sourceMappingURL=cull.d.ts.map