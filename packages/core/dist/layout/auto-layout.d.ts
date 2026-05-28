import type { NodeData } from '../graph/node';
import type { EdgeData } from '../graph/edge';
/** Top-left corner positions, matching NodeData.x / NodeData.y. */
export type LayoutResult = Map<string, {
    x: number;
    y: number;
}>;
/**
 * Hierarchical layout (Sugiyama-style).
 *
 * 1. Assign layers using Kahn's topological sort (longest-path).
 * 2. Order nodes within each layer with the barycenter heuristic
 *    (forward + backward passes) to minimize edge crossings.
 * 3. Place layers left→right; center each layer's column vertically.
 *
 * Cycles are handled gracefully: back-edges are ignored during layer
 * assignment and any cycle-only subgraphs are placed at layer 0.
 */
export declare function hierarchicalLayout(nodes: NodeData[], edges: EdgeData[], gapX?: number, gapY?: number): LayoutResult;
/**
 * Spring-force layout (Fruchterman-Reingold approximation).
 * Works with any graph topology; useful when hierarchy is not meaningful.
 */
export declare function forceLayout(nodes: NodeData[], edges: EdgeData[], iterations?: number): LayoutResult;
/**
 * Arrange nodes in a uniform grid, sorted by current x position.
 */
export declare function gridLayout(nodes: NodeData[], gap?: number): LayoutResult;
//# sourceMappingURL=auto-layout.d.ts.map