import { createProgram } from '../context'
import { DynamicBuffer } from '../buffers/dynamic-buffer'
import { parseColor } from '../util/color'
import type { NodeData, NodeStyle } from '../../../graph/node'
import { DEFAULT_NODE_STYLE } from '../../../graph/node'

// Per-instance (15 floats):
// [0-1]  center (cx, cy)
// [2-3]  size (w, h)
// [4-7]  fill (r,g,b,a)
// [8-11] border (r,g,b,a)
// [12]   border width
// [13]   border radius
// [14]   state  0=normal  0.5=connection-target  1=selected
const FLOATS_PER_INSTANCE = 15

const VERT = /* glsl */ `#version 300 es
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
`

const FRAG = /* glsl */ `#version 300 es
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
`

export class NodeProgram {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private quadBuffer: WebGLBuffer
  private instanceBuffer: DynamicBuffer
  private uMatrix: WebGLUniformLocation
  private scratch = new Float32Array(0)

  // Instance-buffer cache: skip rebuild when nodes/selection/target are unchanged
  private prevNodes: NodeData[] | null = null
  private prevSelectedSize = -1
  private prevSelectedJoined = ''
  private prevTargetNodeId: string | null = null
  private prevInstanceCount = 0

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.program = createProgram(gl, VERT, FRAG)
    this.instanceBuffer = new DynamicBuffer(gl)

    const vao = gl.createVertexArray()
    if (!vao) throw new Error('NodeProgram: createVertexArray failed')
    this.vao = vao

    const quadBuf = gl.createBuffer()
    if (!quadBuf) throw new Error('NodeProgram: createBuffer failed')
    this.quadBuffer = quadBuf

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -0.5, -0.5,  0.5, -0.5,  0.5,  0.5,
      -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,
    ]), gl.STATIC_DRAW)

    gl.bindVertexArray(this.vao)
    const quadLoc = gl.getAttribLocation(this.program, 'a_quad')
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
    gl.enableVertexAttribArray(quadLoc)
    gl.vertexAttribPointer(quadLoc, 2, gl.FLOAT, false, 0, 0)

    const stride = FLOATS_PER_INSTANCE * 4
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer.buffer)
    const def = (name: string, size: number, offset: number): void => {
      const loc = gl.getAttribLocation(this.program, name)
      if (loc < 0) return
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4)
      gl.vertexAttribDivisor(loc, 1)
    }
    def('a_offset',      2,  0)
    def('a_size',        2,  2)
    def('a_fill',        4,  4)
    def('a_stroke',      4,  8)
    def('a_strokeWidth', 1, 12)
    def('a_radius',      1, 13)
    def('a_state',       1, 14)
    gl.bindVertexArray(null)

    const matLoc = gl.getUniformLocation(this.program, 'u_matrix')
    if (!matLoc) throw new Error('NodeProgram: u_matrix not found')
    this.uMatrix = matLoc
  }

  render(
    nodes: NodeData[],
    matrix: Float32Array,
    selectedIds: Set<string>,
    targetNodeId: string | null,
  ): void {
    if (nodes.length === 0) return
    const gl = this.gl

    // Fast path: rebuild instance buffer only when data actually changed.
    // selectedIds is a mutated Set, so compare size + sorted-joined for correctness.
    const selSize   = selectedIds.size
    const selJoined = selSize === 0 ? '' : [...selectedIds].sort().join(',')
    const dataChanged = (
      nodes !== this.prevNodes          ||
      nodes.length !== this.prevInstanceCount ||
      selSize   !== this.prevSelectedSize   ||
      selJoined !== this.prevSelectedJoined ||
      targetNodeId !== this.prevTargetNodeId
    )

    if (dataChanged) {
      const needed = nodes.length * FLOATS_PER_INSTANCE
      if (this.scratch.length < needed) this.scratch = new Float32Array(needed * 2)
      const data = this.scratch
      let i = 0
      for (const node of nodes) {
        const style: NodeStyle = { ...DEFAULT_NODE_STYLE, ...node.style }
        const [fr, fg, fb, fa] = parseColor(style.backgroundColor)
        const [sr, sg, sb, sa] = parseColor(style.borderColor)

        let state = 0
        if (selectedIds.has(node.id))      state = 1
        else if (node.id === targetNodeId)  state = 0.5

        data[i++] = node.x + node.width  / 2
        data[i++] = node.y + node.height / 2
        data[i++] = node.width
        data[i++] = node.height
        data[i++] = fr; data[i++] = fg; data[i++] = fb; data[i++] = fa
        data[i++] = sr; data[i++] = sg; data[i++] = sb; data[i++] = sa
        data[i++] = style.borderWidth
        data[i++] = style.borderRadius
        data[i++] = state
      }
      this.instanceBuffer.upload(data.subarray(0, needed))
      this.prevNodes         = nodes
      this.prevInstanceCount = nodes.length
      this.prevSelectedSize  = selSize
      this.prevSelectedJoined = selJoined
      this.prevTargetNodeId  = targetNodeId
    }

    gl.useProgram(this.program)
    gl.uniformMatrix4fv(this.uMatrix, false, matrix)
    gl.bindVertexArray(this.vao)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nodes.length)
    gl.bindVertexArray(null)
  }

  dispose(): void {
    const gl = this.gl
    gl.deleteProgram(this.program)
    gl.deleteVertexArray(this.vao)
    gl.deleteBuffer(this.quadBuffer)
    this.instanceBuffer.dispose()
  }
}
