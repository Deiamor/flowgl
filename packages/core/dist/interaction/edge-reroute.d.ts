import type { Graph } from '../graph/graph';
import type { Viewport } from '../viewport/viewport';
import type { HitTester } from './hit-test';
import { type HandleSide, type HandlePos } from './connect';
export interface RerouteState {
    edgeId: string;
    movingEnd: 'source' | 'target';
    fixedHandle: HandlePos;
    pendingEndWx: number;
    pendingEndWy: number;
    targetNodeId: string | null;
    targetHandle: HandleSide | null;
}
export interface EndpointCircle {
    wx: number;
    wy: number;
    edgeId: string;
    end: 'source' | 'target';
}
export declare class EdgeReroute {
    private canvas;
    private viewport;
    private graph;
    private hitTester;
    private getSelectedEdgeIds;
    private onStateChange;
    private onReroute;
    private state;
    private disabled;
    setDisabled(v: boolean): void;
    private readonly onMouseDown;
    private readonly onMouseMove;
    private readonly onMouseUp;
    constructor(canvas: HTMLCanvasElement, viewport: Viewport, graph: Graph, hitTester: HitTester, getSelectedEdgeIds: () => Set<string>, onStateChange: (s: RerouteState | null) => void, onReroute: (edgeId: string, movingEnd: 'source' | 'target', targetNodeId: string, targetHandle: HandleSide) => void);
    isCapturing(): boolean;
    /** True if (clientX, clientY) is on an endpoint circle of a selected edge. */
    isOnEndpoint(clientX: number, clientY: number): boolean;
    /** Endpoint circles to render for currently selected edges. */
    getEndpointCircles(): EndpointCircle[];
    private toWorld;
    private findTargetHandle;
    private handleMouseDown;
    private handleMouseMove;
    private handleMouseUp;
    dispose(): void;
}
//# sourceMappingURL=edge-reroute.d.ts.map