import { createProgram } from '../context'
import { DynamicBuffer } from '../buffers/dynamic-buffer'
import { edgeControlPoints, cubicBezierPoint } from '../util/bezier'
import type { TextAtlas } from '../atlas/text-atlas'
import type { NodeData, NodeStyle } from '../../../graph/node'
import { DEFAULT_NODE_STYLE } from '../../../graph/node'
import type { EdgeData } from '../../../graph/edge'
import { handleXY } from '../util/handle-xy'

// Per-vertex: position(2) + uv(2) = 4 floats
const FLOATS_PER_VERT = 4
const FLOATS_PER_QUAD = 6 * FLOATS_PER_VERT
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

  // Per-node quad cache
  private quadCache = new Map<string, { quad: Float32Array; key: string }>()
  private prevNodeIds: string[] = []
  private prevAtlasGeneration = -1
  private scratch = new Float32Array(0)
  private prevNodeDrawCount = 0
  // Reference-equality fast path: if nodeRef === stored ref, data hasn't changed
  private nodeRefCache = new Map<string, NodeData>()

  // Per-edge-label quad cache
  private edgeLabelCache = new Map<string, { quad: Float32Array; key: string }>()
  private prevLabeledEdgeIds: string[] = []
  private prevLabelAtlasGeneration = -1
  private labelScratch = new Float32Array(0)

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

  render(nodes: NodeData[], matrix: Float32Array, zoom: number): void {
    if (nodes.length === 0 || zoom < 0.12) return
    const gl = this.gl

    const gen = this.atlas.generation

    // On atlas eviction all cached UVs are stale — discard.
    if (gen !== this.prevAtlasGeneration) {
      this.quadCache.clear()
      this.nodeRefCache.clear()
      this.prevAtlasGeneration = gen
    }

    // Step 1: find nodes whose quads need rebuilding.
    // Uses NodeData reference equality first (O(1), no string alloc) before
    // falling back to full fingerprint comparison.
    const dirtyNodes: NodeData[] = []
    for (const node of nodes) {
      if (!node.label) continue
      if (this.nodeRefCache.get(node.id) === node && this.quadCache.has(node.id)) continue

      // Ref changed or first time — check fingerprint before rebuilding
      const fontSize   = node.style?.fontSize   ?? DEFAULT_NODE_STYLE.fontSize
      const fontFamily = node.style?.fontFamily  ?? DEFAULT_NODE_STYLE.fontFamily
      const textColor  = node.style?.textColor   ?? DEFAULT_NODE_STYLE.textColor
      const lineHeight = node.style?.lineHeight  ?? DEFAULT_NODE_STYLE.lineHeight
      const font = `${fontSize}px ${fontFamily}`
      const fp = `${node.x}|${node.y}|${node.width}|${node.height}|${node.label}|${font}|${textColor}|${lineHeight}`
      if (this.quadCache.get(node.id)?.key === fp) {
        this.nodeRefCache.set(node.id, node)
        continue
      }
      dirtyNodes.push(node)
    }

    const labeled = nodes.filter(n => n.label)
    let sortChanged = labeled.length !== this.prevNodeIds.length
    if (!sortChanged) {
      for (let i = 0; i < labeled.length; i++) {
        if (labeled[i]!.id !== this.prevNodeIds[i]) { sortChanged = true; break }
      }
    }
    const needsUpload = dirtyNodes.length > 0 || sortChanged

    if (needsUpload) {
      // Pass 1: pre-warm atlas for ALL labeled nodes before computing any quads —
      // prevents mid-loop atlas eviction from invalidating earlier entries.
      for (const node of labeled) {
        const fontSize   = node.style?.fontSize   ?? DEFAULT_NODE_STYLE.fontSize
        const fontFamily = node.style?.fontFamily  ?? DEFAULT_NODE_STYLE.fontFamily
        const textColor  = node.style?.textColor   ?? DEFAULT_NODE_STYLE.textColor
        const lineHeight = node.style?.lineHeight  ?? DEFAULT_NODE_STYLE.lineHeight
        const maxWidth   = Math.max(0, node.width - TEXT_PADDING * 2)
        const font = `${fontSize}px ${fontFamily}`
        this.atlas.getOrCreate(node.label!, font, textColor, maxWidth, lineHeight)
      }

      // Pass 2: build quads only for dirty nodes
      for (const node of dirtyNodes) {
        const fontSize   = node.style?.fontSize   ?? DEFAULT_NODE_STYLE.fontSize
        const fontFamily = node.style?.fontFamily  ?? DEFAULT_NODE_STYLE.fontFamily
        const textColor  = node.style?.textColor   ?? DEFAULT_NODE_STYLE.textColor
        const lineHeight = node.style?.lineHeight  ?? DEFAULT_NODE_STYLE.lineHeight
        const maxWidth   = Math.max(0, node.width - TEXT_PADDING * 2)
        const font = `${fontSize}px ${fontFamily}`
        const fp = `${node.x}|${node.y}|${node.width}|${node.height}|${node.label!}|${font}|${textColor}|${lineHeight}`
        const entry = this.atlas.getOrCreate(node.label!, font, textColor, maxWidth, lineHeight)
        if (!entry) continue

        const cx = node.x + node.width  / 2
        const cy = node.y + node.height / 2
        const quad = new Float32Array(FLOATS_PER_QUAD)
        writeQuad(quad, 0, cx - entry.w / 2, cy - entry.h / 2, cx + entry.w / 2, cy + entry.h / 2, entry.u0, entry.v0, entry.u1, entry.v1)
        this.quadCache.set(node.id, { quad, key: fp })
        this.nodeRefCache.set(node.id, node)
      }

      // Assemble combined buffer from cache
      let drawCount = 0
      const totalFloats = labeled.length * FLOATS_PER_QUAD
      if (this.scratch.length < totalFloats) this.scratch = new Float32Array(totalFloats * 2)
      let offset = 0
      for (const node of labeled) {
        const cached = this.quadCache.get(node.id)
        if (!cached) continue
        this.scratch.set(cached.quad, offset)
        offset += FLOATS_PER_QUAD
        drawCount += 6
      }
      this.vertexBuffer.upload(this.scratch.subarray(0, offset))
      this.prevNodeIds = labeled.map(n => n.id)
      this.prevNodeDrawCount = drawCount

      // Evict stale cache entries
      if (this.quadCache.size > labeled.length) {
        const currentIds = new Set(labeled.map(n => n.id))
        for (const id of this.quadCache.keys()) {
          if (!currentIds.has(id)) {
            this.quadCache.delete(id)
            this.nodeRefCache.delete(id)
          }
        }
      }

      if (drawCount === 0) return
    } else if (labeled.length === 0) {
      return
    }

    if (this.prevNodeDrawCount === 0) return

    this.atlas.flush(gl)
    gl.useProgram(this.program)
    gl.uniformMatrix4fv(this.uMatrix, false, matrix)
    gl.uniform1i(this.uAtlas, 0)
    this.atlas.bind(gl, 0)
    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.TRIANGLES, 0, this.prevNodeDrawCount)
    gl.bindVertexArray(null)
  }

  renderEdgeLabels(edges: EdgeData[], nodeMap: Map<string, NodeData>, matrix: Float32Array, zoom: number): void {
    const labeled = edges.filter(e => e.label)
    if (labeled.length === 0 || zoom < 0.12) return
    const gl = this.gl

    // Pass 1: pre-warm atlas
    for (const edge of labeled) {
      this.atlas.getOrCreate(edge.label!, EDGE_LABEL_FONT, EDGE_LABEL_COLOR, 0, 1.0, EDGE_LABEL_BG)
    }

    const gen = this.atlas.generation

    if (gen !== this.prevLabelAtlasGeneration) {
      this.edgeLabelCache.clear()
      this.prevLabelAtlasGeneration = gen
    }

    // Pass 2: fingerprint check; recompute only on cache miss
    let dirty = false
    for (const edge of labeled) {
      if (!edge.label) continue
      const src = nodeMap.get(edge.source)
      const tgt = nodeMap.get(edge.target)
      if (!src || !tgt) continue

      const fp = `${src.x}|${src.y}|${src.width}|${src.height}|${tgt.x}|${tgt.y}|${tgt.width}|${tgt.height}|${edge.sourceHandle ?? ''}|${edge.targetHandle ?? ''}|${edge.label}`
      const cached = this.edgeLabelCache.get(edge.id)
      if (cached?.key === fp) continue

      const [sx, sy] = handleXY(src, edge.sourceHandle)
      const [ex, ey] = handleXY(tgt, edge.targetHandle)
      const [c1x, c1y, c2x, c2y] = edgeControlPoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle)
      const [mx, my] = cubicBezierPoint(0.5, sx, sy, c1x, c1y, c2x, c2y, ex, ey)

      const entry = this.atlas.getOrCreate(edge.label, EDGE_LABEL_FONT, EDGE_LABEL_COLOR, 0, 1.0, EDGE_LABEL_BG)
      if (!entry) continue

      const hw = entry.w / 2
      const hh = entry.h / 2
      const quad = new Float32Array(FLOATS_PER_QUAD)
      writeQuad(quad, 0, mx - hw, my - hh, mx + hw, my + hh, entry.u0, entry.v0, entry.u1, entry.v1)
      this.edgeLabelCache.set(edge.id, { quad, key: fp })
      dirty = true
    }

    let sortChanged = labeled.length !== this.prevLabeledEdgeIds.length
    if (!sortChanged) {
      for (let i = 0; i < labeled.length; i++) {
        if (labeled[i]!.id !== this.prevLabeledEdgeIds[i]) { sortChanged = true; break }
      }
    }
    const needsUpload = dirty || sortChanged

    let drawCount = labeled.length * 6

    if (needsUpload) {
      const totalFloats = labeled.length * FLOATS_PER_QUAD
      if (this.labelScratch.length < totalFloats) this.labelScratch = new Float32Array(totalFloats * 2)
      let offset = 0
      for (const edge of labeled) {
        const cached = this.edgeLabelCache.get(edge.id)
        if (!cached) { drawCount -= 6; continue }
        this.labelScratch.set(cached.quad, offset)
        offset += FLOATS_PER_QUAD
      }
      this.vertexBuffer.upload(this.labelScratch.subarray(0, offset))
      this.prevLabeledEdgeIds = labeled.map(e => e.id)
    }

    if (this.edgeLabelCache.size > labeled.length) {
      const currentIds = new Set(labeled.map(e => e.id))
      for (const id of this.edgeLabelCache.keys()) {
        if (!currentIds.has(id)) this.edgeLabelCache.delete(id)
      }
    }

    if (drawCount === 0) return

    this.atlas.flush(gl)
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
