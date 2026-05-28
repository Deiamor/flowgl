import type { Graph } from '../graph/graph';
import type { Viewport } from '../viewport/viewport';
import type { HitTester } from './hit-test';
export type NodeMoveHandler = (id: string, x: number, y: number) => void;
export type NodeDragEndHandler = (id: string, x: number, y: number) => void;
export type NodeDragStartHandler = () => void;
export declare class NodeDrag {
    private canvas;
    private viewport;
    private graph;
    private hitTester;
    private onStart;
    private onMove;
    private onEnd;
    private shouldBlock;
    private dragging;
    private dragOffsetX;
    private dragOffsetY;
    private didMove;
    private readonly onMouseDown;
    private readonly onMouseMove;
    private readonly onMouseUp;
    constructor(canvas: HTMLCanvasElement, viewport: Viewport, graph: Graph, hitTester: HitTester, onStart: NodeDragStartHandler, onMove: NodeMoveHandler, onEnd: NodeDragEndHandler, shouldBlock?: (clientX: number, clientY: number) => boolean);
    private toWorld;
    private handleMouseDown;
    private handleMouseMove;
    private handleMouseUp;
    dispose(): void;
}
//# sourceMappingURL=drag.d.ts.map