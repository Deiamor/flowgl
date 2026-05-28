const ZOOM_FACTOR_WHEEL = 0.001;
const ZOOM_FACTOR_PINCH = 0.01;
const MIN_PINCH_DIST = 10;
export class PanZoom {
    /**
     * @param shouldBlock - Return true when another handler (drag, connect) owns the pointer.
     *                      PanZoom will not start a pan on that mousedown.
     */
    constructor(canvas, viewport, onUpdate, shouldBlock = () => false) {
        this.isPanning = false;
        this.lastX = 0;
        this.lastY = 0;
        this.lastPinchDist = 0;
        this.canvas = canvas;
        this.viewport = viewport;
        this.onUpdate = onUpdate;
        this.shouldBlock = shouldBlock;
        this.onMouseDown = this.handleMouseDown.bind(this);
        this.onMouseMove = this.handleMouseMove.bind(this);
        this.onMouseUp = this.handleMouseUp.bind(this);
        this.onWheel = this.handleWheel.bind(this);
        this.onTouchStart = this.handleTouchStart.bind(this);
        this.onTouchMove = this.handleTouchMove.bind(this);
        this.onTouchEnd = this.handleTouchEnd.bind(this);
        canvas.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);
        canvas.addEventListener('wheel', this.onWheel, { passive: false });
        canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
        canvas.addEventListener('touchend', this.onTouchEnd);
    }
    offset() {
        const r = this.canvas.getBoundingClientRect();
        return { left: r.left, top: r.top };
    }
    handleMouseDown(e) {
        if (e.button !== 0)
            return;
        const { left, top } = this.offset();
        const sx = e.clientX - left;
        const sy = e.clientY - top;
        if (this.shouldBlock(sx, sy))
            return;
        this.isPanning = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
    }
    handleMouseMove(e) {
        if (!this.isPanning)
            return;
        this.viewport.pan(e.clientX - this.lastX, e.clientY - this.lastY);
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.onUpdate();
    }
    handleMouseUp(_e) {
        this.isPanning = false;
    }
    handleWheel(e) {
        e.preventDefault();
        const { left, top } = this.offset();
        const factor = 1 - e.deltaY * ZOOM_FACTOR_WHEEL;
        this.viewport.zoomAt(e.clientX - left, e.clientY - top, factor);
        this.onUpdate();
    }
    pinchDist(e) {
        if (e.touches.length < 2)
            return 0;
        const t0 = e.touches[0], t1 = e.touches[1];
        return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
    }
    pinchCenter(e) {
        const t0 = e.touches[0], t1 = e.touches[1];
        const { left, top } = this.offset();
        return {
            cx: (t0.clientX + t1.clientX) / 2 - left,
            cy: (t0.clientY + t1.clientY) / 2 - top,
        };
    }
    handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            this.isPanning = true;
            this.lastX = e.touches[0].clientX;
            this.lastY = e.touches[0].clientY;
        }
        else if (e.touches.length === 2) {
            this.isPanning = false;
            this.lastPinchDist = this.pinchDist(e);
        }
    }
    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && this.isPanning) {
            const t = e.touches[0];
            this.viewport.pan(t.clientX - this.lastX, t.clientY - this.lastY);
            this.lastX = t.clientX;
            this.lastY = t.clientY;
            this.onUpdate();
        }
        else if (e.touches.length === 2) {
            const dist = this.pinchDist(e);
            if (this.lastPinchDist > MIN_PINCH_DIST) {
                const { cx, cy } = this.pinchCenter(e);
                this.viewport.zoomAt(cx, cy, 1 + (dist - this.lastPinchDist) * ZOOM_FACTOR_PINCH);
                this.onUpdate();
            }
            this.lastPinchDist = dist;
        }
    }
    handleTouchEnd(_e) {
        this.isPanning = false;
        this.lastPinchDist = 0;
    }
    dispose() {
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('wheel', this.onWheel);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchmove', this.onTouchMove);
        this.canvas.removeEventListener('touchend', this.onTouchEnd);
    }
}
//# sourceMappingURL=pan-zoom.js.map