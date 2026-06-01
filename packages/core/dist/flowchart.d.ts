import { EventEmitter } from './events/emitter';
import { Graph } from './graph/graph';
import { Viewport } from './viewport/viewport';
import type { NodeData, NodeStyle } from './graph/node';
import type { EdgeData } from './graph/edge';
import type { ViewportState } from './viewport/viewport';
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
    /**
     * Called when the renderer cannot initialize (e.g. WebGL2 unavailable).
     * If omitted, a console.error is emitted instead.
     */
    onError?: (err: Error) => void;
}
interface FlowChartEvents extends Record<string, unknown> {
    nodeClick: {
        node: NodeData;
    };
    nodeDragEnd: {
        id: string;
        x: number;
        y: number;
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
    private history;
    private panels;
    private resizeObserver;
    private ariaLive;
    private arrowMoveTimer;
    private rafId;
    private failed;
    private selectedIds;
    private selectedEdgeIds;
    private connectState;
    private rerouteState;
    private minimap;
    private htmlOverlay;
    private labelEditable;
    private bgColor;
    private gridConfig;
    constructor(options: FlowChartOptions);
    /** Capture current graph state for undo. Called before any mutation. */
    private beforeMutation;
    private applySnapshot;
    /** Undo the last action. Returns true if successful. */
    undo(): boolean;
    /** Redo a previously undone action. Returns true if successful. */
    redo(): boolean;
    canUndo(): boolean;
    canRedo(): boolean;
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
    private scheduleRender;
    private announceNode;
    private tabSelectNode;
    private moveSelectedByArrow;
    private deleteSelected;
    setNodeStyle(id: string, style: Partial<NodeStyle>): void;
    setNodeBorderColor(id: string, color: string): void;
    setNodeBackgroundColor(id: string, color: string): void;
    setNodeSize(id: string, width: number, height: number): void;
    setBackground(color: string): void;
    setGrid(config: Partial<GridConfig>): void;
    setLabelEditable(enabled: boolean): void;
    getSelectedIds(): string[];
    getSelectedEdgeIds(): string[];
    setSelectedIds(ids: string[]): void;
    clearSelection(): void;
    addNode(node: NodeData): void;
    removeNode(id: string): void;
    updateNode(id: string, updates: Partial<Omit<NodeData, 'id'>>): void;
    addEdge(edge: EdgeData): void;
    removeEdge(id: string): void;
    setNodes(nodes: NodeData[]): void;
    setEdges(edges: EdgeData[]): void;
    getViewport(): ViewportState;
    setViewport(state: ViewportState): void;
    fitView(padding?: number): void;
    /** Request a render on the next animation frame. Useful for continuous rendering in benchmarks. */
    requestRender(): void;
    /** Enable the minimap (or reconfigure it). Pass null to disable. */
    setMinimap(config: Partial<MinimapConfig> | null): void;
    dispose(): void;
}
export {};
//# sourceMappingURL=flowchart.d.ts.map