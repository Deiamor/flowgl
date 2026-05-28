class EventEmitter {
    constructor() {
        this.listeners = {};
    }
    on(type, listener) {
        let set = this.listeners[type];
        if (!set) {
            set = new Set();
            this.listeners[type] = set;
        }
        set.add(listener);
        return () => this.off(type, listener);
    }
    off(type, listener) {
        this.listeners[type]?.delete(listener);
    }
    emit(type, data) {
        this.listeners[type]?.forEach(l => l(data));
    }
    dispose() {
        for (const key in this.listeners) {
            delete this.listeners[key];
        }
    }
}

class Graph {
    constructor() {
        this.nodes = new Map();
        this.edges = new Map();
        // nodeId → set of edgeIds connected to it (for fast cascade-delete)
        this.nodeEdgeIndex = new Map();
    }
    addNode(node) {
        this.nodes.set(node.id, { ...node });
        if (!this.nodeEdgeIndex.has(node.id)) {
            this.nodeEdgeIndex.set(node.id, new Set());
        }
    }
    removeNode(id) {
        const connected = this.nodeEdgeIndex.get(id);
        if (connected) {
            for (const edgeId of connected) {
                const edge = this.edges.get(edgeId);
                if (edge) {
                    const other = edge.source === id ? edge.target : edge.source;
                    this.nodeEdgeIndex.get(other)?.delete(edgeId);
                }
                this.edges.delete(edgeId);
            }
        }
        this.nodes.delete(id);
        this.nodeEdgeIndex.delete(id);
    }
    updateNode(id, updates) {
        const node = this.nodes.get(id);
        if (node)
            this.nodes.set(id, { ...node, ...updates });
    }
    addEdge(edge) {
        if (!this.nodes.has(edge.source)) {
            console.warn(`[Graph] addEdge: source node '${edge.source}' does not exist`);
            return;
        }
        if (!this.nodes.has(edge.target)) {
            console.warn(`[Graph] addEdge: target node '${edge.target}' does not exist`);
            return;
        }
        this.edges.set(edge.id, { ...edge });
        this.nodeEdgeIndex.get(edge.source).add(edge.id);
        this.nodeEdgeIndex.get(edge.target).add(edge.id);
    }
    removeEdge(id) {
        const edge = this.edges.get(id);
        if (edge) {
            this.nodeEdgeIndex.get(edge.source)?.delete(id);
            this.nodeEdgeIndex.get(edge.target)?.delete(id);
        }
        this.edges.delete(id);
    }
    updateEdge(id, updates) {
        const edge = this.edges.get(id);
        if (!edge)
            return;
        if (updates.source !== undefined && updates.source !== edge.source) {
            this.nodeEdgeIndex.get(edge.source)?.delete(id);
            this.nodeEdgeIndex.get(updates.source)?.add(id);
        }
        if (updates.target !== undefined && updates.target !== edge.target) {
            this.nodeEdgeIndex.get(edge.target)?.delete(id);
            this.nodeEdgeIndex.get(updates.target)?.add(id);
        }
        this.edges.set(id, { ...edge, ...updates });
    }
    getNode(id) {
        return this.nodes.get(id);
    }
    getEdge(id) {
        return this.edges.get(id);
    }
    getNodes() {
        return Array.from(this.nodes.values());
    }
    getEdges() {
        return Array.from(this.edges.values());
    }
    get nodeCount() {
        return this.nodes.size;
    }
    get edgeCount() {
        return this.edges.size;
    }
    clear() {
        this.nodes.clear();
        this.edges.clear();
        this.nodeEdgeIndex.clear();
    }
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;
class Viewport {
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

function createWebGL2Context(canvas, antialias) {
    const gl = canvas.getContext('webgl2', { antialias, premultipliedAlpha: false, alpha: true });
    if (!gl)
        return null;
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return gl;
}
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader)
        throw new Error('createShader failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader) ?? '';
        gl.deleteShader(shader);
        throw new Error(`Shader compile error:\n${log}`);
    }
    return shader;
}
function createProgram(gl, vertSrc, fragSrc) {
    const vert = createShader(gl, gl.VERTEX_SHADER, vertSrc);
    const frag = createShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram();
    if (!prog)
        throw new Error('createProgram failed');
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(prog) ?? '';
        gl.deleteProgram(prog);
        throw new Error(`Program link error:\n${log}`);
    }
    return prog;
}

class DynamicBuffer {
    constructor(gl, initialBytes = 65536) {
        this.gl = gl;
        this.capacityBytes = initialBytes;
        const buf = gl.createBuffer();
        if (!buf)
            throw new Error('DynamicBuffer: createBuffer failed');
        this.buffer = buf;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, initialBytes, gl.DYNAMIC_DRAW);
    }
    upload(data) {
        const gl = this.gl;
        const bytes = data.byteLength;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        if (bytes > this.capacityBytes) {
            this.capacityBytes = bytes * 2;
            gl.bufferData(gl.ARRAY_BUFFER, this.capacityBytes, gl.DYNAMIC_DRAW);
        }
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    }
    dispose() {
        this.gl.deleteBuffer(this.buffer);
    }
}

const cache = new Map();
/** Parse any CSS color string into normalized [r, g, b, a] via a 1×1 canvas. */
function parseColor$1(css) {
    const hit = cache.get(css);
    if (hit)
        return hit;
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d');
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const result = [
        d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255,
    ];
    cache.set(css, result);
    return result;
}

const DEFAULT_NODE_STYLE = {
    backgroundColor: '#ffffff',
    borderColor: '#1a73e8',
    borderWidth: 2,
    borderRadius: 8,
    textColor: '#1a1a1a',
    fontSize: 14,
    fontFamily: 'system-ui, sans-serif',
};

// Per-instance (15 floats):
// [0-1]  center (cx, cy)
// [2-3]  size (w, h)
// [4-7]  fill (r,g,b,a)
// [8-11] border (r,g,b,a)
// [12]   border width
// [13]   border radius
// [14]   state  0=normal  0.5=connection-target  1=selected
const FLOATS_PER_INSTANCE = 15;
const VERT$3 = /* glsl */ `#version 300 es
precision highp float;

in vec2  a_quad;
in vec2  a_offset;
in vec2  a_size;
in vec4  a_fill;
in vec4  a_stroke;
in float a_strokeWidth;
in float a_radius;
in float a_state;

uniform mat4 u_matrix;

out vec2  v_local;
out vec2  v_halfSize;
out vec4  v_fill;
out vec4  v_stroke;
out float v_strokeWidth;
out float v_radius;
out float v_state;

void main() {
  v_local      = a_quad * a_size;
  v_halfSize   = a_size * 0.5;
  v_fill       = a_fill;
  v_stroke     = a_stroke;
  v_strokeWidth = a_strokeWidth;
  v_radius     = a_radius;
  v_state      = a_state;
  gl_Position  = u_matrix * vec4(a_offset + a_quad * a_size, 0.0, 1.0);
}
`;
const FRAG$3 = /* glsl */ `#version 300 es
precision highp float;

in vec2  v_local;
in vec2  v_halfSize;
in vec4  v_fill;
in vec4  v_stroke;
in float v_strokeWidth;
in float v_radius;
in float v_state;

out vec4 fragColor;

float roundedBoxSDF(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  float r = clamp(v_radius, 0.0, min(v_halfSize.x, v_halfSize.y));
  float d = roundedBoxSDF(v_local, v_halfSize, r);

  vec4  selColor = vec4(0.18, 0.52, 0.98, 1.0);  // blue  – selected
  vec4  tgtColor = vec4(0.12, 0.78, 0.47, 1.0);  // green – connection target

  vec4  activeBorder;
  float activeBW;
  if (v_state > 0.9) {
    activeBorder = selColor;
    activeBW     = max(v_strokeWidth, 2.5);
  } else if (v_state > 0.4) {
    activeBorder = tgtColor;
    activeBW     = max(v_strokeWidth, 2.5);
  } else {
    activeBorder = v_stroke;
    activeBW     = v_strokeWidth;
  }

  float outer = 1.0 - smoothstep(-1.0, 0.0, d);
  float inner = 1.0 - smoothstep(-1.0, 0.0, d + activeBW);

  vec4 color = mix(activeBorder, v_fill, inner);
  fragColor  = vec4(color.rgb, color.a * outer);
}
`;
class NodeProgram {
    constructor(gl) {
        this.scratch = new Float32Array(0);
        this.gl = gl;
        this.program = createProgram(gl, VERT$3, FRAG$3);
        this.instanceBuffer = new DynamicBuffer(gl);
        const vao = gl.createVertexArray();
        if (!vao)
            throw new Error('NodeProgram: createVertexArray failed');
        this.vao = vao;
        const quadBuf = gl.createBuffer();
        if (!quadBuf)
            throw new Error('NodeProgram: createBuffer failed');
        this.quadBuffer = quadBuf;
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -0.5, -0.5, 0.5, -0.5, 0.5, 0.5,
            -0.5, -0.5, 0.5, 0.5, -0.5, 0.5,
        ]), gl.STATIC_DRAW);
        gl.bindVertexArray(this.vao);
        const quadLoc = gl.getAttribLocation(this.program, 'a_quad');
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
        gl.enableVertexAttribArray(quadLoc);
        gl.vertexAttribPointer(quadLoc, 2, gl.FLOAT, false, 0, 0);
        const stride = FLOATS_PER_INSTANCE * 4;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer.buffer);
        const def = (name, size, offset) => {
            const loc = gl.getAttribLocation(this.program, name);
            if (loc < 0)
                return;
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
            gl.vertexAttribDivisor(loc, 1);
        };
        def('a_offset', 2, 0);
        def('a_size', 2, 2);
        def('a_fill', 4, 4);
        def('a_stroke', 4, 8);
        def('a_strokeWidth', 1, 12);
        def('a_radius', 1, 13);
        def('a_state', 1, 14);
        gl.bindVertexArray(null);
        const matLoc = gl.getUniformLocation(this.program, 'u_matrix');
        if (!matLoc)
            throw new Error('NodeProgram: u_matrix not found');
        this.uMatrix = matLoc;
    }
    render(nodes, matrix, selectedIds, targetNodeId) {
        if (nodes.length === 0)
            return;
        const gl = this.gl;
        const needed = nodes.length * FLOATS_PER_INSTANCE;
        if (this.scratch.length < needed)
            this.scratch = new Float32Array(needed * 2);
        const data = this.scratch;
        let i = 0;
        for (const node of nodes) {
            const style = { ...DEFAULT_NODE_STYLE, ...node.style };
            const [fr, fg, fb, fa] = parseColor$1(style.backgroundColor);
            const [sr, sg, sb, sa] = parseColor$1(style.borderColor);
            let state = 0;
            if (selectedIds.has(node.id))
                state = 1;
            else if (node.id === targetNodeId)
                state = 0.5;
            data[i++] = node.x + node.width / 2;
            data[i++] = node.y + node.height / 2;
            data[i++] = node.width;
            data[i++] = node.height;
            data[i++] = fr;
            data[i++] = fg;
            data[i++] = fb;
            data[i++] = fa;
            data[i++] = sr;
            data[i++] = sg;
            data[i++] = sb;
            data[i++] = sa;
            data[i++] = style.borderWidth;
            data[i++] = style.borderRadius;
            data[i++] = state;
        }
        this.instanceBuffer.upload(data.subarray(0, needed));
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.uMatrix, false, matrix);
        gl.bindVertexArray(this.vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nodes.length);
        gl.bindVertexArray(null);
    }
    dispose() {
        const gl = this.gl;
        gl.deleteProgram(this.program);
        gl.deleteVertexArray(this.vao);
        gl.deleteBuffer(this.quadBuffer);
        this.instanceBuffer.dispose();
    }
}

// Floats per vertex for edge triangle-strip geometry
const EDGE_FLOATS_PER_VERT = 7; // pos(2) + arcLen(1) + color(4)
const BEZIER_SEGMENTS = 32;
/**
 * Compute cubic bezier control points that respect handle exit/entry directions.
 *
 * Each handle side defines the direction the curve leaves (source) or enters (target):
 *   right  → exits/enters rightward  (+x)
 *   left   → exits/enters leftward   (-x)
 *   bottom → exits/enters downward   (+y)
 *   top    → exits/enters upward     (-y)
 *
 * Magnitude is clamped to [50, 150] world units so short connections always
 * produce a visible arc even when the two endpoints are very close.
 */
