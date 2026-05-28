import { createProgram } from '../context';
import { DynamicBuffer } from '../buffers/dynamic-buffer';
import { DEFAULT_NODE_STYLE } from '../../../graph/node';
// Per-vertex: position(2) + uv(2) = 4 floats
const FLOATS_PER_VERT = 4;
const VERT = /* glsl */ `#version 300 es
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
const FRAG = /* glsl */ `#version 300 es
precision mediump float;

in vec2 v_uv;

uniform sampler2D u_atlas;

out vec4 fragColor;

void main() {
  fragColor = texture(u_atlas, v_uv);
}
`;
export class TextProgram {
    constructor(gl, atlas) {
        this.gl = gl;
        this.atlas = atlas;
        this.program = createProgram(gl, VERT, FRAG);
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
//# sourceMappingURL=text-program.js.map