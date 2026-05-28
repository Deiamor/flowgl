import { createProgram } from '../context';
import { DynamicBuffer } from '../buffers/dynamic-buffer';
import { buildBezierStrip, edgeControlPoints, EDGE_FLOATS_PER_VERT } from '../util/bezier';
import { parseColor } from '../util/color';
import { getHandlePositions } from '../../../interaction/connect';
import { DEFAULT_NODE_STYLE } from '../../../graph/node';
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
export class HandleProgram {
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
            const [r, g, b, a] = parseColor(style.borderColor);
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
        const [r, g, b] = parseColor(style.borderColor);
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
//# sourceMappingURL=handle-program.js.map