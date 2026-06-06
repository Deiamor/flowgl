import type { NodeData } from '../../../graph/node';
/** Returns the world-space (x, y) coordinate of a handle on a node.
 *  Resolves named port IDs from node.ports before falling back to the
 *  standard four sides (top / right / bottom / left). */
export declare function handleXY(node: NodeData, side: string | undefined): [number, number];
//# sourceMappingURL=handle-xy.d.ts.map