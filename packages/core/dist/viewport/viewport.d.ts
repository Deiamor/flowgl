export interface ViewportState {
    x: number;
    y: number;
    zoom: number;
}
export interface AABB {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
export declare const MIN_ZOOM = 0.05;
export declare const MAX_ZOOM = 4;
export declare class Viewport {
    x: number;
    y: number;
    zoom: number;
    private width;
    private height;
    setSize(width: number, height: number): void;
    get canvasWidth(): number;
    get canvasHeight(): number;
    worldToScreen(wx: number, wy: number): [number, number];
    screenToWorld(sx: number, sy: number): [number, number];
    pan(dx: number, dy: number): void;
    zoomAt(cx: number, cy: number, factor: number): void;
    getMatrix(): Float32Array;
    getVisibleBounds(): AABB;
    fit(bounds: AABB, padding?: number): void;
    getState(): ViewportState;
    setState(state: ViewportState): void;
}
//# sourceMappingURL=viewport.d.ts.map