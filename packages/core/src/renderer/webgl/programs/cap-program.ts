import { createProgram } from '../context'
import { DynamicBuffer } from '../buffers/dynamic-buffer'
import type { EdgeData, EdgeStyle } from '../../../graph/edge'
import { DEFAULT_EDGE_STYLE } from '../../../graph/edge'
import type { NodeData } from '../../../graph/node'
import { handleXY } from '../util/handle-xy'

const VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2  a_pos;
in vec4  a_color;
in float a_size;
uniform mat4 u_matrix;
out vec4 v_color;
void main() {
  v_color      = a_color;
  gl_Position  = u_matrix * vec4(a_pos, 0.0, 1.0);
  gl_PointSize = a_size;
}`

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;
  fragColor = v_color;
}`

const FLOATS = 7  // x, y, r, g, b, a, size

function parseColor(
  css: string,
  cache: Map<string, [number, number, number, number]>,
): [number, number, number, number] {
  const hit = cache.get(css)
  if (hit) return hit
  const el = document.createElement('canvas')
  el.width = el.height = 1
  const ctx = el.getContext('2d')!
  ctx.fillStyle = css
  ctx.fillRect(0, 0, 1, 1)
  const d = ctx.getImageData(0, 0, 1, 1).data
  const v: [number, number, number, number] = [d[0]! / 255, d[1]! / 255, d[2]! / 255, d[3]! / 255]
  cache.set(css, v)
  return v
}


export class CapProgram {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private buf: DynamicBuffer
  private uMatrix: WebGLUniformLocation
  private colorCache = new Map<string, [number, number, number, number]>()

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.program = createProgram(gl, VERT, FRAG)
    this.buf = new DynamicBuffer(gl)

    const vao = gl.createVertexArray()
    if (!vao) throw new Error('CapProgram: createVertexArray failed')
    this.vao = vao

    const stride = FLOATS * 4
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer)
    const def = (name: string, n: number, off: number): void => {
      const loc = gl.getAttribLocation(this.program, name)
      if (loc < 0) return
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride, off * 4)
    }
    def('a_pos',   2, 0)
    def('a_color', 4, 2)
    def('a_size',  1, 6)
    gl.bindVertexArray(null)

    this.uMatrix = gl.getUniformLocation(this.program, 'u_matrix')!
  }

  // pixelsPerUnit = viewport.zoom * dpr — converts graph units to physical pixels
  render(
    edges:           EdgeData[],
    nodeMap:         Map<string, NodeData>,
    matrix:          Float32Array,
    selectedEdgeIds: Set<string>,
    pixelsPerUnit:   number,
  ): void {
    const raw: number[] = []

    for (const edge of edges) {
      const src = nodeMap.get(edge.source)
      const tgt = nodeMap.get(edge.target)
      if (!src || !tgt) continue

      const isSelected = selectedEdgeIds.has(edge.id)
      const style: EdgeStyle = { ...DEFAULT_EDGE_STYLE, ...edge.style }
      let [r, g, b, a] = parseColor(style.color, this.colorCache)
      if (isSelected) { r = 0.102; g = 0.451; b = 0.910; a = 1.0 }

      const halfW = isSelected ? style.width * 0.75 : style.width / 2
      const sz = halfW * 2 * pixelsPerUnit
      if (sz < 3) continue  // thin edges — flat cap invisible, skip to save draw calls

      const [sx, sy] = handleXY(src, edge.sourceHandle ?? 'right')
      const [ex, ey] = handleXY(tgt, edge.targetHandle ?? 'left')

      raw.push(sx, sy, r, g, b, a, sz)
      raw.push(ex, ey, r, g, b, a, sz)
    }

    if (!raw.length) return

    const gl = this.gl
    this.buf.upload(new Float32Array(raw))
    gl.useProgram(this.program)
    gl.uniformMatrix4fv(this.uMatrix, false, matrix)
    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.POINTS, 0, raw.length / FLOATS)
    gl.bindVertexArray(null)
  }

  dispose(): void {
    const gl = this.gl
    gl.deleteProgram(this.program)
    gl.deleteVertexArray(this.vao)
    this.buf.dispose()
  }
}
