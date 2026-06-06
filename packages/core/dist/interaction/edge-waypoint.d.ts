import type { Graph } from '../graph/graph';
import type { Viewport } from '../viewport/viewport';
export declare class EdgeWaypoint {
    private canvas;
    private viewport;
    private graph;
    private getSelectedEdgeIds;
    private onChange;
    private dragging;
    private readonly onMouseDown;
    private readonly onMouseMove;
    private readonly onMouseUp;
    constructor(canvas: HTMLCanvasElement, viewport: Viewport, graph: Graph, getSelectedEdgeIds: () => Set<string>, onChange: () => void);
    private toWorld;
    private toScreen;
    /** Returns midpoint of each bezier segment (between consecutive waypoints, and endpoint→waypoint→endpoint). */
    private getEdgeMidpoints;
    private handleMouseDown;
    private handleMouseMove;
    private handleMouseUp;
    private updateEdgeWaypoints;
    /** Remove a waypoint by world-coordinate proximity (for right-click or double-click). */
    removeWaypointAt(edgeId: string, wx: number, wy: number): boolean;
    /** Returns waypoint screen positions for all selected edges (for overlay rendering). */
    getWaypointHandles(): {
        edgeId: string;
        wx: number;
        wy: number;
        isMid: boolean;
    }[];
    isCapturing(): boolean;
    dispose(): void;
}
//# sourceMappingURL=edge-waypoint.d.ts.map