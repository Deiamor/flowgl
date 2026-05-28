export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 4;
export class Viewport {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.width = 1;
        this.height = 1;
    }
    setSize(width, height) {
        this.width = width;
        this.height = height;
    }
    get canvasWidth() { return this.width; }
    get canvasHeight() { return this.height; }
    worldToScreen(wx, wy) {
        return [wx * this.zoom + this.x, wy * this.zoom + this.y];
    }
    screenToWorld(sx, sy) {
        return [(sx - this.x) / this.zoom, (sy - this.y) / this.zoom];
    }
    pan(dx, dy) {
        this.x += dx;
        this.y += dy;
    }
    zoomAt(cx, cy, factor) {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
        const ratio = next / this.zoom;
        this.x = cx - (cx - this.x) * ratio;
        this.y = cy - (cy - this.y) * ratio;
        this.zoom = next;
    }
    // Column-major 4×4 orthographic matrix: world → clip space
    getMatrix() {
        const sx = (2 * this.zoom) / this.width;
        const sy = (-2 * this.zoom) / this.height;
        const tx = (2 * this.x) / this.width - 1;
        const ty = (-2 * this.y) / this.height + 1;
        // prettier-ignore
        return new Float32Array([
            sx, 0, 0, 0,
            0, sy, 0, 0,
            0, 0, 1, 0,
            tx, ty, 0, 1,
        ]);
    }
    getVisibleBounds() {
        const [minX, minY] = this.screenToWorld(0, 0);
        const [maxX, maxY] = this.screenToWorld(this.width, this.height);
        return { minX, minY, maxX, maxY };
    }
    fit(bounds, padding = 40) {
        const w = bounds.maxX - bounds.minX;
        const h = bounds.maxY - bounds.minY;
        if (w === 0 && h === 0)
            return;
        const zoom = Math.min((this.width - padding * 2) / Math.max(w, 1), (this.height - padding * 2) / Math.max(h, 1));
        this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
        this.x = this.width / 2 - (bounds.minX + w / 2) * this.zoom;
        this.y = this.height / 2 - (bounds.minY + h / 2) * this.zoom;
    }
    getState() {
        return { x: this.x, y: this.y, zoom: this.zoom };
    }
    setState(state) {
        this.x = state.x;
        this.y = state.y;
        this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom));
    }
}
//# sourceMappingURL=viewport.js.map