function edgeControlPoints(sx, sy, sourceHandle, ex, ey, targetHandle) {
    const dist = Math.hypot(ex - sx, ey - sy);
    const mag = Math.max(Math.min(dist * 0.5, 150), 50);
    let c1x, c1y;
    switch (sourceHandle) {
        case 'left':
            c1x = sx - mag;
            c1y = sy;
            break;
        case 'top':
            c1x = sx;
            c1y = sy - mag;
            break;
        case 'bottom':
            c1x = sx;
            c1y = sy + mag;
            break;
        default:
            c1x = sx + mag;
            c1y = sy;
            break; // 'right' or undefined
    }
    let c2x, c2y;
    switch (targetHandle) {
        case 'right':
            c2x = ex + mag;
            c2y = ey;
            break;
        case 'top':
            c2x = ex;
            c2y = ey - mag;
            break;
        case 'bottom':
            c2x = ex;
            c2y = ey + mag;
            break;
        default:
            c2x = ex - mag;
            c2y = ey;
            break; // 'left' or undefined
    }
    return [c1x, c1y, c2x, c2y];
}
function cubicBezierPoint(t, p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
    const mt = 1 - t, mt2 = mt * mt, t2 = t * t;
    return [
        mt2 * mt * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t2 * t * p3x,
        mt2 * mt * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t2 * t * p3y,
    ];
}
function buildBezierStrip(sx, sy, c1x, c1y, c2x, c2y, ex, ey, r, g, b, a, halfWidth, segments = BEZIER_SEGMENTS) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
        pts.push(cubicBezierPoint(i / segments, sx, sy, c1x, c1y, c2x, c2y, ex, ey));
    }
    const vertCount = (segments + 1) * 2;
    const data = new Float32Array(vertCount * EDGE_FLOATS_PER_VERT);
    let arcLen = 0, cursor = 0;
    const write = (x, y, arc) => {
        data[cursor++] = x;
        data[cursor++] = y;
        data[cursor++] = arc;
        data[cursor++] = r;
        data[cursor++] = g;
        data[cursor++] = b;
        data[cursor++] = a;
    };
    for (let i = 0; i <= segments; i++) {
        const [px, py] = pts[i];
        if (i > 0) {
            const [qx, qy] = pts[i - 1];
            arcLen += Math.hypot(px - qx, py - qy);
        }
        let nx, ny;
        if (i < segments) {
            const [qx, qy] = pts[i + 1];
            nx = qy - py;
            ny = px - qx;
        }
        else {
            const [qx, qy] = pts[i - 1];
            nx = py - qy;
            ny = qx - px;
        }
        const len = Math.hypot(nx, ny) || 1;
        const ux = nx / len * halfWidth, uy = ny / len * halfWidth;
        write(px + ux, py + uy, arcLen);
        write(px - ux, py - uy, arcLen);
    }
    return data;
}

const DEFAULT_EDGE_STYLE = {
    color: '#555555',
    width: 2,
};

const VERT$2 = /* glsl */ `#version 300 es
precision highp float;

in vec2  a_position;
in float a_arcLen;
in vec4  a_color;

uniform mat4 u_matrix;

out float v_arcLen;
out vec4  v_color;

void main() {
  v_arcLen    = a_arcLen;
  v_color     = a_color;
  gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
}
`;
const FRAG$2 = /* glsl */ `#version 300 es
precision highp float;

in float v_arcLen;
in vec4  v_color;

uniform bool  u_dashed;
uniform float u_dashLen;
uniform float u_gapLen;

out vec4 fragColor;

void main() {
  if (u_dashed) {
    float period = u_dashLen + u_gapLen;
    if (mod(v_arcLen, period) > u_dashLen) discard;
  }
  fragColor = v_color;
}
`;
function parseColor(css, cache) {
    const hit = cache.get(css);
    if (hit)
        return hit;
    const el = document.createElement('canvas');
    el.width = el.height = 1;
    const ctx = el.getContext('2d');
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const result = [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
    cache.set(css, result);
    return result;
}
function handleXY$1(node, side) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    switch (side) {
        case 'top': return [cx, node.y];
        case 'bottom': return [cx, node.y + node.height];
        case 'left': return [node.x, cy];
        case 'right': return [node.x + node.width, cy];
        default: return [node.x + node.width, cy];
    }
}
class EdgeProgram {
    constructor(gl) {
        this.colorCache = new Map();
        this.scratch = new Float32Array(0);
        this.gl = gl;
        this.program = createProgram(gl, VERT$2, FRAG$2);
        this.vertexBuffer = new DynamicBuffer(gl);
        const vao = gl.createVertexArray();
        if (!vao)
            throw new Error('EdgeProgram: createVertexArray failed');
        this.vao = vao;
        const stride = EDGE_FLOATS_PER_VERT * 4;
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer.buffer);
        const def = (name, size, offset) => {
            const loc = gl.getAttribLocation(this.program, name);
            if (loc < 0)
                return;
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
        };
        def('a_position', 2, 0);
        def('a_arcLen', 1, 2);
        def('a_color', 4, 3);
        gl.bindVertexArray(null);
        const u = (name) => {
            const loc = gl.getUniformLocation(this.program, name);
            if (!loc)
                throw new Error(`EdgeProgram: uniform '${name}' not found`);
            return loc;
        };
        this.uMatrix = u('u_matrix');
        this.uDashed = u('u_dashed');
        this.uDashLen = u('u_dashLen');
        this.uGapLen = u('u_gapLen');
    }
    render(edges, nodeMap, matrix, selectedEdgeIds = new Set()) {
        if (edges.length === 0)
            return;
        const gl = this.gl;
        // Render selected edges last so they appear on top
        const sorted = [...edges].sort((a, b) => (selectedEdgeIds.has(a.id) ? 1 : 0) - (selectedEdgeIds.has(b.id) ? 1 : 0));
        const vertsPerEdge = (BEZIER_SEGMENTS + 1) * 2;
        const needed = sorted.length * vertsPerEdge * EDGE_FLOATS_PER_VERT;
        if (this.scratch.length < needed)
            this.scratch = new Float32Array(needed * 2);
        const combined = this.scratch;
        let offset = 0;
        const drawList = [];
        for (const edge of sorted) {
            const src = nodeMap.get(edge.source);
            const tgt = nodeMap.get(edge.target);
            if (!src || !tgt)
                continue;
            const isSelected = selectedEdgeIds.has(edge.id);
            const style = { ...DEFAULT_EDGE_STYLE, ...edge.style };
            let [r, g, b, a] = parseColor(style.color, this.colorCache);
            if (isSelected) {
                r = 0.102;
                g = 0.451;
                b = 0.910;
                a = 1.0;
            }
            const halfWidth = isSelected ? style.width * 0.75 : style.width / 2;
            const [sx, sy] = handleXY$1(src, edge.sourceHandle ?? 'right');
            const [ex, ey] = handleXY$1(tgt, edge.targetHandle ?? 'left');
            const [c1x, c1y, c2x, c2y] = edgeControlPoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle);
            const strip = buildBezierStrip(sx, sy, c1x, c1y, c2x, c2y, ex, ey, r, g, b, a, halfWidth);
            combined.set(strip, offset);
            offset += strip.length;
            drawList.push({ edge, isSelected });
        }
        if (drawList.length === 0)
            return;
        this.vertexBuffer.upload(combined.subarray(0, offset));
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.uMatrix, false, matrix);
        gl.bindVertexArray(this.vao);
        let vertOffset = 0;
        for (const { edge, isSelected } of drawList) {
            const style = { ...DEFAULT_EDGE_STYLE, ...edge.style };
            if (!isSelected && style.dashArray) {
                gl.uniform1i(this.uDashed, 1);
                gl.uniform1f(this.uDashLen, style.dashArray[0] ?? 8);
                gl.uniform1f(this.uGapLen, style.dashArray[1] ?? 4);
            }
            else {
                gl.uniform1i(this.uDashed, 0);
            }
            gl.drawArrays(gl.TRIANGLE_STRIP, vertOffset, vertsPerEdge);
            vertOffset += vertsPerEdge;
        }
        gl.bindVertexArray(null);
    }
    dispose() {
        this.gl.deleteProgram(this.program);
        this.gl.deleteVertexArray(this.vao);
        this.vertexBuffer.dispose();
    }
}

// Per-vertex: position(2) + uv(2) = 4 floats
const FLOATS_PER_VERT = 4;
const VERT$1 = /* glsl */ `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_uv;

uniform mat4 u_matrix;

out vec2 v_uv;

void main() {
  v_uv        = a_uv;
  gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
}
`;
const FRAG$1 = /* glsl */ `#version 300 es
precision mediump float;

in vec2 v_uv;

uniform sampler2D u_atlas;

out vec4 fragColor;

void main() {
  fragColor = texture(u_atlas, v_uv);
}
`;
class TextProgram {
    constructor(gl, atlas) {
        this.gl = gl;
        this.atlas = atlas;
        this.program = createProgram(gl, VERT$1, FRAG$1);
        this.vertexBuffer = new DynamicBuffer(gl);
        const vao = gl.createVertexArray();
        if (!vao)
            throw new Error('TextProgram: createVertexArray failed');
        this.vao = vao;
        const stride = FLOATS_PER_VERT * 4;
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer.buffer);
        const def = (name, size, offset) => {
            const loc = gl.getAttribLocation(this.program, name);
            if (loc < 0)
                return;
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
        };
        def('a_position', 2, 0);
        def('a_uv', 2, 2);
        gl.bindVertexArray(null);
        const u = (name) => {
            const loc = gl.getUniformLocation(this.program, name);
            if (!loc)
                throw new Error(`TextProgram: uniform '${name}' not found`);
            return loc;
        };
        this.uMatrix = u('u_matrix');
        this.uAtlas = u('u_atlas');
    }
    render(nodes, matrix) {
        if (nodes.length === 0)
            return;
        const gl = this.gl;
        // 6 verts per label (2 triangles)
        const data = new Float32Array(nodes.length * 6 * FLOATS_PER_VERT);
        let cursor = 0;
        let drawCount = 0;
        for (const node of nodes) {
            if (!node.label)
                continue;
            const style = { ...DEFAULT_NODE_STYLE, ...node.style };
            const font = `${style.fontSize}px ${style.fontFamily}`;
            const entry = this.atlas.getOrCreate(node.label, font, style.textColor);
            if (!entry)
                continue;
            // Center text on node
            const cx = node.x + node.width / 2;
            const cy = node.y + node.height / 2;
            const hw = entry.w / 2;
            const hh = entry.h / 2;
            const x0 = cx - hw, y0 = cy - hh;
            const x1 = cx + hw, y1 = cy + hh;
            const { u0, v0, u1, v1 } = entry;
            // Triangle 1
            data[cursor++] = x0;
            data[cursor++] = y0;
            data[cursor++] = u0;
            data[cursor++] = v0;
            data[cursor++] = x1;
            data[cursor++] = y0;
            data[cursor++] = u1;
            data[cursor++] = v0;
            data[cursor++] = x1;
            data[cursor++] = y1;
            data[cursor++] = u1;
            data[cursor++] = v1;
            // Triangle 2
            data[cursor++] = x0;
            data[cursor++] = y0;
            data[cursor++] = u0;
            data[cursor++] = v0;
            data[cursor++] = x1;
            data[cursor++] = y1;
            data[cursor++] = u1;
            data[cursor++] = v1;
            data[cursor++] = x0;
            data[cursor++] = y1;
            data[cursor++] = u0;
            data[cursor++] = v1;
            drawCount += 6;
        }
        if (drawCount === 0)
            return;
        this.atlas.flush(gl);
        this.vertexBuffer.upload(data.subarray(0, cursor));
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.uMatrix, false, matrix);
        gl.uniform1i(this.uAtlas, 0);
        this.atlas.bind(gl, 0);
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLES, 0, drawCount);
        gl.bindVertexArray(null);
    }
    dispose() {
        this.gl.deleteProgram(this.program);
        this.gl.deleteVertexArray(this.vao);
        this.vertexBuffer.dispose();
    }
}

