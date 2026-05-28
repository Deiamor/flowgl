import { createProgram } from '../context'
import { DynamicBuffer } from '../buffers/dynamic-buffer'
import { buildBezierStrip, edgeControlPoints, EDGE_FLOATS_PER_VERT, BEZIER_SEGMENTS } from '../util/bezier'
import type { EdgeData, EdgeStyle } from '../../../graph/edge'
import { DEFAULT_EDGE_STYLE } from '../../../graph/edge'
import type { NodeData } from '../../../graph/node'

const VERT = /* glsl */ `#version 300 es
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
`

const FRAG = /* glsl */ `#version 300 es
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
`

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
  const result: [number, number, number, number] = [d[0]! / 255, d[1]! / 255, d[2]! / 255, d[3]! / 255]
  cache.set(css, result)
  return result
}

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

export class EdgeProgram {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private vertexBuffer: DynamicBuffer
  private colorCache = new Map<string, [number, number, number, number]>()

  private uMatrix:  WebGLUniformLocation
  private uDashed:  WebGLUniformLocation
  private uDashLen: WebGLUniformLocation
  private uGapLen:  WebGLUniformLocation
  private scratch = new Float32Array(0)

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.program = createProgram(gl, VERT, FRAG)
    this.vertexBuffer = new DynamicBuffer(gl)

    const vao = gl.createVertexArray()
    if (!vao) throw new Error('EdgeProgram: createVertexArray failed')
    this.vao = vao

    const stride = EDGE_FLOATS_PER_VERT * 4
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer.buffer)
    const def = (name: string, size: number, offset: number): void => {
      const loc = gl.getAttribLocation(this.program, name)
      if (loc < 0) return
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4)
    }
    def('a_position', 2, 0)
    def('a_arcLen',   1, 2)
    def('a_color',    4, 3)
    gl.bindVertexArray(null)

    const u = (name: string): WebGLUniformLocation => {
      const loc = gl.getUniformLocation(this.program, name)
      if (!loc) throw new Error(`EdgeProgram: uniform '${name}' not found`)
      return loc
    }
    this.uMatrix  = u('u_matrix')
    this.uDashed  = u('u_dashed')
    this.uDashLen = u('u_dashLen')
    this.uGapLen  = u('u_gapLen')
  }

  render(
    edges: EdgeData[],
    nodeMap: Map<string, NodeData>,
    matrix: Float32Array,
    selectedEdgeIds: Set<string> = new Set(),
  ): void {
    if (edges.length === 0) return
    const gl = this.gl

    // Render selected edges last so they appear on top
    const sorted = [...edges].sort((a, b) =>
      (selectedEdgeIds.has(a.id) ? 1 : 0) - (selectedEdgeIds.has(b.id) ? 1 : 0),
    )

    const vertsPerEdge = (BEZIER_SEGMENTS + 1) * 2
    const needed = sorted.length * vertsPerEdge * EDGE_FLOATS_PER_VERT
    if (this.scratch.length < needed) this.scratch = new Float32Array(needed * 2)
    const combined = this.scratch
    let offset = 0
    const drawList: { edge: EdgeData; isSelected: boolean }[] = []

    for (const edge of sorted) {
      const src = nodeMap.get(edge.source)
      const tgt = nodeMap.get(edge.target)
      if (!src || !tgt) continue

      const isSelected = selectedEdgeIds.has(edge.id)
      const style: EdgeStyle = { ...DEFAULT_EDGE_STYLE, ...edge.style }
      let [r, g, b, a] = parseColor(style.color, this.colorCache)
      if (isSelected) { r = 0.102; g = 0.451; b = 0.910; a = 1.0 }
      const halfWidth = isSelected ? style.width * 0.75 : style.width / 2

      const [sx, sy] = handleXY(src, edge.sourceHandle ?? 'right')
      const [ex, ey] = handleXY(tgt, edge.targetHandle ?? 'left')
      const [c1x, c1y, c2x, c2y] = edgeControlPoints(
        sx, sy, edge.sourceHandle,
        ex, ey, edge.targetHandle,
      )
      const strip = buildBezierStrip(
        sx, sy, c1x, c1y, c2x, c2y, ex, ey,
        r, g, b, a, halfWidth,
      )
      combined.set(strip, offset)
      offset += strip.length
      drawList.push({ edge, isSelected })
    }

    if (drawList.length === 0) return

    this.vertexBuffer.upload(combined.subarray(0, offset))

    gl.useProgram(this.program)
    gl.uniformMatrix4fv(this.uMatrix, false, matrix)
    gl.bindVertexArray(this.vao)

    let vertOffset = 0
    for (const { edge, isSelected } of drawList) {
      const style: EdgeStyle = { ...DEFAULT_EDGE_STYLE, ...edge.style }
      if (!isSelected && style.dashArray) {
        gl.uniform1i(this.uDashed, 1)
        gl.uniform1f(this.uDashLen, style.dashArray[0] ?? 8)
        gl.uniform1f(this.uGapLen,  style.dashArray[1] ?? 4)
      } else {
        gl.uniform1i(this.uDashed, 0)
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, vertOffset, vertsPerEdge)
      vertOffset += vertsPerEdge
    }

    gl.bindVertexArray(null)
  }

  dispose(): void {
    this.gl.deleteProgram(this.program)
    this.gl.deleteVertexArray(this.vao)
    this.vertexBuffer.dispose()
  }
}
