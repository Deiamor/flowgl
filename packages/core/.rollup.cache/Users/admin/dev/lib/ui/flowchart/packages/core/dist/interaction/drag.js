export class NodeDrag {
    constructor(canvas, viewport, graph, hitTester, onStart, onMove, onEnd, shouldBlock = () => false) {
        this.dragging = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.didMove = false;
        this.canvas = canvas;
        this.viewport = viewport;
        this.graph = graph;
        this.hitTester = hitTester;
        this.onStart = onStart;
        this.onMove = onMove;
        this.onEnd = onEnd;
        this.shouldBlock = shouldBlock;
        this.onMouseDown = this.handleMouseDown.bind(this);
        this.onMouseMove = this.handleMouseMove.bind(this);
        this.onMouseUp = this.handleMouseUp.bind(this);
        canvas.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);
    }
    toWorld(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        return this.viewport.screenToWorld(clientX - r.left, clientY - r.top);
    }
    handleMouseDown(e) {
        if (e.button !== 0)
            return;
        // ConnectDrag gets priority when near a handle
        if (this.shouldBlock(e.clientX, e.clientY))
            return;
        const [wx, wy] = this.toWorld(e.clientX, e.clientY);
        const node = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy);
        if (!node)
            return;
        e.stopPropagation();
        this.dragging = node;
        this.dragOffsetX = wx - node.x;
        this.dragOffsetY = wy - node.y;
        this.didMove = false;
        this.canvas.style.cursor = 'grab';
        // onStart is deferred to first actual movement so click-only does not pollute history
    }
    handleMouseMove(e) {
        if (!this.dragging)
            return;
        const [wx, wy] = this.toWorld(e.clientX, e.clientY);
        const nx = wx - this.dragOffsetX;
        const ny = wy - this.dragOffsetY;
        if (!this.didMove) {
            this.onStart(); // capture pre-drag snapshot before first updateNode
            this.didMove = true;
        }
        this.graph.updateNode(this.dragging.id, { x: nx, y: ny });
        this.canvas.style.cursor = 'grabbing';
        this.onMove(this.dragging.id, nx, ny);
    }
    handleMouseUp(_e) {
        if (!this.dragging)
            return;
        const node = this.graph.getNode(this.dragging.id);
        if (node && this.didMove)
            this.onEnd(node.id, node.x, node.y);
        this.dragging = null;
        this.canvas.style.cursor = '';
    }
    dispose() {
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);
    }
}
//# sourceMappingURL=drag.js.map