// Radius (screen px) within which a handle is "hit"
const HANDLE_HIT_PX$1 = 14;
function getHandlePositions(node) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    return [
        { nodeId: node.id, side: 'right', wx: node.x + node.width, wy: cy },
        { nodeId: node.id, side: 'left', wx: node.x, wy: cy },
        { nodeId: node.id, side: 'bottom', wx: cx, wy: node.y + node.height },
        { nodeId: node.id, side: 'top', wx: cx, wy: node.y },
    ];
}
class ConnectDrag {
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
        const hitR = HANDLE_HIT_PX$1 / this.viewport.zoom;
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
        const hitR = HANDLE_HIT_PX$1 / this.viewport.zoom;
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

// Per-instance: center(2) + radius(1) + color(4) + hovered(1) = 8 floats
const FLOATS_PER_HANDLE = 8;
// Screen-space radius of a handle circle (px)
const HANDLE_RADIUS_PX = 7;
const CIRCLE_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec2  a_quad;       // [-1, 1] unit square
in vec2  a_center;
in float a_radius;
in vec4  a_color;
in float a_hovered;

uniform mat4 u_matrix;

out vec2  v_uv;
out vec4  v_color;
out float v_hovered;

void main() {
  v_uv     = a_quad;
  v_color  = a_color;
  v_hovered = a_hovered;
  vec2 world  = a_center + a_quad * a_radius;
  gl_Position = u_matrix * vec4(world, 0.0, 1.0);
}
`;
const CIRCLE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2  v_uv;
in vec4  v_color;
in float v_hovered;

out vec4 fragColor;

void main() {
  float d = length(v_uv);

  // Smooth outer edge
  float outer = 1.0 - smoothstep(0.82, 1.0, d);

  // Inner white fill starts at 55% of the radius
  float inner = 1.0 - smoothstep(0.52, 0.62, d);

  // Darken ring color on hover
  vec3 ringRGB = v_hovered > 0.5
    ? clamp(v_color.rgb * 0.62, 0.0, 1.0)
    : v_color.rgb;

  vec4 color = mix(vec4(ringRGB, 1.0), vec4(1.0, 1.0, 1.0, 1.0), inner);
  fragColor  = vec4(color.rgb, color.a * outer);
}
`;
const EDGE_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec2  a_position;
in float a_arcLen;
in vec4  a_color;

uniform mat4 u_matrix;

out float v_arcLen;
out vec4  v_color;

void main() {
  v_arcLen    = a_arcLen;
  v_color     = a_color;
  gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
}
`;
const EDGE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in float v_arcLen;
in vec4  v_color;

uniform float u_dashLen;
uniform float u_gapLen;

out vec4 fragColor;

void main() {
  float period = u_dashLen + u_gapLen;
  if (mod(v_arcLen, period) > u_dashLen) discard;
  fragColor = v_color;
}
`;
class HandleProgram {
    constructor(gl) {
        this.gl = gl;
        // ── Circle program ─────────────────────────────────────────────
        this.circleProgram = createProgram(gl, CIRCLE_VERT, CIRCLE_FRAG);
        this.circleBuffer = new DynamicBuffer(gl);
        const quadBuf = gl.createBuffer();
        if (!quadBuf)
            throw new Error('HandleProgram: createBuffer failed');
        this.quadBuffer = quadBuf;
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, 1, 1,
            -1, -1, 1, 1, -1, 1,
        ]), gl.STATIC_DRAW);
        const circleVao = gl.createVertexArray();
        if (!circleVao)
            throw new Error('HandleProgram: createVertexArray failed');
        this.circleVao = circleVao;
        gl.bindVertexArray(this.circleVao);
        // per-vertex: a_quad
        const aQuad = gl.getAttribLocation(this.circleProgram, 'a_quad');
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
        gl.enableVertexAttribArray(aQuad);
        gl.vertexAttribPointer(aQuad, 2, gl.FLOAT, false, 0, 0);
        // per-instance
        const cStride = FLOATS_PER_HANDLE * 4;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.circleBuffer.buffer);
        const defC = (name, size, offset) => {
            const loc = gl.getAttribLocation(this.circleProgram, name);
            if (loc < 0)
                return;
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, cStride, offset * 4);
            gl.vertexAttribDivisor(loc, 1);
        };
        defC('a_center', 2, 0);
        defC('a_radius', 1, 2);
        defC('a_color', 4, 3);
        defC('a_hovered', 1, 7);
        gl.bindVertexArray(null);
        const cMat = gl.getUniformLocation(this.circleProgram, 'u_matrix');
        if (!cMat)
            throw new Error('HandleProgram: u_matrix not found (circle)');
        this.uCircleMatrix = cMat;
        // ── Edge program (pending connection line) ─────────────────────
        this.edgeProgram = createProgram(gl, EDGE_VERT, EDGE_FRAG);
        this.edgeBuffer = new DynamicBuffer(gl);
        const edgeVao = gl.createVertexArray();
        if (!edgeVao)
            throw new Error('HandleProgram: createVertexArray failed (edge)');
        this.edgeVao = edgeVao;
        gl.bindVertexArray(this.edgeVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer.buffer);
        const eStride = EDGE_FLOATS_PER_VERT * 4;
        const defE = (name, size, offset) => {
            const loc = gl.getAttribLocation(this.edgeProgram, name);
            if (loc < 0)
                return;
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, eStride, offset * 4);
        };
        defE('a_position', 2, 0);
        defE('a_arcLen', 1, 2);
        defE('a_color', 4, 3);
        gl.bindVertexArray(null);
        const eMat = gl.getUniformLocation(this.edgeProgram, 'u_matrix');
        const dLen = gl.getUniformLocation(this.edgeProgram, 'u_dashLen');
        const gLen = gl.getUniformLocation(this.edgeProgram, 'u_gapLen');
        if (!eMat || !dLen || !gLen)
            throw new Error('HandleProgram: edge uniforms not found');
        this.uEdgeMatrix = eMat;
        this.uDashLen = dLen;
        this.uGapLen = gLen;
    }
    render(connectState, nodeMap, matrix, zoom, rerouteState = null, endpointCircles = []) {
        if (connectState) {
            this.renderHandles(connectState, nodeMap, matrix, zoom);
            this.renderPendingEdge(connectState, nodeMap, matrix, zoom);
        }
        this.renderEndpointCircles(endpointCircles, matrix, zoom);
        if (rerouteState)
            this.renderRerouteEdge(rerouteState, matrix, zoom);
    }
    renderHandles(s, nodeMap, matrix, zoom) {
        const gl = this.gl;
        const worldR = HANDLE_RADIUS_PX / zoom;
        // Which nodes need handles drawn?
        // – Always show handles for hovered node
        // – During connection, also show handles on the source node
        const showForIds = new Set();
        if (s.hoveredNodeId)
            showForIds.add(s.hoveredNodeId);
        if (s.connectingFrom?.nodeId)
            showForIds.add(s.connectingFrom.nodeId);
        if (s.targetNodeId)
            showForIds.add(s.targetNodeId); // target node during drag
        if (showForIds.size === 0)
            return;
        const instances = [];
        for (const nodeId of showForIds) {
            const node = nodeMap.get(nodeId);
            if (!node)
                continue;
            const style = { ...DEFAULT_NODE_STYLE, ...node.style };
            const [r, g, b, a] = parseColor$1(style.borderColor);
            for (const h of getHandlePositions(node)) {
                const isHovered = s.hoveredHandle?.nodeId === h.nodeId &&
                    s.hoveredHandle?.side === h.side
                    ? 1 : 0;
                instances.push(h.wx, h.wy, worldR, r, g, b, a, isHovered);
            }
        }
        if (instances.length === 0)
            return;
        const data = new Float32Array(instances);
        this.circleBuffer.upload(data);
        gl.useProgram(this.circleProgram);
        gl.uniformMatrix4fv(this.uCircleMatrix, false, matrix);
        gl.bindVertexArray(this.circleVao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instances.length / FLOATS_PER_HANDLE);
        gl.bindVertexArray(null);
    }
    renderPendingEdge(s, nodeMap, matrix, zoom) {
        if (!s.connectingFrom)
            return;
        const node = nodeMap.get(s.connectingFrom.nodeId);
        if (!node)
            return;
        const style = { ...DEFAULT_NODE_STYLE, ...node.style };
        const [r, g, b] = parseColor$1(style.borderColor);
        const sx = s.connectingFrom.wx;
        const sy = s.connectingFrom.wy;
        const ex = s.pendingEndWx;
        const ey = s.pendingEndWy;
        const [c1x, c1y, c2x, c2y] = edgeControlPoints(sx, sy, s.connectingFrom.side, ex, ey, s.targetHandle ?? undefined);
        const hw = (2 / zoom) / 2;
        const data = buildBezierStrip(sx, sy, c1x, c1y, c2x, c2y, ex, ey, r, g, b, 0.85, hw);
        const gl = this.gl;
        this.edgeBuffer.upload(data);
        gl.useProgram(this.edgeProgram);
        gl.uniformMatrix4fv(this.uEdgeMatrix, false, matrix);
        gl.uniform1f(this.uDashLen, 10 / zoom);
        gl.uniform1f(this.uGapLen, 5 / zoom);
        gl.bindVertexArray(this.edgeVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, (32 + 1) * 2);
        gl.bindVertexArray(null);
    }
    renderEndpointCircles(circles, matrix, zoom) {
        if (circles.length === 0)
            return;
        const gl = this.gl;
        const worldR = HANDLE_RADIUS_PX * 1.4 / zoom;
        // Orange: #fb923c
        const [r, g, b, a] = [0.984, 0.573, 0.235, 1.0];
        const instances = [];
        for (const c of circles) {
            instances.push(c.wx, c.wy, worldR, r, g, b, a, 0);
        }
        const data = new Float32Array(instances);
        this.circleBuffer.upload(data);
        gl.useProgram(this.circleProgram);
        gl.uniformMatrix4fv(this.uCircleMatrix, false, matrix);
        gl.bindVertexArray(this.circleVao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, circles.length);
        gl.bindVertexArray(null);
    }
    renderRerouteEdge(s, matrix, zoom) {
        let sx, sy, srcSide;
        let ex, ey, tgtSide;
        if (s.movingEnd === 'target') {
            sx = s.fixedHandle.wx;
            sy = s.fixedHandle.wy;
            srcSide = s.fixedHandle.side;
            ex = s.pendingEndWx;
            ey = s.pendingEndWy;
            tgtSide = s.targetHandle ?? undefined;
        }
        else {
            sx = s.pendingEndWx;
            sy = s.pendingEndWy;
            srcSide = s.targetHandle ?? undefined;
            ex = s.fixedHandle.wx;
            ey = s.fixedHandle.wy;
            tgtSide = s.fixedHandle.side;
        }
        const [c1x, c1y, c2x, c2y] = edgeControlPoints(sx, sy, srcSide, ex, ey, tgtSide);
        // Orange: #fb923c
        const [r, g, b] = [0.984, 0.573, 0.235];
        const hw = (2 / zoom) / 2;
        const data = buildBezierStrip(sx, sy, c1x, c1y, c2x, c2y, ex, ey, r, g, b, 0.85, hw);
        const gl = this.gl;
        this.edgeBuffer.upload(data);
        gl.useProgram(this.edgeProgram);
        gl.uniformMatrix4fv(this.uEdgeMatrix, false, matrix);
        gl.uniform1f(this.uDashLen, 10 / zoom);
        gl.uniform1f(this.uGapLen, 5 / zoom);
        gl.bindVertexArray(this.edgeVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, (32 + 1) * 2);
        gl.bindVertexArray(null);
    }
    dispose() {
        const gl = this.gl;
        gl.deleteProgram(this.circleProgram);
        gl.deleteProgram(this.edgeProgram);
        gl.deleteVertexArray(this.circleVao);
        gl.deleteVertexArray(this.edgeVao);
        gl.deleteBuffer(this.quadBuffer);
        this.circleBuffer.dispose();
        this.edgeBuffer.dispose();
    }
}

const VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_ndc;
void main() {
  v_ndc = a_position;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
// World-position derivation from NDC using Viewport.getMatrix() inverse:
//   wx = (ndcX + 1) * cssWidth  / (2 * zoom) - viewX / zoom
//   wy = (1 - ndcY) * cssHeight / (2 * zoom) - viewY / zoom
const FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_ndc;

uniform vec2  u_size;      // canvas CSS pixel dimensions
uniform float u_zoom;
uniform float u_viewX;
uniform float u_viewY;
uniform float u_gridSize;
uniform vec4  u_color;
uniform bool  u_dots;

out vec4 fragColor;

void main() {
  float wx = (v_ndc.x + 1.0) * u_size.x * 0.5 / u_zoom - u_viewX / u_zoom;
  float wy = (1.0 - v_ndc.y) * u_size.y * 0.5 / u_zoom - u_viewY / u_zoom;

  float pw    = 1.0 / u_zoom;
  float alpha = 0.0;

  if (u_dots) {
    float gx   = round(wx / u_gridSize) * u_gridSize;
    float gy   = round(wy / u_gridSize) * u_gridSize;
    float dist = length(vec2(wx - gx, wy - gy));
    float dotR = max(1.5 * pw, 0.5);
    alpha = 1.0 - smoothstep(dotR - pw * 0.5, dotR + pw * 0.5, dist);
  } else {
    vec2  cell = vec2(mod(wx, u_gridSize), mod(wy, u_gridSize));
    float lw   = max(pw, 0.4);
    float onX  = 1.0 - smoothstep(0.0, lw, min(cell.x, u_gridSize - cell.x));
    float onY  = 1.0 - smoothstep(0.0, lw, min(cell.y, u_gridSize - cell.y));
    alpha = clamp(onX + onY, 0.0, 1.0);
  }

  fragColor = vec4(u_color.rgb, u_color.a * alpha);
}
`;
class GridProgram {
    constructor(gl) {
        this.gl = gl;
        this.program = createProgram(gl, VERT, FRAG);
        const buf = gl.createBuffer();
        if (!buf)
            throw new Error('GridProgram: createBuffer failed');
        this.quadBuf = buf;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, 1, 1,
            -1, -1, 1, 1, -1, 1,
        ]), gl.STATIC_DRAW);
        const vao = gl.createVertexArray();
        if (!vao)
            throw new Error('GridProgram: createVertexArray failed');
        this.vao = vao;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        const aPos = gl.getAttribLocation(this.program, 'a_position');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
        const u = (name) => {
            const loc = gl.getUniformLocation(this.program, name);
            if (!loc)
                throw new Error(`GridProgram: uniform '${name}' not found`);
            return loc;
        };
        this.uSize = u('u_size');
        this.uZoom = u('u_zoom');
        this.uViewX = u('u_viewX');
        this.uViewY = u('u_viewY');
        this.uGridSize = u('u_gridSize');
        this.uColor = u('u_color');
        this.uDots = u('u_dots');
    }
    render(viewport, gridSize, type, colorStr) {
        // Scale grid size so cells stay >= 16px on screen regardless of zoom
        let size = gridSize;
        while (size * viewport.zoom < 16)
            size *= 2;
        const [r, g, b, a] = parseColor$1(colorStr);
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.uniform2f(this.uSize, viewport.canvasWidth, viewport.canvasHeight);
        gl.uniform1f(this.uZoom, viewport.zoom);
        gl.uniform1f(this.uViewX, viewport.x);
        gl.uniform1f(this.uViewY, viewport.y);
        gl.uniform1f(this.uGridSize, size);
        gl.uniform4f(this.uColor, r, g, b, a);
        gl.uniform1i(this.uDots, type === 'dots' ? 1 : 0);
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null);
    }
    dispose() {
        this.gl.deleteProgram(this.program);
        this.gl.deleteVertexArray(this.vao);
        this.gl.deleteBuffer(this.quadBuf);
    }
}

const ATLAS_SIZE = 2048;
const PADDING = 4;
class TextAtlas {
    constructor() {
        this.entries = new Map();
        this.texture = null;
        this.shelfX = 0;
        this.shelfY = 0;
        this.shelfH = 0;
        this.dirty = false;
        this.offscreen = new OffscreenCanvas(ATLAS_SIZE, ATLAS_SIZE);
        const ctx = this.offscreen.getContext('2d');
        if (!ctx)
            throw new Error('TextAtlas: OffscreenCanvas 2D context unavailable');
        this.ctx = ctx;
        this.ctx.textBaseline = 'top';
    }
    key(text, font) {
        return `${font}|${text}`;
    }
    getOrCreate(text, font, color) {
        const k = this.key(text, font);
        const cached = this.entries.get(k);
        if (cached)
            return cached;
        this.ctx.font = font;
        const metrics = this.ctx.measureText(text);
        const w = Math.ceil(metrics.width) + PADDING * 2;
        const h = Math.ceil((metrics.actualBoundingBoxAscent ?? 0) + (metrics.actualBoundingBoxDescent ?? 0)) + PADDING * 2;
        if (w > ATLAS_SIZE)
            return null;
        if (this.shelfX + w > ATLAS_SIZE) {
            this.shelfY += this.shelfH;
            this.shelfX = 0;
            this.shelfH = 0;
        }
        if (this.shelfY + h > ATLAS_SIZE) {
            // Atlas full — clear and start over
            this.ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
            this.entries.clear();
            this.shelfX = 0;
            this.shelfY = 0;
            this.shelfH = 0;
        }
        this.ctx.fillStyle = color;
        this.ctx.fillText(text, this.shelfX + PADDING, this.shelfY + PADDING);
        const entry = {
            u0: this.shelfX / ATLAS_SIZE,
            v0: this.shelfY / ATLAS_SIZE,
            u1: (this.shelfX + w) / ATLAS_SIZE,
            v1: (this.shelfY + h) / ATLAS_SIZE,
            w,
            h,
        };
        this.entries.set(k, entry);
        this.shelfX += w;
        if (h > this.shelfH)
            this.shelfH = h;
        this.dirty = true;
        return entry;
    }
    flush(gl) {
        if (!this.dirty)
            return;
        if (!this.texture) {
            const tex = gl.createTexture();
            if (!tex)
                throw new Error('TextAtlas: createTexture failed');
            this.texture = tex;
        }
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.offscreen);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.dirty = false;
    }
    bind(gl, unit) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }
    dispose(gl) {
        if (this.texture)
            gl.deleteTexture(this.texture);
    }
}

const EDGE_CULL_PADDING = 200;
function cullNodes(nodes, bounds) {
    return nodes.filter(n => n.x + n.width >= bounds.minX &&
        n.x <= bounds.maxX &&
        n.y + n.height >= bounds.minY &&
        n.y <= bounds.maxY);
}
function cullEdges(edges, nodeMap, bounds) {
    const padded = {
        minX: bounds.minX - EDGE_CULL_PADDING,
        minY: bounds.minY - EDGE_CULL_PADDING,
        maxX: bounds.maxX + EDGE_CULL_PADDING,
        maxY: bounds.maxY + EDGE_CULL_PADDING,
    };
    return edges.filter(e => {
        const src = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        if (!src || !tgt)
            return false;
        const minX = Math.min(src.x, tgt.x);
        const minY = Math.min(src.y, tgt.y);
        const maxX = Math.max(src.x + src.width, tgt.x + tgt.width);
        const maxY = Math.max(src.y + src.height, tgt.y + tgt.height);
        return maxX >= padded.minX && minX <= padded.maxX &&
            maxY >= padded.minY && minY <= padded.maxY;
    });
}
function computeNodeBounds(nodes) {
    if (nodes.length === 0)
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
        if (n.x < minX)
            minX = n.x;
        if (n.y < minY)
            minY = n.y;
        if (n.x + n.width > maxX)
            maxX = n.x + n.width;
        if (n.y + n.height > maxY)
            maxY = n.y + n.height;
    }
    return { minX, minY, maxX, maxY };
}

class WebGL2Renderer {
    constructor() {
        this.dpr = 1;
    }
    initialize(canvas, options = {}) {
        this.dpr = options.pixelRatio ?? window.devicePixelRatio ?? 1;
        const gl = createWebGL2Context(canvas, options.antialias ?? true);
        if (!gl)
            return false;
        this.gl = gl;
        this.atlas = new TextAtlas();
        this.nodeProgram = new NodeProgram(gl);
        this.edgeProgram = new EdgeProgram(gl);
        this.textProgram = new TextProgram(gl, this.atlas);
        this.handleProgram = new HandleProgram(gl);
        this.gridProgram = new GridProgram(gl);
        return true;
    }
    resize(width, height) {
        const gl = this.gl;
        const canvas = gl.canvas;
        canvas.width = Math.round(width * this.dpr);
        canvas.height = Math.round(height * this.dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    render(graph, viewport, selectedIds = new Set(), connectState = null, selectedEdgeIds = new Set(), bgColor = '#f7f7f7', grid = null, rerouteState = null, endpointCircles = []) {
        const gl = this.gl;
        const [br, bg, bb] = parseColor$1(bgColor);
        gl.clearColor(br, bg, bb, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (grid?.visible) {
            this.gridProgram.render(viewport, grid.size, grid.type, grid.color);
        }
        const matrix = viewport.getMatrix();
        const bounds = viewport.getVisibleBounds();
        const allNodes = graph.getNodes();
        const nodeMap = new Map(allNodes.map(n => [n.id, n]));
        const allEdges = graph.getEdges();
        const visNodes = cullNodes(allNodes, bounds);
        const visEdges = cullEdges(allEdges, nodeMap, bounds);
        // Merge connect-drag target and reroute target for node highlight
        const connectTargetId = connectState?.targetNodeId ?? null;
        const rerouteTargetId = rerouteState?.targetNodeId ?? null;
        const targetNodeId = connectTargetId ?? rerouteTargetId;
        // Draw order:
        //   1. edges (behind everything)
        //   2. handles (before nodes — nodes will cover the inner half of each circle)
        //   3. nodes (their opaque fill covers the inner half of handle circles)
        //   4. text (on top of nodes)
        this.edgeProgram.render(visEdges, nodeMap, matrix, selectedEdgeIds);
        if (connectState || endpointCircles.length > 0 || rerouteState) {
            this.handleProgram.render(connectState, nodeMap, matrix, viewport.zoom, rerouteState, endpointCircles);
        }
        this.nodeProgram.render(visNodes, matrix, selectedIds, targetNodeId);
        this.textProgram.render(visNodes, matrix);
    }
    dispose() {
        this.nodeProgram.dispose();
        this.edgeProgram.dispose();
        this.textProgram.dispose();
        this.handleProgram.dispose();
        this.gridProgram.dispose();
        this.atlas.dispose(this.gl);
    }
}

class HitTester {
    findNodeAt(nodes, wx, wy) {
        // Iterate in reverse so topmost (last-added) node wins
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            if (wx >= n.x && wx <= n.x + n.width && wy >= n.y && wy <= n.y + n.height) {
                return n;
            }
        }
        return null;
    }
    findNodesInBox(nodes, minX, minY, maxX, maxY) {
        return nodes.filter(n => n.x < maxX && n.x + n.width > minX &&
            n.y < maxY && n.y + n.height > minY);
    }
}

const ZOOM_FACTOR_WHEEL = 0.001;
const ZOOM_FACTOR_PINCH = 0.01;
const MIN_PINCH_DIST = 10;
class PanZoom {
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

class NodeDrag {
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

const SAMPLES = 40; // points sampled along the bezier for hit detection
const HIT_PX = 8; // screen-space tolerance in pixels
function handleXY(node, side) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    switch (side) {
        case 'top': return [cx, node.y];
        case 'bottom': return [cx, node.y + node.height];
        case 'left': return [node.x, cy];
        case 'right': return [node.x + node.width, cy];
        default: return [node.x + node.width, cy];
    }
}
class EdgeHitTester {
    /** Returns the topmost edge whose bezier passes within HIT_PX/zoom of (wx, wy). */
    findEdgeAt(edges, nodeMap, wx, wy, zoom) {
        const threshold = HIT_PX / zoom;
        for (let i = edges.length - 1; i >= 0; i--) {
            const edge = edges[i];
            const src = nodeMap.get(edge.source);
            const tgt = nodeMap.get(edge.target);
            if (!src || !tgt)
                continue;
            const [sx, sy] = handleXY(src, edge.sourceHandle ?? 'right');
            const [ex, ey] = handleXY(tgt, edge.targetHandle ?? 'left');
            const [c1x, c1y, c2x, c2y] = edgeControlPoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle);
            for (let j = 0; j <= SAMPLES; j++) {
                const [px, py] = cubicBezierPoint(j / SAMPLES, sx, sy, c1x, c1y, c2x, c2y, ex, ey);
                if (Math.hypot(wx - px, wy - py) <= threshold)
                    return edge;
            }
        }
        return null;
    }
}

const ENDPOINT_HIT_PX = 12;
const HANDLE_HIT_PX = 14;
class EdgeReroute {
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

const MENU_STYLE = `
  position: fixed;
  background: #1a2340;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.5);
  padding: 4px;
  z-index: 9000;
  min-width: 170px;
  font-family: system-ui, -apple-system, sans-serif;
  user-select: none;
`;
const ITEM_BASE = `
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 8px 14px; border: none;
  background: transparent; text-align: left;
  font-size: 13px; border-radius: 5px;
  cursor: pointer; transition: background .1s;
  box-sizing: border-box; font-family: inherit;
`;
const SEP_STYLE = `
  height: 1px; margin: 4px 8px;
  background: rgba(255,255,255,0.1);
`;
class ContextMenu {
    constructor() {
        this.el = null;
        this.subPanel = null;
        this.hideSubTimer = null;
        this.hideOnOutside = (e) => {
            const target = e.target;
            const inMenu = this.el ? this.el.contains(target) : false;
            const inPanel = this.subPanel ? this.subPanel.contains(target) : false;
            if (!inMenu && !inPanel)
                this.hide();
        };
        this.hideOnScroll = () => this.hide();
    }
    show(clientX, clientY, entries) {
        this.hide();
        const menu = document.createElement('div');
        menu.style.cssText = MENU_STYLE;
        menu.style.left = `${clientX}px`;
        menu.style.top = `${clientY}px`;
        for (const entry of entries) {
            if ('separator' in entry && entry.separator) {
                const sep = document.createElement('div');
                sep.style.cssText = SEP_STYLE;
                menu.appendChild(sep);
                continue;
            }
            if ('panel' in entry) {
                menu.appendChild(this.buildSubItem(entry));
                continue;
            }
            menu.appendChild(this.buildItem(entry));
        }
        document.body.appendChild(menu);
        // Clamp to viewport
        const r = menu.getBoundingClientRect();
        if (r.right > window.innerWidth)
            menu.style.left = `${clientX - r.width}px`;
        if (r.bottom > window.innerHeight)
            menu.style.top = `${clientY - r.height}px`;
        this.el = menu;
        requestAnimationFrame(() => {
            document.addEventListener('pointerdown', this.hideOnOutside);
            window.addEventListener('scroll', this.hideOnScroll, true);
        });
    }
    buildItem(item) {
        const btn = document.createElement('button');
        btn.style.cssText = ITEM_BASE;
        btn.style.color = item.destructive ? '#f87171' : '#d1d5db';
        btn.style.opacity = item.disabled ? '0.45' : '1';
        btn.style.cursor = item.disabled ? 'not-allowed' : 'pointer';
        const label = document.createElement('span');
        label.textContent = item.label;
        btn.appendChild(label);
        if (!item.disabled) {
            btn.addEventListener('pointerenter', () => {
                btn.style.background = 'rgba(255,255,255,0.08)';
                this.scheduleHideSub(); // hovering a regular item hides any open sub-panel
            });
            btn.addEventListener('pointerleave', () => {
                btn.style.background = 'transparent';
            });
            btn.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                item.action();
                this.hide();
            });
        }
        return btn;
    }
    buildSubItem(item) {
        const btn = document.createElement('button');
        btn.style.cssText = ITEM_BASE;
        btn.style.color = '#d1d5db';
        btn.style.opacity = item.disabled ? '0.45' : '1';
        btn.style.cursor = item.disabled ? 'not-allowed' : 'pointer';
        const label = document.createElement('span');
        label.textContent = item.label;
        btn.appendChild(label);
        const arrow = document.createElement('span');
        arrow.textContent = '▶';
        arrow.style.cssText = 'font-size: 9px; opacity: 0.55; margin-left: 8px; flex-shrink: 0;';
        btn.appendChild(arrow);
        if (!item.disabled) {
            btn.addEventListener('pointerenter', () => {
                btn.style.background = 'rgba(255,255,255,0.08)';
                this.cancelHideSub();
                this.showSubPanel(btn, item.panel());
            });
            btn.addEventListener('pointerleave', () => {
                btn.style.background = 'transparent';
                this.scheduleHideSub();
            });
        }
        return btn;
    }
    // ── Sub-panel positioning ──────────────────────────────────────────────────
    showSubPanel(anchorEl, panel) {
        this.subPanel?.remove();
        // Measure offscreen first
        panel.style.cssText += '; position: fixed; left: -9999px; top: -9999px;';
        document.body.appendChild(panel);
        const pr = panel.getBoundingClientRect();
        const ar = anchorEl.getBoundingClientRect();
        const mr = this.el.getBoundingClientRect();
        // Horizontal: try right of menu, fall back to left
        const spaceRight = window.innerWidth - mr.right;
        const spaceLeft = mr.left;
        let left;
        if (spaceRight >= pr.width + 8 || spaceRight >= spaceLeft) {
            left = mr.right + 4;
        }
        else {
            left = mr.left - pr.width - 4;
        }
        // Vertical: align top with the hovered item, clamp to viewport
        let top = ar.top;
        top = Math.min(top, window.innerHeight - pr.height - 8);
        top = Math.max(top, 8);
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        this.subPanel = panel;
        panel.addEventListener('pointerenter', () => this.cancelHideSub());
        panel.addEventListener('pointerleave', () => this.scheduleHideSub());
    }
    hideSubPanel() {
        this.subPanel?.remove();
        this.subPanel = null;
    }
    scheduleHideSub() {
        if (this.hideSubTimer !== null)
            return;
        this.hideSubTimer = window.setTimeout(() => {
            this.hideSubTimer = null;
            this.hideSubPanel();
        }, 180);
    }
    cancelHideSub() {
        if (this.hideSubTimer === null)
            return;
        clearTimeout(this.hideSubTimer);
        this.hideSubTimer = null;
    }
    // ─────────────────────────────────────────────────────────────────────────
    hide() {
        this.cancelHideSub();
        this.hideSubPanel();
        if (!this.el)
            return;
        this.el.remove();
        this.el = null;
        document.removeEventListener('pointerdown', this.hideOnOutside);
        window.removeEventListener('scroll', this.hideOnScroll, true);
    }
    dispose() { this.hide(); }
}

const EDITING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
class KeyboardHandler {
    constructor(canvas, opts) {
        this.canvas = canvas;
        this.onKeyDown = (e) => {
            const tag = e.target?.tagName ?? '';
            if (EDITING_TAGS.has(tag))
                return;
            switch (e.key) {
                case 'Delete':
                case 'Backspace':
                    e.preventDefault();
                    opts.onDelete();
                    break;
                case 'Escape':
                    opts.onEscape();
                    break;
                case 'z':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        if (e.shiftKey)
                            opts.onRedo();
                        else
                            opts.onUndo();
                    }
                    break;
                case 'y':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        opts.onRedo();
                    }
                    break;
                case 'a':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        opts.onSelectAll();
                    }
                    break;
            }
        };
        // Attach to canvas so only the focused instance handles events
        canvas.addEventListener('keydown', this.onKeyDown);
    }
    dispose() {
        this.canvas.removeEventListener('keydown', this.onKeyDown);
    }
}

const MIN_DRAG_PX = 4; // pixels of movement before box is confirmed
class BoxSelect {
    constructor(canvas, viewport, opts) {
        this.active = false;
        this.startClientX = 0;
        this.startClientY = 0;
        this.overlay = null;
        this.canvas = canvas;
        this.viewport = viewport;
        this.opts = opts;
        this.onMouseDown = this.handleMouseDown.bind(this);
        this.onMouseMove = this.handleMouseMove.bind(this);
        this.onMouseUp = this.handleMouseUp.bind(this);
        canvas.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);
    }
    isSelecting() { return this.active; }
    offset() {
        const r = this.canvas.getBoundingClientRect();
        return { left: r.left, top: r.top };
    }
    handleMouseDown(e) {
        // Only Shift + left button starts box select
        if (e.button !== 0 || !e.shiftKey)
            return;
        if (this.opts.shouldBlock(e.clientX, e.clientY))
            return;
        e.preventDefault();
        this.active = true;
        this.startClientX = e.clientX;
        this.startClientY = e.clientY;
        this.createOverlay();
    }
    handleMouseMove(e) {
        if (!this.active || !this.overlay)
            return;
        this.updateOverlay(e.clientX, e.clientY);
    }
    handleMouseUp(e) {
        if (!this.active)
            return;
        this.active = false;
        this.removeOverlay();
        const dx = Math.abs(e.clientX - this.startClientX);
        const dy = Math.abs(e.clientY - this.startClientY);
        if (dx < MIN_DRAG_PX && dy < MIN_DRAG_PX)
            return; // too small, ignore
        const { left, top } = this.offset();
        const [wax, way] = this.viewport.screenToWorld(Math.min(this.startClientX, e.clientX) - left, Math.min(this.startClientY, e.clientY) - top);
        const [wbx, wby] = this.viewport.screenToWorld(Math.max(this.startClientX, e.clientX) - left, Math.max(this.startClientY, e.clientY) - top);
        this.opts.onSelect(wax, way, wbx, wby);
    }
    createOverlay() {
        const div = document.createElement('div');
        div.style.cssText = `
      position: fixed;
      border: 1.5px dashed rgba(100,160,255,0.8);
      background: rgba(60,120,255,0.06);
      pointer-events: none;
      z-index: 8000;
      box-sizing: border-box;
    `;
        document.body.appendChild(div);
        this.overlay = div;
        this.updateOverlay(this.startClientX, this.startClientY);
    }
    updateOverlay(clientX, clientY) {
        if (!this.overlay)
            return;
        const x = Math.min(this.startClientX, clientX);
        const y = Math.min(this.startClientY, clientY);
        const w = Math.abs(clientX - this.startClientX);
        const h = Math.abs(clientY - this.startClientY);
        this.overlay.style.left = `${x}px`;
        this.overlay.style.top = `${y}px`;
        this.overlay.style.width = `${w}px`;
        this.overlay.style.height = `${h}px`;
    }
    removeOverlay() {
        this.overlay?.remove();
        this.overlay = null;
    }
    dispose() {
        this.removeOverlay();
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);
    }
}

class LabelEditor {
    constructor() {
        this.input = null;
        this.boundBlur = null;
    }
    startEdit(node, canvas, viewport, onDone) {
        this.stopEdit();
        const style = { ...DEFAULT_NODE_STYLE, ...node.style };
        const [sx, sy] = viewport.worldToScreen(node.x + node.width / 2, node.y + node.height / 2);
        const canvasRect = canvas.getBoundingClientRect();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = node.label;
        input.style.cssText = `
      position: fixed;
      left: ${canvasRect.left + sx}px;
      top:  ${canvasRect.top + sy}px;
      transform: translate(-50%, -50%);
      width: ${Math.max(80, node.width * viewport.zoom - 20)}px;
      padding: 4px 8px;
      border: 2px solid ${style.borderColor};
      border-radius: 4px;
      background: ${style.backgroundColor};
      color: ${style.textColor};
      font-size: ${style.fontSize * viewport.zoom}px;
      font-family: ${style.fontFamily};
      text-align: center;
      outline: none;
      z-index: 8500;
      box-sizing: border-box;
    `;
        let committed = false;
        const commit = () => {
            if (committed)
                return;
            committed = true;
            onDone(input.value.trim() || node.label);
            this.stopEdit();
            // Return focus to canvas so keyboard shortcuts keep working
            canvas.focus();
        };
        // Store a stable reference so removeEventListener works correctly
        this.boundBlur = commit;
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter')
                commit();
            if (e.key === 'Escape') {
                committed = true;
                this.stopEdit();
                canvas.focus();
            }
        });
        input.addEventListener('blur', commit);
        document.body.appendChild(input);
        this.input = input;
        requestAnimationFrame(() => { input.select(); });
    }
    stopEdit() {
        if (!this.input)
            return;
        if (this.boundBlur) {
            this.input.removeEventListener('blur', this.boundBlur);
            this.boundBlur = null;
        }
        this.input.remove();
        this.input = null;
    }
    dispose() { this.stopEdit(); }
}

/** Snapshot-based undo/redo history. */
class History {
    constructor(limit = 100) {
        this.limit = limit;
        this.past = [];
        this.future = [];
    }
    /** Capture the current state before a mutation. */
    save(snapshot) {
        this.past.push(snapshot);
        this.future = [];
        if (this.past.length > this.limit)
            this.past.shift();
    }
    /** Restore the previous state. Returns the snapshot to apply, or null if none. */
    undo(current) {
        if (!this.past.length)
            return null;
        this.future.push(current);
        if (this.future.length > this.limit)
            this.future.shift();
        return this.past.pop();
    }
    /** Re-apply a previously undone state. Returns the snapshot to apply, or null if none. */
    redo(current) {
        if (!this.future.length)
            return null;
        this.past.push(current);
        return this.future.pop();
    }
    canUndo() { return this.past.length > 0; }
    canRedo() { return this.future.length > 0; }
    clear() { this.past = []; this.future = []; }
}

/**
 * Hierarchical layout (Sugiyama-style).
 *
 * 1. Assign layers using Kahn's topological sort (longest-path).
 * 2. Order nodes within each layer with the barycenter heuristic
 *    (forward + backward passes) to minimize edge crossings.
 * 3. Place layers left→right; center each layer's column vertically.
 *
 * Cycles are handled gracefully: back-edges are ignored during layer
 * assignment and any cycle-only subgraphs are placed at layer 0.
 */
function hierarchicalLayout(nodes, edges, gapX = 100, gapY = 60) {
    if (nodes.length === 0)
        return new Map();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    // ── Build adjacency (ignore self-loops and dangling refs) ──────────────
    const outEdges = new Map();
    const inEdges = new Map();
    for (const n of nodes) {
        outEdges.set(n.id, new Set());
        inEdges.set(n.id, new Set());
    }
    for (const e of edges) {
        if (nodeMap.has(e.source) && nodeMap.has(e.target) && e.source !== e.target) {
            outEdges.get(e.source).add(e.target);
            inEdges.get(e.target).add(e.source);
        }
    }
    // ── Layer assignment: Kahn's topological sort + longest-path ──────────
    const inDegree = new Map();
    for (const n of nodes)
        inDegree.set(n.id, inEdges.get(n.id).size);
    const layer = new Map();
    const queue = [];
    for (const n of nodes) {
        if (inDegree.get(n.id) === 0) {
            layer.set(n.id, 0);
            queue.push(n.id);
        }
    }
    // All-cycle graph: pick minimum-in-degree node as root
    if (queue.length === 0) {
        let min = Infinity, root = nodes[0].id;
        for (const n of nodes) {
            const d = inDegree.get(n.id);
            if (d < min) {
                min = d;
                root = n.id;
            }
        }
        layer.set(root, 0);
        queue.push(root);
    }
    const remaining = new Map(inDegree);
    let qi = 0;
    while (qi < queue.length) {
        const id = queue[qi++];
        const l = layer.get(id);
        for (const tgt of outEdges.get(id)) {
            // Longest-path: only advance when this gives a deeper layer
            if ((layer.get(tgt) ?? -1) < l + 1)
                layer.set(tgt, l + 1);
            const rem = remaining.get(tgt) - 1;
            remaining.set(tgt, rem);
            if (rem === 0)
                queue.push(tgt);
        }
    }
    // Nodes unreachable from roots (pure cycles) land at layer 0
    for (const n of nodes) {
        if (!layer.has(n.id))
            layer.set(n.id, 0);
    }
    // ── Group nodes by layer ────────────────────────────────────────────────
    const maxLayer = Math.max(...layer.values());
    const groups = Array.from({ length: maxLayer + 1 }, () => []);
    for (const [id, l] of layer)
        groups[l].push(id);
    // ── Barycenter heuristic (2 forward + 2 backward passes) ───────────────
    const idxIn = (group, id) => {
        const i = group.indexOf(id);
        return i >= 0 ? i : group.length / 2;
    };
    for (let pass = 0; pass < 2; pass++) {
        // Forward: sort by avg index of in-neighbors in previous layer
        for (let l = 1; l <= maxLayer; l++) {
            const prev = groups[l - 1];
            groups[l].sort((a, b) => {
                const predA = [...inEdges.get(a)].filter(s => layer.get(s) === l - 1);
                const predB = [...inEdges.get(b)].filter(s => layer.get(s) === l - 1);
                const bA = predA.length ? predA.reduce((s, x) => s + idxIn(prev, x), 0) / predA.length : 0;
                const bB = predB.length ? predB.reduce((s, x) => s + idxIn(prev, x), 0) / predB.length : 0;
                return bA - bB;
            });
        }
        // Backward: sort by avg index of out-neighbors in next layer
        for (let l = maxLayer - 1; l >= 0; l--) {
            const next = groups[l + 1];
            groups[l].sort((a, b) => {
                const succA = [...outEdges.get(a)].filter(t => layer.get(t) === l + 1);
                const succB = [...outEdges.get(b)].filter(t => layer.get(t) === l + 1);
                const bA = succA.length ? succA.reduce((s, x) => s + idxIn(next, x), 0) / succA.length : 0;
                const bB = succB.length ? succB.reduce((s, x) => s + idxIn(next, x), 0) / succB.length : 0;
                return bA - bB;
            });
        }
    }
    // ── Coordinate assignment ──────────────────────────────────────────────
    // Compute each layer's column height and the global max height (for centering)
    const colHeight = groups.map(ids => ids.reduce((h, id) => h + (nodeMap.get(id)?.height ?? 60) + gapY, 0) - gapY);
    const maxColHeight = Math.max(...colHeight, 0);
    const result = new Map();
    let x = 0;
    for (let l = 0; l <= maxLayer; l++) {
        const ids = groups[l];
        const colW = Math.max(...ids.map(id => nodeMap.get(id)?.width ?? 120));
        const startY = Math.round((maxColHeight - colHeight[l]) / 2);
        let y = startY;
        for (const id of ids) {
            const n = nodeMap.get(id);
            result.set(id, { x, y });
            y += n.height + gapY;
        }
        x += colW + gapX;
    }
    return result;
}
/**
 * Spring-force layout (Fruchterman-Reingold approximation).
 * Works with any graph topology; useful when hierarchy is not meaningful.
 */
function forceLayout(nodes, edges, iterations = 150) {
    if (nodes.length === 0)
        return new Map();
    const pos = new Map();
    for (const n of nodes) {
        pos.set(n.id, { x: n.x + n.width / 2, y: n.y + n.height / 2 });
    }
    const k = Math.sqrt(200 * 200 * nodes.length) / nodes.length * 5;
    let temp = k * 2;
    for (let iter = 0; iter < iterations; iter++) {
        const disp = new Map();
        for (const n of nodes)
            disp.set(n.id, { x: 0, y: 0 });
        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                const pa = pos.get(a.id), pb = pos.get(b.id);
                const dx = pa.x - pb.x, dy = pa.y - pb.y;
                const dist = Math.max(Math.hypot(dx, dy), 1);
                const f = k * k / dist;
                const da = disp.get(a.id), db = disp.get(b.id);
                da.x += dx / dist * f;
                da.y += dy / dist * f;
                db.x -= dx / dist * f;
                db.y -= dy / dist * f;
            }
        }
        // Attraction along edges
        for (const edge of edges) {
            const pa = pos.get(edge.source), pb = pos.get(edge.target);
            if (!pa || !pb)
                continue;
            const dx = pb.x - pa.x, dy = pb.y - pa.y;
            const dist = Math.max(Math.hypot(dx, dy), 1);
            const f = dist * dist / k;
            const da = disp.get(edge.source), db = disp.get(edge.target);
            da.x += dx / dist * f;
            da.y += dy / dist * f;
            db.x -= dx / dist * f;
            db.y -= dy / dist * f;
        }
        for (const n of nodes) {
            const p = pos.get(n.id), d = disp.get(n.id);
            const dLen = Math.max(Math.hypot(d.x, d.y), 1);
            p.x += d.x / dLen * Math.min(dLen, temp);
            p.y += d.y / dLen * Math.min(dLen, temp);
        }
        temp *= 0.95;
    }
    const result = new Map();
    for (const n of nodes) {
        const c = pos.get(n.id);
        result.set(n.id, { x: c.x - n.width / 2, y: c.y - n.height / 2 });
    }
    return result;
}
/**
 * Arrange nodes in a uniform grid, sorted by current x position.
 */
function gridLayout(nodes, gap = 40) {
    if (nodes.length === 0)
        return new Map();
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const sorted = [...nodes].sort((a, b) => a.x - b.x || a.y - b.y);
    const cellW = Math.max(...nodes.map(n => n.width), 120) + gap;
    const cellH = Math.max(...nodes.map(n => n.height), 60) + gap;
    const result = new Map();
    sorted.forEach((n, i) => {
        result.set(n.id, {
            x: (i % cols) * cellW,
            y: Math.floor(i / cols) * cellH,
        });
    });
    return result;
}

const PANEL_BASE = `
  background: #1a2340;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.5);
  padding: 14px;
  font-family: system-ui, -apple-system, sans-serif;
  user-select: none;
`;
function section(title, marginBottom = '12px') {
    const wrap = document.createElement('div');
    wrap.style.marginBottom = marginBottom;
    const lbl = document.createElement('div');
    lbl.textContent = title;
    lbl.style.cssText = 'font-size: 11px; color: #9ca3af; margin-bottom: 8px; letter-spacing: .03em;';
    wrap.appendChild(lbl);
    return wrap;
}
function hr() {
    const d = document.createElement('div');
    d.style.cssText = 'height: 1px; background: rgba(255,255,255,0.08); margin: 4px 0 12px;';
    return d;
}
class ContextPanels {
    constructor(deps) {
        this.deps = deps;
    }
    // ── Edge style ─────────────────────────────────────────────────────────────
    edgeStyle(edge) {
        const { graph, scheduleRender, beforeMutation } = this.deps;
        const merged = { ...DEFAULT_EDGE_STYLE, ...edge.style };
        const panel = document.createElement('div');
        panel.style.cssText = PANEL_BASE + 'min-width: 220px;';
        // ── Color ────────────────────────────────────────────────────────
        const colorSec = section('Color');
        const COLORS = ['#64748b', '#1a73e8', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#ec4899', '#06b6d4'];
        const swatchRow = document.createElement('div');
        swatchRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;';
        const refreshSwatches = () => {
            const current = { ...DEFAULT_EDGE_STYLE, ...graph.getEdge(edge.id)?.style }.color;
            swatchRow.querySelectorAll('[data-color]').forEach(el => {
                const c = el.dataset['color'];
                el.style.outline = c === current ? '2px solid #fff' : '2px solid transparent';
                el.style.outlineOffset = '1px';
            });
        };
        for (const color of COLORS) {
            const sw = document.createElement('div');
            sw.dataset['color'] = color;
            sw.style.cssText = `
        width: 22px; height: 22px; border-radius: 50%; background: ${color}; cursor: pointer;
        transition: transform .1s, outline .1s;
        outline: 2px solid ${color === merged.color ? '#fff' : 'transparent'}; outline-offset: 1px;
      `;
            sw.addEventListener('pointerenter', () => { sw.style.transform = 'scale(1.18)'; });
            sw.addEventListener('pointerleave', () => { sw.style.transform = 'scale(1)'; });
            sw.addEventListener('pointerdown', e => {
                e.stopPropagation();
                beforeMutation();
                graph.updateEdge(edge.id, { style: { ...graph.getEdge(edge.id)?.style, color } });
                scheduleRender();
                refreshSwatches();
            });
            swatchRow.appendChild(sw);
        }
        colorSec.appendChild(swatchRow);
        panel.appendChild(colorSec);
        panel.appendChild(hr());
        // ── Width ────────────────────────────────────────────────────────
        const widthSec = section('Width');
        const WIDTHS = [{ label: 'Thin', value: 1 }, { label: 'Medium', value: 2 }, { label: 'Thick', value: 4 }];
        const widthRow = document.createElement('div');
        widthRow.style.cssText = 'display: flex; gap: 6px;';
        const refreshWidths = () => {
            const current = { ...DEFAULT_EDGE_STYLE, ...graph.getEdge(edge.id)?.style }.width;
            widthRow.querySelectorAll('[data-width]').forEach(el => {
                const active = String(current) === el.dataset['width'];
                el.style.background = active ? 'rgba(255,255,255,0.15)' : 'transparent';
                el.style.borderColor = active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
            });
        };
        for (const w of WIDTHS) {
            const btn = document.createElement('button');
            btn.dataset['width'] = String(w.value);
            const active = merged.width === w.value;
            btn.style.cssText = `
        flex: 1; padding: 8px 4px; border-radius: 6px; cursor: pointer;
        border: 1px solid ${active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'};
        background: ${active ? 'rgba(255,255,255,0.15)' : 'transparent'};
        color: #d1d5db; font-size: 11px; font-family: inherit;
        display: flex; flex-direction: column; align-items: center; gap: 5px;
        transition: background .1s, border-color .1s;
      `;
            const line = document.createElement('div');
            line.style.cssText = `width: 28px; height: ${w.value}px; background: #d1d5db; border-radius: 2px;`;
            const lbl = document.createElement('span');
            lbl.textContent = w.label;
            btn.appendChild(line);
            btn.appendChild(lbl);
            btn.addEventListener('pointerenter', () => {
                if (btn.dataset['width'] !== String({ ...DEFAULT_EDGE_STYLE, ...graph.getEdge(edge.id)?.style }.width))
                    btn.style.background = 'rgba(255,255,255,0.08)';
            });
            btn.addEventListener('pointerleave', () => refreshWidths());
            btn.addEventListener('pointerdown', e => {
                e.stopPropagation();
                beforeMutation();
                graph.updateEdge(edge.id, { style: { ...graph.getEdge(edge.id)?.style, width: w.value } });
                scheduleRender();
                refreshWidths();
            });
            widthRow.appendChild(btn);
        }
        widthSec.appendChild(widthRow);
        panel.appendChild(widthSec);
        panel.appendChild(hr());
        // ── Line style ───────────────────────────────────────────────────
        const dashSec = section('Line Style', '0');
        const DASH_OPTS = [
            { label: 'Solid', dashArray: undefined },
            { label: 'Dashed', dashArray: [8, 4] },
            { label: 'Dotted', dashArray: [2, 4] },
        ];
        const dashRow = document.createElement('div');
        dashRow.style.cssText = 'display: flex; gap: 6px;';
        const refreshDash = () => {
            const current = { ...DEFAULT_EDGE_STYLE, ...graph.getEdge(edge.id)?.style }.dashArray;
            dashRow.querySelectorAll('[data-dash]').forEach(el => {
                const active = el.dataset['dash'] === (current ? JSON.stringify(current) : 'solid');
                el.style.background = active ? 'rgba(255,255,255,0.15)' : 'transparent';
                el.style.borderColor = active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
            });
        };
        for (const opt of DASH_OPTS) {
            const btn = document.createElement('button');
            btn.dataset['dash'] = opt.dashArray ? JSON.stringify(opt.dashArray) : 'solid';
            const active = opt.dashArray
                ? JSON.stringify(merged.dashArray) === JSON.stringify(opt.dashArray)
                : !merged.dashArray;
            btn.style.cssText = `
        flex: 1; padding: 8px 4px; border-radius: 6px; cursor: pointer;
        border: 1px solid ${active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'};
        background: ${active ? 'rgba(255,255,255,0.15)' : 'transparent'};
        color: #d1d5db; font-size: 11px; font-family: inherit;
        display: flex; flex-direction: column; align-items: center; gap: 5px;
        transition: background .1s, border-color .1s;
      `;
            const preview = document.createElement('div');
            preview.style.cssText = 'width: 32px; height: 12px; display: flex; align-items: center;';
            const lineEl = document.createElement('div');
            if (!opt.dashArray) {
                lineEl.style.cssText = 'width: 100%; height: 2px; background: #d1d5db; border-radius: 1px;';
            }
            else {
                const [dash, gap] = opt.dashArray;
                lineEl.style.cssText = `
          width: 100%; height: 2px; border-radius: 1px;
          background: repeating-linear-gradient(
            90deg,
            #d1d5db 0px, #d1d5db ${dash}px,
            transparent ${dash}px, transparent ${dash + gap}px
          );
        `;
            }
            preview.appendChild(lineEl);
            const lbl = document.createElement('span');
            lbl.textContent = opt.label;
            btn.appendChild(preview);
            btn.appendChild(lbl);
            btn.addEventListener('pointerenter', () => {
                if (!active)
                    btn.style.background = 'rgba(255,255,255,0.08)';
            });
            btn.addEventListener('pointerleave', () => refreshDash());
            btn.addEventListener('pointerdown', e => {
                e.stopPropagation();
                beforeMutation();
                const cur = { ...graph.getEdge(edge.id)?.style };
                if (opt.dashArray) {
                    graph.updateEdge(edge.id, { style: { ...cur, dashArray: opt.dashArray } });
                }
                else {
                    const { dashArray: _da, ...rest } = cur;
                    graph.updateEdge(edge.id, { style: rest });
                }
                scheduleRender();
                refreshDash();
            });
            dashRow.appendChild(btn);
        }
        dashSec.appendChild(dashRow);
        panel.appendChild(dashSec);
        return panel;
    }
    // ── Background ─────────────────────────────────────────────────────────────
    background() {
        const { getBackground, setBackground } = this.deps;
        const panel = document.createElement('div');
        panel.style.cssText = PANEL_BASE + 'min-width: 180px;';
        const title = document.createElement('div');
        title.textContent = 'Background';
        title.style.cssText = 'font-size: 11px; color: #9ca3af; margin-bottom: 10px; letter-spacing: .03em;';
        panel.appendChild(title);
        const PRESETS = [
            { label: 'Light Gray', color: '#f7f7f7' },
            { label: 'White', color: '#ffffff' },
            { label: 'Warm White', color: '#fffbf0' },
            { label: 'Blue Gray', color: '#f0f4f8' },
            { label: 'Slate Dark', color: '#1e293b' },
            { label: 'Midnight', color: '#0f172a' },
        ];
        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px;';
        const refresh = () => {
            grid.querySelectorAll('[data-bg]').forEach(el => {
                el.style.outline = el.dataset['bg'] === getBackground()
                    ? '2px solid #fff' : '2px solid transparent';
            });
        };
        for (const p of PRESETS) {
            const btn = document.createElement('button');
            btn.dataset['bg'] = p.color;
            btn.style.cssText = `
        padding: 7px 10px; border-radius: 6px; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.05);
        color: #d1d5db; font-size: 11px; font-family: inherit;
        display: flex; align-items: center; gap: 7px;
        outline: ${p.color === getBackground() ? '2px solid #fff' : '2px solid transparent'};
        outline-offset: 1px; transition: background .1s;
      `;
            const swatch = document.createElement('div');
            swatch.style.cssText = `
        width: 14px; height: 14px; border-radius: 3px; flex-shrink: 0;
        background: ${p.color}; border: 1px solid rgba(0,0,0,0.15);
      `;
            const lbl = document.createElement('span');
            lbl.textContent = p.label;
            btn.appendChild(swatch);
            btn.appendChild(lbl);
            btn.addEventListener('pointerenter', () => { btn.style.background = 'rgba(255,255,255,0.1)'; });
            btn.addEventListener('pointerleave', () => { btn.style.background = 'rgba(255,255,255,0.05)'; });
            btn.addEventListener('pointerdown', e => {
                e.stopPropagation();
                setBackground(p.color);
                refresh();
            });
            grid.appendChild(btn);
        }
        panel.appendChild(grid);
        return panel;
    }
    // ── Grid ───────────────────────────────────────────────────────────────────
    grid() {
        const { getGridConfig, setGrid } = this.deps;
        const panel = document.createElement('div');
        panel.style.cssText = PANEL_BASE + 'min-width: 200px;';
        const title = document.createElement('div');
        title.textContent = 'Grid';
        title.style.cssText = 'font-size: 11px; color: #9ca3af; margin-bottom: 10px; letter-spacing: .03em;';
        panel.appendChild(title);
        const row = (label, control) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;';
            const lbl = document.createElement('span');
            lbl.textContent = label;
            lbl.style.cssText = 'font-size: 12px; color: #d1d5db;';
            wrap.appendChild(lbl);
            wrap.appendChild(control);
            return wrap;
        };
        // Toggle
        const toggleBtn = document.createElement('button');
        const refreshToggle = () => {
            const on = getGridConfig().visible;
            toggleBtn.textContent = on ? 'On' : 'Off';
            toggleBtn.style.background = on ? '#1a73e8' : 'rgba(255,255,255,0.08)';
            toggleBtn.style.color = on ? '#fff' : '#9ca3af';
        };
        toggleBtn.style.cssText = `
      padding: 4px 12px; border-radius: 5px; cursor: pointer;
      border: 1px solid rgba(255,255,255,0.15);
      font-size: 11px; font-family: inherit; transition: background .1s, color .1s;
    `;
        refreshToggle();
        toggleBtn.addEventListener('pointerdown', e => {
            e.stopPropagation();
            setGrid({ visible: !getGridConfig().visible });
            refreshToggle();
        });
        panel.appendChild(row('Show Grid', toggleBtn));
        // Type
        const typeWrap = document.createElement('div');
        typeWrap.style.cssText = 'display: flex; gap: 4px;';
        const refreshType = () => {
            typeWrap.querySelectorAll('[data-gtype]').forEach(el => {
                const active = el.dataset['gtype'] === getGridConfig().type;
                el.style.background = active ? 'rgba(255,255,255,0.15)' : 'transparent';
                el.style.borderColor = active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
            });
        };
        for (const t of ['dots', 'lines']) {
            const btn = document.createElement('button');
            btn.dataset['gtype'] = t;
            btn.textContent = t.charAt(0).toUpperCase() + t.slice(1);
            btn.style.cssText = `
        flex: 1; padding: 4px 0; border-radius: 5px; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.15);
        background: ${getGridConfig().type === t ? 'rgba(255,255,255,0.15)' : 'transparent'};
        color: #d1d5db; font-size: 11px; font-family: inherit; transition: background .1s;
      `;
            btn.addEventListener('pointerdown', e => {
                e.stopPropagation();
                setGrid({ type: t });
                refreshType();
            });
            typeWrap.appendChild(btn);
        }
        panel.appendChild(row('Type', typeWrap));
        // Size
        const sizeWrap = document.createElement('div');
        sizeWrap.style.cssText = 'display: flex; gap: 4px;';
        const SIZES = [{ label: 'S', value: 10 }, { label: 'M', value: 20 }, { label: 'L', value: 40 }];
        const refreshSize = () => {
            sizeWrap.querySelectorAll('[data-gsize]').forEach(el => {
                const active = el.dataset['gsize'] === String(getGridConfig().size);
                el.style.background = active ? 'rgba(255,255,255,0.15)' : 'transparent';
                el.style.borderColor = active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
            });
        };
        for (const s of SIZES) {
            const btn = document.createElement('button');
            btn.dataset['gsize'] = String(s.value);
            btn.textContent = s.label;
            btn.style.cssText = `
        flex: 1; padding: 4px 0; border-radius: 5px; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.15);
        background: ${getGridConfig().size === s.value ? 'rgba(255,255,255,0.15)' : 'transparent'};
        color: #d1d5db; font-size: 11px; font-family: inherit; transition: background .1s;
      `;
            btn.addEventListener('pointerdown', e => {
                e.stopPropagation();
                setGrid({ size: s.value });
                refreshSize();
            });
            sizeWrap.appendChild(btn);
        }
        panel.appendChild(row('Size', sizeWrap));
        return panel;
    }
    // ── Auto layout ────────────────────────────────────────────────────────────
    autoLayout() {
        const { graph, contextMenu, scheduleRender, beforeMutation } = this.deps;
        const panel = document.createElement('div');
        panel.style.cssText = PANEL_BASE + 'min-width: 180px;';
        const title = document.createElement('div');
        title.textContent = 'Auto Layout';
        title.style.cssText = 'font-size: 11px; color: #9ca3af; margin-bottom: 10px; letter-spacing: .03em;';
        panel.appendChild(title);
        const makeBtn = (label, desc, onClick) => {
            const btn = document.createElement('button');
            btn.style.cssText = `
        width: 100%; padding: 10px 12px; border-radius: 6px; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.05);
        color: #d1d5db; font-family: inherit;
        text-align: left; margin-bottom: 6px; transition: background .1s;
      `;
            const name = document.createElement('div');
            name.textContent = label;
            name.style.cssText = 'font-size: 12px; font-weight: 500;';
            const sub = document.createElement('div');
            sub.textContent = desc;
            sub.style.cssText = 'font-size: 10px; color: #6b7280; margin-top: 2px;';
            btn.appendChild(name);
            btn.appendChild(sub);
            btn.addEventListener('pointerenter', () => { btn.style.background = 'rgba(255,255,255,0.1)'; });
            btn.addEventListener('pointerleave', () => { btn.style.background = 'rgba(255,255,255,0.05)'; });
            btn.addEventListener('pointerdown', e => {
                e.stopPropagation();
                onClick();
                contextMenu.hide();
            });
            return btn;
        };
        panel.appendChild(makeBtn('Hierarchical', 'Layer-based, minimizes edge crossings', () => {
            beforeMutation();
            const result = hierarchicalLayout(graph.getNodes(), graph.getEdges());
            for (const [id, pos] of result)
                graph.updateNode(id, pos);
            scheduleRender();
        }));
        panel.appendChild(makeBtn('Force', 'Spring-based organic arrangement', () => {
            beforeMutation();
            const result = forceLayout(graph.getNodes(), graph.getEdges());
            for (const [id, pos] of result)
                graph.updateNode(id, pos);
            scheduleRender();
        }));
        panel.appendChild(makeBtn('Grid', 'Arrange nodes in a uniform grid', () => {
            beforeMutation();
            const result = gridLayout(graph.getNodes());
            for (const [id, pos] of result)
                graph.updateNode(id, pos);
            scheduleRender();
        }));
        return panel;
    }
}

