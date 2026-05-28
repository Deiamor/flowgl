// Radius (screen px) within which a handle is "hit"
const HANDLE_HIT_PX = 14;
export function getHandlePositions(node) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    return [
        { nodeId: node.id, side: 'right', wx: node.x + node.width, wy: cy },
        { nodeId: node.id, side: 'left', wx: node.x, wy: cy },
        { nodeId: node.id, side: 'bottom', wx: cx, wy: node.y + node.height },
        { nodeId: node.id, side: 'top', wx: cx, wy: node.y },
    ];
}
export class ConnectDrag {
    constructor(canvas, viewport, graph, hitTester, onStateChange, onConnect) {
        this.state = {
            hoveredNodeId: null,
            hoveredHandle: null,
            connectingFrom: null,
            pendingEndWx: 0,
            pendingEndWy: 0,
            targetNodeId: null,
            targetHandle: null,
        };
        this.canvas = canvas;
        this.viewport = viewport;
        this.graph = graph;
        this.hitTester = hitTester;
        this.onStateChange = onStateChange;
        this.onConnect = onConnect;
        this.onMouseMove = this.handleMouseMove.bind(this);
        this.onMouseDown = this.handleMouseDown.bind(this);
        this.onMouseUp = this.handleMouseUp.bind(this);
        this.onMouseLeave = this.handleMouseLeave.bind(this);
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mouseup', this.onMouseUp);
        canvas.addEventListener('mouseleave', this.onMouseLeave);
    }
    isCapturing() {
        return this.state.connectingFrom !== null;
    }
    /** True if the pointer is currently within click range of any handle. */
    isNearHandle(clientX, clientY) {
        const [wx, wy] = this.toWorld(clientX, clientY);
        return this.findNearestHandle(wx, wy) !== null;
    }
    cancel() {
        if (!this.state.connectingFrom)
            return;
        this.setState({
            connectingFrom: null,
            pendingEndWx: 0,
            pendingEndWy: 0,
            targetNodeId: null,
            targetHandle: null,
        });
        this.canvas.style.cursor = '';
    }
    toWorld(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        return this.viewport.screenToWorld(clientX - r.left, clientY - r.top);
    }
    /**
     * Find the closest handle across ALL nodes — not just hoveredNode.
     * This is critical: handle circles extend beyond the node AABB, so
     * `findNodeAt` returns null when the cursor is over the protruding half.
     * Searching all handles avoids losing the hovered state in that zone.
     */
    findNearestHandle(wx, wy) {
        const hitR = HANDLE_HIT_PX / this.viewport.zoom;
        const nodes = this.graph.getNodes();
        // Check hoveredNodeId first so it wins when multiple nodes overlap
        const ordered = this.state.hoveredNodeId
            ? [
                ...nodes.filter(n => n.id === this.state.hoveredNodeId),
                ...nodes.filter(n => n.id !== this.state.hoveredNodeId),
            ]
            : nodes;
        for (const node of ordered) {
            for (const h of getHandlePositions(node)) {
                if (Math.hypot(wx - h.wx, wy - h.wy) <= hitR)
                    return h;
            }
        }
        return null;
    }
    /**
     * During connection drag: find the target handle to snap to.
     * Priority: handle hit radius on any non-source node → nearest handle on node body.
     * Returns the snap point so `pendingEndWx/Wy` can be updated.
     */
    findTargetHandle(wx, wy, sourceNodeId) {
        const hitR = HANDLE_HIT_PX / this.viewport.zoom;
        // 1. Cursor within handle hit radius on any non-source node
        for (const node of this.graph.getNodes()) {
            if (node.id === sourceNodeId)
                continue;
            for (const h of getHandlePositions(node)) {
                if (Math.hypot(wx - h.wx, wy - h.wy) <= hitR)
                    return h;
            }
        }
        // 2. Cursor inside node body → snap to geometrically nearest handle
        const targetNode = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy);
        if (!targetNode || targetNode.id === sourceNodeId)
            return null;
        return this.nearestHandleOnNode(targetNode, wx, wy);
    }
    /** Returns the handle on `node` whose world position is closest to (wx, wy). */
    nearestHandleOnNode(node, wx, wy) {
        let best = null;
        let bestDist = Infinity;
        for (const h of getHandlePositions(node)) {
            const d = Math.hypot(wx - h.wx, wy - h.wy);
            if (d < bestDist) {
                bestDist = d;
                best = h;
            }
        }
        return best;
    }
    setState(patch) {
        this.state = { ...this.state, ...patch };
        this.onStateChange(this.state);
    }
    handleMouseMove(e) {
        const [wx, wy] = this.toWorld(e.clientX, e.clientY);
        // ── While dragging a connection ─────────────────────────────────
        if (this.state.connectingFrom) {
            const sourceNodeId = this.state.connectingFrom.nodeId;
            const hit = this.findTargetHandle(wx, wy, sourceNodeId);
            this.setState({
                pendingEndWx: hit ? hit.wx : wx,
                pendingEndWy: hit ? hit.wy : wy,
                targetNodeId: hit ? hit.nodeId : null,
                targetHandle: hit ? hit.side : null,
            });
            return;
        }
        // ── Idle: compute hovered node + hovered handle ─────────────────
        const bodyNode = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy);
        const nearHandle = this.findNearestHandle(wx, wy);
        // Handle zone can be outside the node body → prefer handle's node
        const newHoverId = nearHandle?.nodeId ?? bodyNode?.id ?? null;
        this.canvas.style.cursor = nearHandle ? 'crosshair' : '';
        if (newHoverId !== this.state.hoveredNodeId ||
            nearHandle?.side !== this.state.hoveredHandle?.side ||
            nearHandle?.nodeId !== this.state.hoveredHandle?.nodeId) {
            this.setState({ hoveredNodeId: newHoverId, hoveredHandle: nearHandle ?? null });
        }
    }
    handleMouseDown(e) {
        if (e.button !== 0)
            return;
        // Use the already-tracked hoveredHandle — avoids re-computation lag
        const handle = this.state.hoveredHandle;
        if (!handle)
            return;
        e.stopPropagation();
        const [wx, wy] = this.toWorld(e.clientX, e.clientY);
        this.setState({
            connectingFrom: handle,
            pendingEndWx: wx,
            pendingEndWy: wy,
            targetNodeId: null,
            targetHandle: null,
        });
        this.canvas.style.cursor = 'crosshair';
    }
    handleMouseUp(e) {
        if (!this.state.connectingFrom)
            return;
        const from = this.state.connectingFrom;
        // targetHandle is already tracked in state (updated every mousemove)
        const targetId = this.state.targetNodeId;
        const targetHandle = this.state.targetHandle;
        this.setState({
            connectingFrom: null,
            pendingEndWx: 0,
            pendingEndWy: 0,
            targetNodeId: null,
            targetHandle: null,
            hoveredNodeId: targetId ?? null,
            hoveredHandle: null,
        });
        this.canvas.style.cursor = '';
        if (targetId && targetHandle) {
            this.onConnect(from.nodeId, targetId, from.side, targetHandle);
        }
    }
    handleMouseLeave() {
        if (this.state.connectingFrom)
            return; // keep connection active
        if (this.state.hoveredNodeId || this.state.hoveredHandle) {
            this.setState({ hoveredNodeId: null, hoveredHandle: null });
            this.canvas.style.cursor = '';
        }
    }
    dispose() {
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
    }
}
//# sourceMappingURL=connect.js.map