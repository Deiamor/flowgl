import { getHandlePositions } from './connect';
const ENDPOINT_HIT_PX = 12;
const HANDLE_HIT_PX = 14;
export class EdgeReroute {
    constructor(canvas, viewport, graph, hitTester, getSelectedEdgeIds, onStateChange, onReroute) {
        this.state = null;
        this.canvas = canvas;
        this.viewport = viewport;
        this.graph = graph;
        this.hitTester = hitTester;
        this.getSelectedEdgeIds = getSelectedEdgeIds;
        this.onStateChange = onStateChange;
        this.onReroute = onReroute;
        this.onMouseDown = this.handleMouseDown.bind(this);
        this.onMouseMove = this.handleMouseMove.bind(this);
        this.onMouseUp = this.handleMouseUp.bind(this);
        // Capture phase — must fire before ConnectDrag's bubble-phase listener
        canvas.addEventListener('mousedown', this.onMouseDown, true);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);
    }
    isCapturing() { return this.state !== null; }
    /** True if (clientX, clientY) is on an endpoint circle of a selected edge. */
    isOnEndpoint(clientX, clientY) {
        const [wx, wy] = this.toWorld(clientX, clientY);
        const hitR = ENDPOINT_HIT_PX / this.viewport.zoom;
        return this.getEndpointCircles().some(c => Math.hypot(wx - c.wx, wy - c.wy) <= hitR);
    }
    /** Endpoint circles to render for currently selected edges. */
    getEndpointCircles() {
        const selectedIds = this.getSelectedEdgeIds();
        if (selectedIds.size === 0)
            return [];
        const nodeMap = new Map(this.graph.getNodes().map(n => [n.id, n]));
        const result = [];
        for (const edgeId of selectedIds) {
            const edge = this.graph.getEdge(edgeId);
            if (!edge)
                continue;
            const src = nodeMap.get(edge.source);
            const tgt = nodeMap.get(edge.target);
            if (!src || !tgt)
                continue;
            const srcSide = edge.sourceHandle ?? 'right';
            const tgtSide = edge.targetHandle ?? 'left';
            const srcH = getHandlePositions(src).find(h => h.side === srcSide) ?? getHandlePositions(src)[0];
            const tgtH = getHandlePositions(tgt).find(h => h.side === tgtSide) ?? getHandlePositions(tgt)[0];
            result.push({ wx: srcH.wx, wy: srcH.wy, edgeId, end: 'source' });
            result.push({ wx: tgtH.wx, wy: tgtH.wy, edgeId, end: 'target' });
        }
        return result;
    }
    toWorld(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        return this.viewport.screenToWorld(clientX - r.left, clientY - r.top);
    }
    findTargetHandle(wx, wy, excludeNodeId) {
        const hitR = HANDLE_HIT_PX / this.viewport.zoom;
        for (const node of this.graph.getNodes()) {
            if (node.id === excludeNodeId)
                continue;
            for (const h of getHandlePositions(node)) {
                if (Math.hypot(wx - h.wx, wy - h.wy) <= hitR)
                    return h;
            }
        }
        const bodyNode = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy);
        if (!bodyNode || bodyNode.id === excludeNodeId)
            return null;
        let best = null, bestDist = Infinity;
        for (const h of getHandlePositions(bodyNode)) {
            const d = Math.hypot(wx - h.wx, wy - h.wy);
            if (d < bestDist) {
                bestDist = d;
                best = h;
            }
        }
        return best;
    }
    handleMouseDown(e) {
        if (e.button !== 0)
            return;
        const circles = this.getEndpointCircles();
        if (circles.length === 0)
            return;
        const [wx, wy] = this.toWorld(e.clientX, e.clientY);
        const hitR = ENDPOINT_HIT_PX / this.viewport.zoom;
        for (const circle of circles) {
            if (Math.hypot(wx - circle.wx, wy - circle.wy) > hitR)
                continue;
            const edge = this.graph.getEdge(circle.edgeId);
            if (!edge)
                continue;
            const nodeMap = new Map(this.graph.getNodes().map(n => [n.id, n]));
            let fixedHandle;
            if (circle.end === 'source') {
                // Moving source → fixed end is target
                const tgt = nodeMap.get(edge.target);
                const tgtSide = edge.targetHandle ?? 'left';
                fixedHandle = getHandlePositions(tgt).find(h => h.side === tgtSide) ?? getHandlePositions(tgt)[0];
            }
            else {
                // Moving target → fixed end is source
                const src = nodeMap.get(edge.source);
                const srcSide = edge.sourceHandle ?? 'right';
                fixedHandle = getHandlePositions(src).find(h => h.side === srcSide) ?? getHandlePositions(src)[0];
            }
            // Block ConnectDrag and all other bubble-phase listeners on this element
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.state = {
                edgeId: circle.edgeId,
                movingEnd: circle.end,
                fixedHandle,
                pendingEndWx: wx,
                pendingEndWy: wy,
                targetNodeId: null,
                targetHandle: null,
            };
            this.onStateChange(this.state);
            this.canvas.style.cursor = 'crosshair';
            return;
        }
    }
    handleMouseMove(e) {
        if (!this.state)
            return;
        const [wx, wy] = this.toWorld(e.clientX, e.clientY);
        const edge = this.graph.getEdge(this.state.edgeId);
        if (!edge)
            return;
        const excludeNodeId = this.state.movingEnd === 'source' ? edge.source : edge.target;
        const hit = this.findTargetHandle(wx, wy, excludeNodeId);
        this.state = {
            ...this.state,
            pendingEndWx: hit ? hit.wx : wx,
            pendingEndWy: hit ? hit.wy : wy,
            targetNodeId: hit ? hit.nodeId : null,
            targetHandle: hit ? hit.side : null,
        };
        this.onStateChange(this.state);
    }
    handleMouseUp(_e) {
        if (!this.state)
            return;
        const { edgeId, movingEnd, targetNodeId, targetHandle } = this.state;
        this.state = null;
        this.onStateChange(null);
        this.canvas.style.cursor = '';
        if (targetNodeId && targetHandle) {
            this.onReroute(edgeId, movingEnd, targetNodeId, targetHandle);
        }
    }
    dispose() {
        this.canvas.removeEventListener('mousedown', this.onMouseDown, true);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);
    }
}
//# sourceMappingURL=edge-reroute.js.map