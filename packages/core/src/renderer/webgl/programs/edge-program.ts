import { createProgram } from '../context'
import { DynamicBuffer } from '../buffers/dynamic-buffer'
import {
  buildBezierStrip, edgeControlPoints,
  buildStraightStrip, buildPolylineStrip, stepWaypoints, smoothStepWaypoints,
  EDGE_FLOATS_PER_VERT, BEZIER_SEGMENTS,
} from '../util/bezier'
import type { EdgeData, EdgeStyle } from '../../../graph/edge'
import { DEFAULT_EDGE_STYLE, DEFAULT_SMOOTHSTEP_BORDER_RADIUS, DEFAULT_SMOOTHSTEP_ARC_SEGMENTS } from '../../../graph/edge'
import type { NodeData } from '../../../graph/node'
import { handleXY } from '../util/handle-xy'

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
uniform float u_dashOffset;

out vec4 fragColor;

void main() {
  if (u_dashed) {
    float period = u_dashLen + u_gapLen;
    if (mod(v_arcLen - u_dashOffset, period) > u_dashLen) discard;
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

function edgeFingerprint(
  src: NodeData, tgt: NodeData, edge: EdgeData,
  styleColor: string, styleWidth: number, isSelected: boolean,
): string {
  const wpts = edge.waypoints ? edge.waypoints.map(w => `${w.x},${w.y}`).join(';') : ''
  const path = edge.pathOptions ? `${edge.pathOptions.borderRadius ?? ''},${edge.pathOptions.arcSegments ?? ''}` : ''
  return `${src.x}|${src.y}|${src.width}|${src.height}|${tgt.x}|${tgt.y}|${tgt.width}|${tgt.height}|${edge.sourceHandle ?? ''}|${edge.targetHandle ?? ''}|${edge.type ?? ''}|${styleColor}|${styleWidth}|${isSelected ? 1 : 0}|${edge.animated ? 1 : 0}|${wpts}|${path}`
}

// One GPU draw call covers a contiguous range of the combined VBO.
interface DrawBatch {
  vertStart: number
  vertCount: number
  dashed:    boolean
  dashLen:   number
  gapLen:    number
  animated:  boolean
}

export class EdgeProgram {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private vertexBuffer: DynamicBuffer
  private colorCache = new Map<string, [number, number, number, number]>()

  // Per-edge geometry cache.
  private stripCache = new Map<string, { strip: Float32Array; key: string }>()
  // Tracks the ordered edge IDs of the last uploaded combined buffer.
  private prevValidIds: string[] = []
  private prevCombinedFloats = 0
  // Batch descriptors reused every frame when buffer is not dirty.
  private drawBatches: DrawBatch[] = []
  // Reusable CPU-side assembly buffer.
  private scratch = new Float32Array(0)

  private uMatrix:     WebGLUniformLocation
  private uDashed:     WebGLUniformLocation
  private uDashLen:    WebGLUniformLocation
  private uGapLen:     WebGLUniformLocation
  private uDashOffset: WebGLUniformLocation

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
    this.uMatrix     = u('u_matrix')
    this.uDashed     = u('u_dashed')
    this.uDashLen    = u('u_dashLen')
    this.uGapLen     = u('u_gapLen')
    this.uDashOffset = u('u_dashOffset')
  }

  render(
    edges: EdgeData[],
    nodeMap: Map<string, NodeData>,
    matrix: Float32Array,
    selectedEdgeIds: Set<string> = new Set(),
    dashOffset = 0,
  ): void {
    if (edges.length === 0) {
      this.prevValidIds       = []
      this.prevCombinedFloats = 0
      this.drawBatches        = []
      return
    }
    const gl = this.gl
    const selSize = selectedEdgeIds.size

    // Selected edges drawn last so they appear on top.
    // Skip sort when nothing is selected — saves O(n log n) on static frames.
    const sorted = selSize === 0
      ? edges
      : [...edges].sort((a, b) =>
          (selectedEdgeIds.has(a.id) ? 1 : 0) - (selectedEdgeIds.has(b.id) ? 1 : 0),
        )

    const valid: EdgeData[] = []
    for (const e of sorted) {
      if (nodeMap.has(e.source) && nodeMap.has(e.target)) valid.push(e)
    }
    if (valid.length === 0) return

    // ── Step 1: fingerprint check (hot path — no style spread) ───────────
    // Access only the two properties needed for the fingerprint directly,
    // deferring the full style spread to cache-miss paths only.
    let dirty = false
    for (const edge of valid) {
      const src = nodeMap.get(edge.source)!
      const tgt = nodeMap.get(edge.target)!
      const isSelected = selectedEdgeIds.has(edge.id)
      const styleColor = edge.style?.color ?? DEFAULT_EDGE_STYLE.color
      const styleWidth = edge.style?.width ?? DEFAULT_EDGE_STYLE.width
      const fp = edgeFingerprint(src, tgt, edge, styleColor, styleWidth, isSelected)

      const cached = this.stripCache.get(edge.id)
      if (cached?.key === fp) continue

      const style: EdgeStyle = { ...DEFAULT_EDGE_STYLE, ...edge.style }
      let [r, g, b, a] = parseColor(style.color, this.colorCache)
      if (isSelected) { r = 0.102; g = 0.451; b = 0.910; a = 1.0 }
      const halfWidth = isSelected ? style.width * 0.75 : style.width / 2

      const [sx, sy] = handleXY(src, edge.sourceHandle ?? 'right')
      const [ex, ey] = handleXY(tgt, edge.targetHandle ?? 'left')

      let strip: Float32Array
      if (edge.waypoints && edge.waypoints.length > 0) {
        const pts: [number, number][] = [[sx, sy], ...edge.waypoints.map(w => [w.x, w.y] as [number, number]), [ex, ey]]
        strip = buildPolylineStrip(pts, r, g, b, a, halfWidth)
      } else if (edge.type === 'straight') {
        strip = buildStraightStrip(sx, sy, ex, ey, r, g, b, a, halfWidth)
      } else if (edge.type === 'step') {
        const pts = stepWaypoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle)
        strip = buildPolylineStrip(pts, r, g, b, a, halfWidth)
      } else if (edge.type === 'smoothstep') {
        const br = edge.pathOptions?.borderRadius ?? DEFAULT_SMOOTHSTEP_BORDER_RADIUS
        const seg = edge.pathOptions?.arcSegments ?? DEFAULT_SMOOTHSTEP_ARC_SEGMENTS
        const pts = smoothStepWaypoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle, br, seg)
        strip = buildPolylineStrip(pts, r, g, b, a, halfWidth)
      } else {
        const [c1x, c1y, c2x, c2y] = edgeControlPoints(
          sx, sy, edge.sourceHandle,
          ex, ey, edge.targetHandle,
        )
        strip = buildBezierStrip(sx, sy, c1x, c1y, c2x, c2y, ex, ey, r, g, b, a, halfWidth)
      }
      this.stripCache.set(edge.id, { strip, key: fp })
      dirty = true
    }

    // ── Step 2: detect whether combined buffer needs rebuilding ───────────
    let sortChanged = valid.length !== this.prevValidIds.length
    if (!sortChanged) {
      for (let i = 0; i < valid.length; i++) {
        if (valid[i]!.id !== this.prevValidIds[i]) { sortChanged = true; break }
      }
    }
    const needsUpload = dirty || sortChanged

    // ── Step 3: build groups and assemble — only when buffer is stale ─────
    // Group building (style spread + Map ops × N) is deferred to avoid
    // per-frame overhead on static scenes.
    if (needsUpload) {
      interface EdgeGroup {
        edges:    EdgeData[]
        dashed:   boolean
        dashLen:  number
        gapLen:   number
        animated: boolean
      }
      const groups: EdgeGroup[] = []
      const groupIndex = new Map<string, number>()

      for (const edge of valid) {
        const isSelected = selectedEdgeIds.has(edge.id)
        const style: EdgeStyle = { ...DEFAULT_EDGE_STYLE, ...edge.style }
        const animated = !!edge.animated
        const dashed   = animated || (!isSelected && !!style.dashArray)
        const dashLen  = dashed ? (style.dashArray?.[0] ?? 8) : 8
        const gapLen   = dashed ? (style.dashArray?.[1] ?? 4) : 4
        // Animated edges get a separate batch (prefixed with 'a:') so dashOffset
        // applies only to them, not to ordinary dashed edges.
        const dashKey  = animated ? `a:${dashLen},${gapLen}` : (dashed ? `${dashLen},${gapLen}` : '')
        if (!groupIndex.has(dashKey)) {
          groupIndex.set(dashKey, groups.length)
          groups.push({ edges: [], dashed, dashLen, gapLen, animated })
        }
        groups[groupIndex.get(dashKey)!]!.edges.push(edge)
      }

      // Compute exact buffer size from actual strip lengths (varies by edge type)
      let totalFloats = 0
      for (const g of groups) {
        for (const edge of g.edges) {
          totalFloats += this.stripCache.get(edge.id)!.strip.length
        }
        if (g.edges.length > 1) totalFloats += (g.edges.length - 1) * 2 * EDGE_FLOATS_PER_VERT
      }

      if (this.scratch.length < totalFloats) this.scratch = new Float32Array(totalFloats * 2)

      const newBatches: DrawBatch[] = []
      let elemOff = 0
      let vertOff = 0

      for (const group of groups) {
        const batchVertStart = vertOff

        for (let i = 0; i < group.edges.length; i++) {
          const strip = this.stripCache.get(group.edges[i]!.id)!.strip
          this.scratch.set(strip, elemOff)
          elemOff += strip.length
          vertOff += strip.length / EDGE_FLOATS_PER_VERT

          if (i < group.edges.length - 1) {
            // Degenerate stitch: repeat last vertex of this strip,
            // then first vertex of the next strip.
            this.scratch.set(strip.subarray(strip.length - EDGE_FLOATS_PER_VERT), elemOff)
            elemOff += EDGE_FLOATS_PER_VERT
            const nextStrip = this.stripCache.get(group.edges[i + 1]!.id)!.strip
            this.scratch.set(nextStrip.subarray(0, EDGE_FLOATS_PER_VERT), elemOff)
            elemOff += EDGE_FLOATS_PER_VERT
            vertOff += 2
          }
        }

        newBatches.push({
          vertStart: batchVertStart,
          vertCount: vertOff - batchVertStart,
          dashed:   group.dashed,
          dashLen:  group.dashLen,
          gapLen:   group.gapLen,
          animated: group.animated,
        })
      }

      this.vertexBuffer.upload(this.scratch.subarray(0, totalFloats))
      this.prevValidIds       = valid.map(e => e.id)
      this.prevCombinedFloats = totalFloats
      this.drawBatches        = newBatches
    }
    // When !needsUpload the GPU buffer is current; only the view matrix changes.

    // ── Step 5: evict stale cache entries ─────────────────────────────────
    if (this.stripCache.size > valid.length) {
      const currentIds = new Set(valid.map(e => e.id))
      for (const id of this.stripCache.keys()) {
        if (!currentIds.has(id)) this.stripCache.delete(id)
      }
    }

    // ── Step 6: draw — one call per dash-config group ─────────────────────
    gl.useProgram(this.program)
    gl.uniformMatrix4fv(this.uMatrix, false, matrix)
    gl.bindVertexArray(this.vao)

    for (const batch of this.drawBatches) {
      gl.uniform1i(this.uDashed, batch.dashed ? 1 : 0)
      if (batch.dashed) {
        gl.uniform1f(this.uDashLen,    batch.dashLen)
        gl.uniform1f(this.uGapLen,     batch.gapLen)
        gl.uniform1f(this.uDashOffset, batch.animated ? dashOffset : 0.0)
      } else {
        gl.uniform1f(this.uDashOffset, 0.0)
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, batch.vertStart, batch.vertCount)
    }

    gl.bindVertexArray(null)
  }

  dispose(): void {
    this.stripCache.clear()
    this.gl.deleteProgram(this.program)
    this.gl.deleteVertexArray(this.vao)
    this.vertexBuffer.dispose()
  }
}
