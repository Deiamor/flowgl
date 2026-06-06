import type { Graph } from '../graph/graph';
import type { Viewport } from '../viewport/viewport';
export declare class NodeResize {
    private canvas;
    private overlay;
    private ctx;
    private viewport;
    private graph;
    private onBeforeMutation;
    private onUpdate;
    private onResizeEnd;
    private selectedNodeId;
    private hoveredDir;
    private disabled;
    setDisabled(v: boolean): void;
    private dragState;
    private readonly onMouseMove;
    private readonly onMouseDown;
    private readonly onMouseUp;
    constructor(container: HTMLElement, canvas: HTMLCanvasElement, viewport: Viewport, graph: Graph, onBeforeMutation: () => void, onUpdate: () => void, onResizeEnd?: (id: string, x: number, y: number, width: number, height: number) => void);
    setSelectedNode(id: string | null): void;
    isCapturing(): boolean;
    isNearHandle(clientX: number, clientY: number): boolean;
    private toScreen;
    private toWorld;
    private findHandle;
    private handleMouseMove;
    private handleMouseDown;
    private handleMouseUp;
    render(): void;
    dispose(): void;
}
//# sourceMappingURL=node-resize.d.ts.map