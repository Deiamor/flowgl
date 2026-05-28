import type { Viewport } from '../viewport/viewport';
export interface BoxSelectOptions {
    /** Return true when the pointer is over something else (node/edge) so box-select should not start. */
    shouldBlock: (clientX: number, clientY: number) => boolean;
    /** Called with world-space bounds when a drag completes (even zero-size drags are suppressed internally). */
    onSelect: (minX: number, minY: number, maxX: number, maxY: number) => void;
}
export declare class BoxSelect {
    private canvas;
    private viewport;
    private opts;
    private active;
    private startClientX;
    private startClientY;
    private overlay;
    private readonly onMouseDown;
    private readonly onMouseMove;
    private readonly onMouseUp;
    constructor(canvas: HTMLCanvasElement, viewport: Viewport, opts: BoxSelectOptions);
    isSelecting(): boolean;
    private offset;
    private handleMouseDown;
    private handleMouseMove;
    private handleMouseUp;
    private createOverlay;
    private updateOverlay;
    private removeOverlay;
    dispose(): void;
}
//# sourceMappingURL=box-select.d.ts.map