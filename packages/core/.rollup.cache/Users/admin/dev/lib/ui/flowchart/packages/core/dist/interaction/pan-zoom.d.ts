import type { Viewport } from '../viewport/viewport';
export declare class PanZoom {
    private canvas;
    private viewport;
    private onUpdate;
    private shouldBlock;
    private isPanning;
    private lastX;
    private lastY;
    private lastPinchDist;
    private readonly onMouseDown;
    private readonly onMouseMove;
    private readonly onMouseUp;
    private readonly onWheel;
    private readonly onTouchStart;
    private readonly onTouchMove;
    private readonly onTouchEnd;
    /**
     * @param shouldBlock - Return true when another handler (drag, connect) owns the pointer.
     *                      PanZoom will not start a pan on that mousedown.
     */
    constructor(canvas: HTMLCanvasElement, viewport: Viewport, onUpdate: () => void, shouldBlock?: (sx: number, sy: number) => boolean);
    private offset;
    private handleMouseDown;
    private handleMouseMove;
    private handleMouseUp;
    private handleWheel;
    private pinchDist;
    private pinchCenter;
    private handleTouchStart;
    private handleTouchMove;
    private handleTouchEnd;
    dispose(): void;
}
//# sourceMappingURL=pan-zoom.d.ts.map