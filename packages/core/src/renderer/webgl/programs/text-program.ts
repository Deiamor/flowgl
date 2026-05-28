import { createProgram } from '../context'
import { DynamicBuffer } from '../buffers/dynamic-buffer'
import { edgeControlPoints, cubicBezierPoint } from '../util/bezier'
import type { TextAtlas } from '../atlas/text-atlas'
import type { NodeData, NodeStyle } from '../../../graph/node'
import { DEFAULT_NODE_STYLE } from '../../../graph/node'
import type { EdgeData } from '../../../graph/edge'

// Per-vertex: position(2) + uv(2) = 4 floats
const FLOATS_PER_VERT = 4
const TEXT_PADDING = 8
const EDGE_LABEL_FONT = '12px system-ui, sans-serif'
const EDGE_LABEL_COLOR = '#374151'
const EDGE_LABEL_BG = 'rgba(255,255,255,0.92)'

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
`

const FRAG = /* glsl */ `#version 300 es
precision mediump float;

in vec2 v_uv;

uniform sampler2D u_atlas;

out vec4 fragColor;

void main() {
  fragColor = texture(u_atlas, v_uv);
}
`

function handleXY(node: NodeData, side: string | undefined): [number, number] {
  const cx = node.x + node.width  / 2
  const cy = node.y + node.height / 2
  switch (side) {
    case 'top':    return [cx, node.y]
    case 'bottom': return [cx, node.y + node.height]
    case 'left':   return [node.x, cy]
    case 'right':  return [node.x + node.width, cy]
    default:       return [node.x + node.width, cy]
  }
}

function writeQuad(
  data: Float32Array,
  cursor: number,
  x0: number, y0: number, x1: number, y1: number,
  u0: number, v0: number, u1: number, v1: number,
): number {
  data[cursor++] = x0; data[cursor++] = y0; data[cursor++] = u0; data[cursor++] = v0
  data[cursor++] = x1; data[cursor++] = y0; data[cursor++] = u1; data[cursor++] = v0
  data[cursor++] = x1; data[cursor++] = y1; data[cursor++] = u1; data[cursor++] = v1
  data[cursor++] = x0; data[cursor++] = y0; data[cursor++] = u0; data[cursor++] = v0
  data[cursor++] = x1; data[cursor++] = y1; data[cursor++] = u1; data[cursor++] = v1
  data[cursor++] = x0; data[cursor++] = y1; data[cursor++] = u0; data[cursor++] = v1
  return cursor
}

export class TextProgram {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private vertexBuffer: DynamicBuffer
  private atlas: TextAtlas

  private uMatrix: WebGLUniformLocation
  private uAtlas: WebGLUniformLocation

  constructor(gl: WebGL2RenderingContext, atlas: TextAtlas) {
    this.gl = gl
    this.atlas = atlas
    this.program = createProgram(gl, VERT, FRAG)
    this.vertexBuffer = new DynamicBuffer(gl)

    const vao = gl.createVertexArray()
    if (!vao) throw new Error('TextProgram: createVertexArray failed')
    this.vao = vao

    const stride = FLOATS_PER_VERT * 4
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer.buffer)

    const def = (name: string, size: number, offset: number): void => {
      const loc = gl.getAttribLocation(this.program, name)
      if (loc < 0) return
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4)
    }
    def('a_position', 2, 0)
    def('a_uv',       2, 2)

    gl.bindVertexArray(null)

    const u = (name: string): WebGLUniformLocation => {
      const loc = gl.getUniformLocation(this.program, name)
      if (!loc) throw new Error(`TextProgram: uniform '${name}' not found`)
      return loc
    }
    this.uMatrix = u('u_matrix')
    this.uAtlas  = u('u_atlas')
  }

  render(nodes: NodeData[], matrix: Float32Array): void {
    if (nodes.length === 0) return
    const gl = this.gl

    // Pass 1: pre-warm atlas for all visible nodes — prevents mid-iteration eviction
    for (const node of nodes) {
      if (!node.label) continue
      const style: NodeStyle = { ...DEFAULT_NODE_STYLE, ...node.style }
      const font = `${style.fontSize}px ${style.fontFamily}`
      const maxWidth = Math.max(0, node.width - TEXT_PADDING * 2)
      this.atlas.getOrCreate(node.label, font, style.textColor, maxWidth, style.lineHeight)
    }

    // Pass 2: generate vertex data from stable atlas state
    const data = new Float32Array(nodes.length * 6 * FLOATS_PER_VERT)
    let cursor = 0
    let drawCount = 0

    for (const node of nodes) {
      if (!node.label) continue
      const style: NodeStyle = { ...DEFAULT_NODE_STYLE, ...node.style }
      const font = `${style.fontSize}px ${style.fontFamily}`
      const maxWidth = Math.max(0, node.width - TEXT_PADDING * 2)
      const entry = this.atlas.getOrCreate(node.label, font, style.textColor, maxWidth, style.lineHeight)
      if (!entry) continue

      const cx = node.x + node.width  / 2
      const cy = node.y + node.height / 2
      const hw = entry.w / 2
      const hh = entry.h / 2

      cursor = writeQuad(data, cursor, cx - hw, cy - hh, cx + hw, cy + hh, entry.u0, entry.v0, entry.u1, entry.v1)
      drawCount += 6
    }

    if (drawCount === 0) return

    this.atlas.flush(gl)
    this.vertexBuffer.upload(data.subarray(0, cursor))

    gl.useProgram(this.program)
    gl.uniformMatrix4fv(this.uMatrix, false, matrix)
    gl.uniform1i(this.uAtlas, 0)
    this.atlas.bind(gl, 0)
    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.TRIANGLES, 0, drawCount)
    gl.bindVertexArray(null)
  }

  renderEdgeLabels(edges: EdgeData[], nodeMap: Map<string, NodeData>, matrix: Float32Array): void {
    const labeled = edges.filter(e => e.label)
    if (labeled.length === 0) return
    const gl = this.gl

    // Pass 1: pre-warm atlas
    for (const edge of labeled) {
      this.atlas.getOrCreate(edge.label!, EDGE_LABEL_FONT, EDGE_LABEL_COLOR, 0, 1.0, EDGE_LABEL_BG)
    }

    // Pass 2: generate vertex data
    const data = new Float32Array(labeled.length * 6 * FLOATS_PER_VERT)
    let cursor = 0
    let drawCount = 0

    for (const edge of labeled) {
      if (!edge.label) continue
      const src = nodeMap.get(edge.source)
      const tgt = nodeMap.get(edge.target)
      if (!src || !tgt) continue

      const [sx, sy] = handleXY(src, edge.sourceHandle)
      const [ex, ey] = handleXY(tgt, edge.targetHandle)
      const [c1x, c1y, c2x, c2y] = edgeControlPoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle)
      const [mx, my] = cubicBezierPoint(0.5, sx, sy, c1x, c1y, c2x, c2y, ex, ey)

      const entry = this.atlas.getOrCreate(edge.label, EDGE_LABEL_FONT, EDGE_LABEL_COLOR, 0, 1.0, EDGE_LABEL_BG)
      if (!entry) continue

      const hw = entry.w / 2
      const hh = entry.h / 2
      cursor = writeQuad(data, cursor, mx - hw, my - hh, mx + hw, my + hh, entry.u0, entry.v0, entry.u1, entry.v1)
      drawCount += 6
    }

    if (drawCount === 0) return

    this.atlas.flush(gl)
    this.vertexBuffer.upload(data.subarray(0, cursor))

    gl.useProgram(this.program)
    gl.uniformMatrix4fv(this.uMatrix, false, matrix)
    gl.uniform1i(this.uAtlas, 0)
    this.atlas.bind(gl, 0)
    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.TRIANGLES, 0, drawCount)
    gl.bindVertexArray(null)
  }

  dispose(): void {
    this.gl.deleteProgram(this.program)
    this.gl.deleteVertexArray(this.vao)
    this.vertexBuffer.dispose()
  }
}