const DEFAULT_GRID_CONFIG = {
    visible: false,
    size: 20,
    type: 'dots',
    color: 'rgba(0,0,0,0.15)',
};

class FlowChart extends EventEmitter {
    constructor(options) {
        super();
        this.rafId = null;
        this.failed = false;
        this.selectedIds = new Set();
        this.selectedEdgeIds = new Set();
        this.connectState = null;
        this.rerouteState = null;
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'display:block;touch-action:none;user-select:none;outline:none;';
        // Issue 2: Accessibility attributes
        this.canvas.setAttribute('role', 'application');
        this.canvas.setAttribute('aria-label', options.ariaLabel ?? 'Flowchart');
        this.canvas.setAttribute('tabindex', '0');
        options.container.appendChild(this.canvas);
        this.labelEditable = options.labelEditable ?? true;
        this.bgColor = options.background ?? '#f7f7f7';
        this.gridConfig = { ...DEFAULT_GRID_CONFIG, ...options.grid };
        this.graph = new Graph();
        this.viewport = new Viewport();
        this.renderer = new WebGL2Renderer();
        this.hitTester = new HitTester();
        this.edgeHitTester = new EdgeHitTester();
        this.history = new History(options.historyLimit ?? 100);
        this.contextMenu = new ContextMenu();
        this.labelEditor = new LabelEditor();
        const { width, height } = options.container.getBoundingClientRect();
        this.viewport.setSize(width, height);
        // Issue 1: WebGL2 error handling — graceful failure
        const ok = this.renderer.initialize(this.canvas, options.renderer);
        if (!ok) {
            this.failed = true;
            const err = new Error('@flowchart/core: WebGL2 is not available in this environment');
            if (options.onError)
                options.onError(err);
            else
                console.error('[FlowChart]', err.message);
            return;
        }
        this.renderer.resize(width, height);
        if (options.nodes)
            for (const n of options.nodes)
                this.graph.addNode(n);
        if (options.edges)
            for (const e of options.edges)
                this.graph.addEdge(e);
        // Issue 9: Context panels extracted to separate module
        this.panels = new ContextPanels({
            graph: this.graph,
            contextMenu: this.contextMenu,
            scheduleRender: () => this.scheduleRender(),
            beforeMutation: () => this.beforeMutation(),
            getBackground: () => this.bgColor,
            setBackground: c => this.setBackground(c),
            getGridConfig: () => this.gridConfig,
            setGrid: c => this.setGrid(c),
        });
        // Issue 3: EdgeReroute — capture-phase mousedown fires before ConnectDrag's bubble-phase
        this.edgeReroute = new EdgeReroute(this.canvas, this.viewport, this.graph, this.hitTester, () => this.selectedEdgeIds, (state) => { this.rerouteState = state; this.scheduleRender(); }, (edgeId, movingEnd, targetNodeId, targetHandle) => {
            this.beforeMutation();
            if (movingEnd === 'source') {
                this.graph.updateEdge(edgeId, { source: targetNodeId, sourceHandle: targetHandle });
            }
            else {
                this.graph.updateEdge(edgeId, { target: targetNodeId, targetHandle: targetHandle });
            }
            this.rerouteState = null;
            this.scheduleRender();
        });
        this.connectDrag = new ConnectDrag(this.canvas, this.viewport, this.graph, this.hitTester, (state) => { this.connectState = state; this.scheduleRender(); }, (sourceId, targetId, sourceHandle, targetHandle) => {
            this.emit('connect', { sourceId, targetId, sourceHandle, targetHandle });
        });
        // Issue 3: onStart callback captures snapshot before any drag mutation
        this.drag = new NodeDrag(this.canvas, this.viewport, this.graph, this.hitTester, () => this.beforeMutation(), // onStart: capture before-state
        (_id, _x, _y) => this.scheduleRender(), // onMove
        (id, x, y) => this.emit('nodeDragEnd', { id, x, y }), // onEnd
        (clientX, clientY) => this.edgeReroute.isCapturing() ||
            this.connectDrag.isCapturing() ||
            this.connectDrag.isNearHandle(clientX, clientY));
        this.panZoom = new PanZoom(this.canvas, this.viewport, () => { this.scheduleRender(); this.emit('viewportChange', this.viewport.getState()); }, (sx, sy) => {
            if (this.edgeReroute.isCapturing())
                return true;
            if (this.connectDrag.isCapturing())
                return true;
            const [wx, wy] = this.viewport.screenToWorld(sx, sy);
            return this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy) !== null;
        });
        this.boxSelect = new BoxSelect(this.canvas, this.viewport, {
            shouldBlock: (clientX, clientY) => {
                if (this.edgeReroute.isCapturing())
                    return true;
                const r = this.canvas.getBoundingClientRect();
                const [wx, wy] = this.viewport.screenToWorld(clientX - r.left, clientY - r.top);
                const nodes = this.graph.getNodes();
                if (this.hitTester.findNodeAt(nodes, wx, wy))
                    return true;
                const nodeMap = new Map(nodes.map(n => [n.id, n]));
                return this.edgeHitTester.findEdgeAt(this.graph.getEdges(), nodeMap, wx, wy, this.viewport.zoom) !== null;
            },
            onSelect: (minX, minY, maxX, maxY) => {
                const inBox = this.hitTester.findNodesInBox(this.graph.getNodes(), minX, minY, maxX, maxY);
                this.selectedIds = new Set(inBox.map(n => n.id));
                this.selectedEdgeIds.clear();
                this.emit('selectionChange', { selectedIds: [...this.selectedIds], edgeIds: [] });
                this.scheduleRender();
            },
        });
        // Issue 6: LabelEditor — canvas refocused after edit
        this.canvas.addEventListener('dblclick', (e) => {
            if (!this.labelEditable)
                return;
            const r = this.canvas.getBoundingClientRect();
            const [wx, wy] = this.viewport.screenToWorld(e.clientX - r.left, e.clientY - r.top);
            const node = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy);
            if (!node)
                return;
            this.labelEditor.startEdit(node, this.canvas, this.viewport, (newLabel) => {
                this.beforeMutation();
                this.graph.updateNode(node.id, { label: newLabel });
                this.scheduleRender();
            });
        });
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const r = this.canvas.getBoundingClientRect();
            const [wx, wy] = this.viewport.screenToWorld(e.clientX - r.left, e.clientY - r.top);
            const nodes = this.graph.getNodes();
            const node = this.hitTester.findNodeAt(nodes, wx, wy);
            if (node) {
                if (!this.selectedIds.has(node.id)) {
                    this.selectedIds.clear();
                    this.selectedIds.add(node.id);
                    this.selectedEdgeIds.clear();
                    this.emit('selectionChange', { selectedIds: [node.id], edgeIds: [] });
                    this.scheduleRender();
                }
                this.contextMenu.show(e.clientX, e.clientY, [
                    {
                        label: 'Edit Label',
                        action: () => {
                            this.labelEditor.startEdit(node, this.canvas, this.viewport, (newLabel) => {
                                this.beforeMutation();
                                this.graph.updateNode(node.id, { label: newLabel });
                                this.scheduleRender();
                            });
                        },
                    },
                    { separator: true },
                    { label: 'Delete Node', destructive: true, action: () => this.deleteSelected() },
                ]);
                return;
            }
            const nodeMap = new Map(nodes.map(n => [n.id, n]));
            const edge = this.edgeHitTester.findEdgeAt(this.graph.getEdges(), nodeMap, wx, wy, this.viewport.zoom);
            if (edge) {
                if (!this.selectedEdgeIds.has(edge.id)) {
                    this.selectedIds.clear();
                    this.selectedEdgeIds.clear();
                    this.selectedEdgeIds.add(edge.id);
                    this.emit('selectionChange', { selectedIds: [], edgeIds: [edge.id] });
                    this.scheduleRender();
                }
                this.contextMenu.show(e.clientX, e.clientY, [
                    { label: 'Style', panel: () => this.panels.edgeStyle(edge) },
                    { separator: true },
                    { label: 'Delete Edge', destructive: true, action: () => this.deleteSelected() },
                ]);
                return;
            }
            // Pane right-click
            this.contextMenu.show(e.clientX, e.clientY, [
                { label: 'Background', panel: () => this.panels.background() },
                { label: 'Grid', panel: () => this.panels.grid() },
                { separator: true },
                { label: 'Auto Layout', panel: () => this.panels.autoLayout() },
            ]);
        });
        // Issue 6 + 3: KeyboardHandler — canvas-scoped + undo/redo
        this.keyboardHandler = new KeyboardHandler(this.canvas, {
            onDelete: () => this.deleteSelected(),
            onEscape: () => {
                this.connectDrag.cancel();
                this.connectState = null;
                if (this.selectedIds.size > 0 || this.selectedEdgeIds.size > 0) {
                    this.selectedIds.clear();
                    this.selectedEdgeIds.clear();
                    this.emit('selectionChange', { selectedIds: [], edgeIds: [] });
                }
                this.scheduleRender();
            },
            onSelectAll: () => {
                this.selectedIds = new Set(this.graph.getNodes().map(n => n.id));
                this.selectedEdgeIds = new Set(this.graph.getEdges().map(e => e.id));
                this.emit('selectionChange', {
                    selectedIds: [...this.selectedIds],
                    edgeIds: [...this.selectedEdgeIds],
                });
                this.scheduleRender();
            },
            onUndo: () => this.undo(),
            onRedo: () => this.redo(),
        });
        // Issue 2: Focus canvas on click so keyboard events are received
        this.canvas.addEventListener('mousedown', () => { this.canvas.focus(); });
        this.canvas.addEventListener('click', (e) => {
            if (e.shiftKey)
                return;
            if (this.edgeReroute.isOnEndpoint(e.clientX, e.clientY))
                return;
            const r = this.canvas.getBoundingClientRect();
            const [wx, wy] = this.viewport.screenToWorld(e.clientX - r.left, e.clientY - r.top);
            const node = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy);
            if (node) {
                if (e.metaKey || e.ctrlKey) {
                    if (this.selectedIds.has(node.id))
                        this.selectedIds.delete(node.id);
                    else
                        this.selectedIds.add(node.id);
                }
                else {
                    this.selectedIds.clear();
                    this.selectedIds.add(node.id);
                    this.selectedEdgeIds.clear();
                }
                this.emit('nodeClick', { node });
                this.emit('selectionChange', {
                    selectedIds: [...this.selectedIds],
                    edgeIds: [...this.selectedEdgeIds],
                });
                this.scheduleRender();
                return;
            }
            const nodes = this.graph.getNodes();
            const nodeMap = new Map(nodes.map(n => [n.id, n]));
            const edge = this.edgeHitTester.findEdgeAt(this.graph.getEdges(), nodeMap, wx, wy, this.viewport.zoom);
            if (edge) {
                if (e.metaKey || e.ctrlKey) {
                    if (this.selectedEdgeIds.has(edge.id))
                        this.selectedEdgeIds.delete(edge.id);
                    else
                        this.selectedEdgeIds.add(edge.id);
                }
                else {
                    this.selectedIds.clear();
                    this.selectedEdgeIds.clear();
                    this.selectedEdgeIds.add(edge.id);
                }
                this.emit('selectionChange', {
                    selectedIds: [...this.selectedIds],
                    edgeIds: [...this.selectedEdgeIds],
                });
                this.scheduleRender();
                return;
            }
            if (this.selectedIds.size > 0 || this.selectedEdgeIds.size > 0) {
                this.selectedIds.clear();
                this.selectedEdgeIds.clear();
                this.emit('selectionChange', { selectedIds: [], edgeIds: [] });
                this.scheduleRender();
            }
            this.emit('paneClick', { x: wx, y: wy });
        });
        this.resizeObserver = new ResizeObserver(entries => {
            const rect = entries[0]?.contentRect;
            if (!rect)
                return;
            this.viewport.setSize(rect.width, rect.height);
            this.renderer.resize(rect.width, rect.height);
            this.scheduleRender();
        });
        this.resizeObserver.observe(options.container);
        this.scheduleRender();
    }
    // ── Undo / Redo ───────────────────────────────────────────────────────────────
    /** Capture current graph state for undo. Called before any mutation. */
    beforeMutation() {
        this.history.save({
            nodes: this.graph.getNodes().map(n => {
                const { style, ...rest } = n;
                return style ? { ...rest, style: { ...style } } : rest;
            }),
            edges: this.graph.getEdges().map(e => {
                const { style, ...rest } = e;
                return style ? { ...rest, style: { ...style } } : rest;
            }),
        });
    }
    applySnapshot(snap) {
        this.graph.clear();
        this.selectedIds.clear();
        this.selectedEdgeIds.clear();
        for (const n of snap.nodes)
            this.graph.addNode(n);
        for (const e of snap.edges)
            this.graph.addEdge(e);
        this.emit('selectionChange', { selectedIds: [], edgeIds: [] });
        this.scheduleRender();
    }
    /** Undo the last action. Returns true if successful. */
    undo() {
        if (this.failed)
            return false;
        const current = {
            nodes: this.graph.getNodes().map(n => { const { style, ...rest } = n; return style ? { ...rest, style: { ...style } } : rest; }),
            edges: this.graph.getEdges().map(e => { const { style, ...rest } = e; return style ? { ...rest, style: { ...style } } : rest; }),
        };
        const prev = this.history.undo(current);
        if (!prev)
            return false;
        this.applySnapshot(prev);
        return true;
    }
    /** Redo a previously undone action. Returns true if successful. */
    redo() {
        if (this.failed)
            return false;
        const current = {
            nodes: this.graph.getNodes().map(n => { const { style, ...rest } = n; return style ? { ...rest, style: { ...style } } : rest; }),
            edges: this.graph.getEdges().map(e => { const { style, ...rest } = e; return style ? { ...rest, style: { ...style } } : rest; }),
        };
        const next = this.history.redo(current);
        if (!next)
            return false;
        this.applySnapshot(next);
        return true;
    }
    canUndo() { return this.history.canUndo(); }
    canRedo() { return this.history.canRedo(); }
    // ── Serialization ─────────────────────────────────────────────────────────────
    /** Serialize the full chart state (nodes, edges, viewport). */
    toJSON() {
        return {
            version: 1,
            nodes: this.graph.getNodes().map(n => ({ ...n })),
            edges: this.graph.getEdges().map(e => ({ ...e })),
            viewport: this.viewport.getState(),
        };
    }
    /** Load a previously serialized chart state. Replaces current content. */
    fromJSON(data) {
        if (this.failed)
            return;
        this.history.clear();
        this.graph.clear();
        this.selectedIds.clear();
        this.selectedEdgeIds.clear();
        for (const n of data.nodes)
            this.graph.addNode(n);
        for (const e of data.edges)
            this.graph.addEdge(e);
        if (data.viewport)
            this.viewport.setState(data.viewport);
        this.emit('selectionChange', { selectedIds: [], edgeIds: [] });
        this.scheduleRender();
    }
    // ── Render ────────────────────────────────────────────────────────────────────
    scheduleRender() {
        if (this.failed || this.rafId !== null)
            return;
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.renderer.render(this.graph, this.viewport, this.selectedIds, this.connectState, this.selectedEdgeIds, this.bgColor, this.gridConfig.visible ? this.gridConfig : null, this.rerouteState, this.edgeReroute.getEndpointCircles());
        });
    }
    deleteSelected() {
        this.beforeMutation();
        for (const id of this.selectedEdgeIds)
            this.graph.removeEdge(id);
        this.selectedEdgeIds.clear();
        for (const id of this.selectedIds)
            this.graph.removeNode(id);
        this.selectedIds.clear();
        this.emit('selectionChange', { selectedIds: [], edgeIds: [] });
        this.scheduleRender();
    }
    // ── Node style API ────────────────────────────────────────────────────────────
    setNodeStyle(id, style) {
        const node = this.graph.getNode(id);
        if (!node)
            return;
        this.graph.updateNode(id, { style: { ...node.style, ...style } });
        this.scheduleRender();
    }
    setNodeBorderColor(id, color) { this.setNodeStyle(id, { borderColor: color }); }
    setNodeBackgroundColor(id, color) { this.setNodeStyle(id, { backgroundColor: color }); }
    setNodeSize(id, width, height) {
        this.graph.updateNode(id, { width, height });
        this.scheduleRender();
    }
    // ── Canvas appearance API ─────────────────────────────────────────────────────
    setBackground(color) {
        this.bgColor = color;
        this.scheduleRender();
    }
    setGrid(config) {
        this.gridConfig = { ...this.gridConfig, ...config };
        this.scheduleRender();
    }
    // ── Selection API ─────────────────────────────────────────────────────────────
    setLabelEditable(enabled) { this.labelEditable = enabled; }
    getSelectedIds() { return [...this.selectedIds]; }
    getSelectedEdgeIds() { return [...this.selectedEdgeIds]; }
    setSelectedIds(ids) {
        this.selectedIds = new Set(ids);
        this.scheduleRender();
    }
    clearSelection() {
        this.selectedIds.clear();
        this.selectedEdgeIds.clear();
        this.scheduleRender();
    }
    // ── Graph mutation API ────────────────────────────────────────────────────────
    addNode(node) {
        this.beforeMutation();
        this.graph.addNode(node);
        this.scheduleRender();
    }
    removeNode(id) {
        this.beforeMutation();
        this.graph.removeNode(id);
        this.selectedIds.delete(id);
        const remaining = new Set(this.graph.getEdges().map(e => e.id));
        for (const eid of this.selectedEdgeIds) {
            if (!remaining.has(eid))
                this.selectedEdgeIds.delete(eid);
        }
        this.scheduleRender();
    }
    updateNode(id, updates) {
        this.graph.updateNode(id, updates);
        this.scheduleRender();
    }
    addEdge(edge) {
        this.beforeMutation();
        this.graph.addEdge(edge);
        this.scheduleRender();
    }
    removeEdge(id) {
        this.beforeMutation();
        this.graph.removeEdge(id);
        this.selectedEdgeIds.delete(id);
        this.scheduleRender();
    }
    setNodes(nodes) {
        this.graph.clear();
        this.selectedIds.clear();
        this.selectedEdgeIds.clear();
        this.history.clear();
        for (const n of nodes)
            this.graph.addNode(n);
        this.scheduleRender();
    }
    setEdges(edges) {
        for (const e of this.graph.getEdges())
            this.graph.removeEdge(e.id);
        this.selectedEdgeIds.clear();
        for (const e of edges)
            this.graph.addEdge(e);
        this.scheduleRender();
    }
    // ── Viewport API ──────────────────────────────────────────────────────────────
    getViewport() { return this.viewport.getState(); }
    setViewport(state) {
        this.viewport.setState(state);
        this.scheduleRender();
    }
    fitView(padding = 40) {
        const nodes = this.graph.getNodes();
        if (nodes.length === 0)
            return;
        this.viewport.fit(computeNodeBounds(nodes), padding);
        this.scheduleRender();
    }
    // ── Lifecycle ─────────────────────────────────────────────────────────────────
    dispose() {
        if (this.rafId !== null)
            cancelAnimationFrame(this.rafId);
        if (!this.failed) {
            this.panZoom.dispose();
            this.drag.dispose();
            this.connectDrag.dispose();
            this.edgeReroute.dispose();
            this.boxSelect.dispose();
            this.keyboardHandler.dispose();
            this.renderer.dispose();
        }
        this.resizeObserver.disconnect();
        this.labelEditor.dispose();
        this.contextMenu.dispose();
        this.canvas.remove();
        super.dispose();
    }
}

let seq = 0;
function generateId(prefix = 'node') {
    return `${prefix}_${Date.now().toString(36)}_${(++seq).toString(36)}`;
}

export { BoxSelect, ContextMenu, DEFAULT_EDGE_STYLE, DEFAULT_GRID_CONFIG, DEFAULT_NODE_STYLE, EdgeHitTester, EdgeReroute, EventEmitter, FlowChart, Graph, History, KeyboardHandler, LabelEditor, MAX_ZOOM, MIN_ZOOM, Viewport, WebGL2Renderer, forceLayout, generateId, gridLayout, hierarchicalLayout };
//# sourceMappingURL=index.esm.js.map
