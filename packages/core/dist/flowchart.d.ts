import { EventEmitter } from './events/emitter';
import { Graph } from './graph/graph';
import { Viewport } from './viewport/viewport';
import type { NodeData, NodeStyle, NodeShape, NodeStatus } from './graph/node';
import type { EdgeData, EdgeStyle } from './graph/edge';
import type { ViewportState, AABB } from './viewport/viewport';
import type { RendererOptions } from './renderer/interface';
import type { HandleSide } from './interaction/connect';
import type { GridConfig, MinimapConfig } from './types';
export interface FlowChartOptions {
    container: HTMLElement;
    nodes?: NodeData[];
    edges?: EdgeData[];
    renderer?: RendererOptions;
    /** Allow double-click to edit node labels inline. Default: true. */
    labelEditable?: boolean;
    /**
     * When true, all editing interactions are disabled: drag, connect, resize,
     * label edit, keyboard delete, and right-click mutation menu. Default: false.
     */
    readOnly?: boolean;
    /** Canvas background color. Default: '#f7f7f7'. */
    background?: string;
    /** Grid overlay config. */
    grid?: Partial<GridConfig>;
    /** Minimap overlay config. Omit to disable. */
    minimap?: Partial<MinimapConfig>;
    /** Accessible label for screen readers. Default: 'Flowchart'. */
    ariaLabel?: string;
    /** Max undo history entries. Default: 100. */
    historyLimit?: number;
    /** Snap node drag to a grid of this size (world units). 0 = off. Default: 0. */
    snapGrid?: number;
    /**
     * Return false to reject a connection before it is created.
     * Called after the user finishes a ConnectDrag gesture.
     */
    onBeforeConnect?: (params: {
        sourceId: string;
        targetId: string;
        sourceHandle: string;
        targetHandle: string;
    }) => boolean;
    /**
     * Return false to cancel deletion of the selected nodes/edges.
     * Called before any nodes or edges are removed.
     */
    onBeforeDelete?: (nodeIds: string[], edgeIds: string[]) => boolean;
    /**
     * Called when the renderer cannot initialize (e.g. WebGL2 unavailable).
     * If omitted, a console.error is emitted instead.
     */
    onError?: (err: Error) => void;
    /** Called when the WebGL context is lost (e.g. GPU reset, tab backgrounded on mobile). */
    onContextLost?: () => void;
    /** Called when the WebGL context is restored after a loss event. */
    onContextRestored?: () => void;
    /** When true, automatically fit the view to the initial nodes after construction. Default: false. */
    autoFit?: boolean;
}
export interface FlowChartEvents extends Record<string, unknown> {
    nodeClick: {
        node: NodeData;
    };
    nodeDoubleClick: {
        node: NodeData;
    };
    nodeDragStart: {
        id: string;
    };
    nodeDragEnd: {
        id: string;
        x: number;
        y: number;
    };
    edgeClick: {
        edge: EdgeData;
    };
    edgeDoubleClick: {
        edge: EdgeData;
    };
    edgeUpdate: {
        id: string;
        updates: Partial<Omit<EdgeData, 'id'>>;
    };
    nodeResize: {
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
    };
    paneClick: {
        x: number;
        y: number;
    };
    viewportChange: ViewportState;
    connect: {
        sourceId: string;
        targetId: string;
        sourceHandle: HandleSide;
        targetHandle: HandleSide;
    };
    selectionChange: {
        selectedIds: string[];
        edgeIds: string[];
    };
    nodeAdd: {
        node: NodeData;
    };
    nodeRemove: {
        id: string;
    };
    nodeUpdate: {
        id: string;
        updates: Partial<Omit<NodeData, 'id'>>;
    };
    edgeAdd: {
        edge: EdgeData;
    };
    edgeRemove: {
        id: string;
    };
    historyChange: {
        canUndo: boolean;
        canRedo: boolean;
    };
    nodeHover: {
        node: NodeData | null;
    };
    edgeHover: {
        edge: EdgeData | null;
    };
}
export declare class FlowChart extends EventEmitter<FlowChartEvents> {
    private canvas;
    readonly graph: Graph;
    readonly viewport: Viewport;
    private renderer;
    private hitTester;
    private edgeHitTester;
    private panZoom;
    private drag;
    private connectDrag;
    private edgeReroute;
    private contextMenu;
    private keyboardHandler;
    private boxSelect;
    private labelEditor;
    private nodeResize;
    private edgeWaypoint;
    private waypointOverlay;
    private history;
    private panels;
    private resizeObserver;
    private ariaLive;
    private arrowMoveTimer;
    private rafId;
    private animRafId;
    private pendingResize;
    private layoutAnim;
    private failed;
    private selectedIds;
    private selectedEdgeIds;
    private connectState;
    private rerouteState;
    private minimap;
    private htmlOverlay;
    private labelEditable;
    private readOnly;
    private bgColor;
    private gridConfig;
    private snapGridSize;
    private onBeforeConnect;
    private onBeforeDelete;
    private clipboard;
    private highlightedNodeIds;
    private highlightOverlay;
    private highlightCtx;
    private statusOverlay;
    private statusCtx;
    private hoveredNodeId;
    private hoveredEdgeId;
    private tooltipEl;
    private hoverMoveHandler;
    private hoverLeaveHandler;
    private edgeDashOffset;
    private batching;
    private batchMutSaved;
    private lastDragEndTime;
    private canvasDblClick;
    private canvasContextMenu;
    private canvasMouseDown;
    private canvasClick;
    private ariaDesc;
    constructor(options: FlowChartOptions);
    /** Toggle read-only mode at runtime. When true, all editing is disabled. */
    setReadOnly(readOnly: boolean): void;
    private applyReadOnly;
    /** Capture current graph state for undo. Called before any mutation. */
    private beforeMutation;
    private applySnapshot;
    /** Undo the last action. Returns true if successful. */
    undo(): boolean;
    /** Redo a previously undone action. Returns true if successful. */
    redo(): boolean;
    canUndo(): boolean;
    canRedo(): boolean;
    /** Clear the undo/redo history stack. */
    clearHistory(): void;
    /**
     * Run `fn` as a single atomic operation: one history entry and one render
     * regardless of how many mutations `fn` performs.
     */
    batchUpdate(fn: () => void): void;
    /**
     * Export the current canvas as a PNG data URL.
     * @param scale  Output pixel ratio (default: devicePixelRatio or 2 for retina quality).
     * Returns null if the renderer is not initialized.
     */
    exportPNG(scale?: number): string | null;
    exportSVG(padding?: number): string;
    private svgEscape;
    /** Serialize the full chart state (nodes, edges, viewport). */
    toJSON(): {
        version: number;
        nodes: NodeData[];
        edges: EdgeData[];
        viewport: ViewportState;
    };
    /** Load a previously serialized chart state. Replaces current content. */
    fromJSON(data: {
        version?: number;
        nodes: NodeData[];
        edges: EdgeData[];
        viewport?: ViewportState;
    }): void;
    /**
     * Import nodes and edges.
     * `'replace'` (default) clears the chart first (same as `fromJSON`).
     * `'merge'` adds to the existing graph without clearing.
     */
    importJSON(data: {
        nodes: NodeData[];
        edges: EdgeData[];
        viewport?: ViewportState;
    }, mode?: 'replace' | 'merge'): void;
    getIncomers(nodeId: string): NodeData[];
    getOutgoers(nodeId: string): NodeData[];
    getConnectedNodes(nodeId: string): NodeData[];
    hasCycle(): boolean;
    findPaths(sourceId: string, targetId: string): string[][];
    searchNodes(query: string): NodeData[];
    setHighlightedNodes(ids: string[]): void;
    clearHighlights(): void;
    private renderHighlights;
    private static readonly STATUS_COLORS;
    private renderStatusBadges;
    /**
     * Animate nodes from their current positions to `targets` over `duration` ms.
     * Accepts the same shape as `hierarchicalLayout` / `forceLayout` result items.
     */
    animateLayout(targets: {
        id: string;
        x: number;
        y: number;
    }[] | Map<string, {
        x: number;
        y: number;
    }>, duration?: number): void;
    private tickLayoutAnim;
    private scheduleRender;
    private startEdgeLabelEdit;
    private renderWaypointHandles;
    private announce;
    private announceNode;
    private tabSelectNode;
    private moveSelectedByArrow;
    deleteSelected(): void;
    private copySelection;
    duplicateSelected(): void;
    private pasteClipboard;
    setNodeStyle(id: string, style: Partial<NodeStyle>): void;
    setNodeBorderColor(id: string, color: string): void;
    setNodeBackgroundColor(id: string, color: string): void;
    setNodeShape(id: string, shape: NodeShape): void;
    setEdgeStyle(id: string, style: Partial<EdgeStyle>): void;
    lockNode(id: string): void;
    unlockNode(id: string): void;
    setNodeSize(id: string, width: number, height: number): void;
    alignNodes(axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void;
    distributeNodes(axis: 'horizontal' | 'vertical'): void;
    collapseNode(id: string): void;
    expandNode(id: string): void;
    toggleCollapse(id: string): void;
    groupNodes(parentId: string, childIds: string[]): void;
    ungroupNodes(childIds: string[]): void;
    setBackground(color: string): void;
    setGrid(config: Partial<GridConfig>): void;
    setSnapGrid(size: number): void;
    setLabelEditable(enabled: boolean): void;
    getSelectedIds(): string[];
    getSelectedEdgeIds(): string[];
    setSelectedIds(ids: string[]): void;
    setSelectedEdgeIds(ids: string[]): void;
    selectAll(): void;
    clearSelection(): void;
    addNode(node: NodeData): void;
    removeNode(id: string): void;
    updateNode(id: string, updates: Partial<Omit<NodeData, 'id'>>): void;
    addEdge(edge: EdgeData): void;
    removeEdge(id: string): void;
    updateEdge(id: string, updates: Partial<Omit<EdgeData, 'id'>>): void;
    /** Reverse the source and target of an edge. Records an undo entry. */
    swapEdgeDirection(id: string): void;
    /** Override the onBeforeDelete callback at runtime. Pass null to remove it. */
    setOnBeforeDelete(fn: ((nodeIds: string[], edgeIds: string[]) => boolean) | null): void;
    setNodes(nodes: NodeData[]): void;
    setEdges(edges: EdgeData[]): void;
    getNode(id: string): NodeData | undefined;
    getEdge(id: string): EdgeData | undefined;
    getNodes(): NodeData[];
    getEdges(): EdgeData[];
    getEdgesForNode(nodeId: string): EdgeData[];
    /** Return all edges that connect sourceId and targetId (in either direction). */
    getEdgesBetween(sourceId: string, targetId: string): EdgeData[];
    /** Return full NodeData objects for every currently selected node. */
    getSelectedNodes(): NodeData[];
    /** Return full EdgeData objects for every currently selected edge. */
    getSelectedEdges(): EdgeData[];
    /** Set or clear the status badge on a node. Pass null to remove the badge. */
    setNodeStatus(id: string, status: NodeStatus | null): void;
    /** Pan viewport so the given node is centered in the canvas. */
    scrollToNode(id: string, padding?: number): void;
    /** Apply a built-in light or dark theme preset. */
    setTheme(theme: 'light' | 'dark'): void;
    getViewport(): ViewportState;
    setViewport(state: ViewportState): void;
    fitView(padding?: number): void;
    fitViewToSelection(padding?: number): void;
    /** Center the viewport on the given world coordinates. */
    panTo(worldX: number, worldY: number): void;
    /** Return the AABB of the given nodes, or all nodes when no ids are provided. Returns null when there are no nodes. */
    getNodesBounds(ids?: string[]): AABB | null;
    private static readonly ZOOM_STEPS;
    zoomIn(): void;
    zoomOut(): void;
    zoomTo(factor: number): void;
    /** Request a render on the next animation frame. Useful for continuous rendering in benchmarks. */
    requestRender(): void;
    /** Enable the minimap (or reconfigure it). Pass null to disable. */
    setMinimap(config: Partial<MinimapConfig> | null): void;
    dispose(): void;
}
//# sourceMappingURL=flowchart.d.ts.map