import type { Graph } from '../graph/graph';
import type { NodeData } from '../graph/node';
import type { Viewport } from '../viewport/viewport';
import type { HitTester } from './hit-test';
export type HandleSide = 'top' | 'right' | 'bottom' | 'left' | (string & {});
export interface HandlePos {
    nodeId: string;
    side: HandleSide;
    wx: number;
    wy: number;
}
export interface ConnectState {
    hoveredNodeId: string | null;
    hoveredHandle: HandlePos | null;
    connectingFrom: HandlePos | null;
    pendingEndWx: number;
    pendingEndWy: number;
    targetNodeId: string | null;
    targetHandle: HandleSide | null;
}
export declare function getHandlePositions(node: NodeData): HandlePos[];
export declare class ConnectDrag {
    private canvas;
    private viewport;
    private graph;
    private hitTester;
    private onStateChange;
    private onConnect;
    private state;
    private connectTouchId;
    private disabled;
    setDisabled(v: boolean): void;
    private readonly onMouseMove;
    private readonly onMouseDown;
    private readonly onMouseUp;
    private readonly onMouseLeave;
    private readonly onTouchStart;
    private readonly onTouchMove;
    private readonly onTouchEnd;
    constructor(canvas: HTMLCanvasElement, viewport: Viewport, graph: Graph, hitTester: HitTester, onStateChange: (s: ConnectState) => void, onConnect: (sourceId: string, targetId: string, sourceHandle: HandleSide, targetHandle: HandleSide) => void);
    isCapturing(): boolean;
    /** True if the pointer is currently within click range of any handle. */
    isNearHandle(clientX: number, clientY: number): boolean;
    cancel(): void;
    private toWorld;
    /**
     * Find the closest handle across ALL nodes — not just hoveredNode.
     * This is critical: handle circles extend beyond the node AABB, so
     * `findNodeAt` returns null when the cursor is over the protruding half.
     * Searching all handles avoids losing the hovered state in that zone.
     */
    private findNearestHandle;
    /**
     * During connection drag: find the target handle to snap to.
     * Priority: handle hit radius on any non-source node → nearest handle on node body.
     * Returns the snap point so `pendingEndWx/Wy` can be updated.
     */
    private findTargetHandle;
    /** Returns the handle on `node` whose world position is closest to (wx, wy). */
    private nearestHandleOnNode;
    private setState;
    private handleMouseMove;
    private handleMouseDown;
    private handleMouseUp;
    private handleMouseLeave;
    private handleTouchStart;
    private handleTouchMove;
    private handleTouchEnd;
    dispose(): void;
}
//# sourceMappingURL=connect.d.ts.map