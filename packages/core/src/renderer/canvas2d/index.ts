import type { Renderer, RendererOptions, RenderFrame } from '../interface'
import type { Graph } from '../../graph/graph'
import type { NodeData } from '../../graph/node'
import type { EdgeData } from '../../graph/edge'
import type { Viewport } from '../../viewport/viewport'
import { DEFAULT_NODE_STYLE } from '../../graph/node'
import { DEFAULT_EDGE_STYLE, DEFAULT_SMOOTHSTEP_BORDER_RADIUS, DEFAULT_SMOOTHSTEP_ARC_SEGMENTS } from '../../graph/edge'
import { handleXY } from '../webgl/util/handle-xy'
import { edgeControlPoints, cubicBezierPoint, stepWaypoints, smoothStepWaypoints } from '../webgl/util/bezier'
import { cullNodes, cullEdges } from '../webgl/cull'

/**
 * Canvas 2D renderer — fallback / parity implementation of the {@link Renderer}
 * interface. Trades raw throughput for portability: runs in any browser with
 * 2D canvas, no WebGL2 dependency, no context-loss handling needed. Useful as:
 *
 * - Print / export path (rasterize at any DPR without GPU)
 * - SSR-resistant fallback when WebGL2 is unavailable
 * - Architectural validation that the Renderer abstraction is honest
 *
 * Feature parity with `WebGL2Renderer` for the static rendering path: shapes
 * (rect/circle/diamond/hexagon), bezier/straight/step edges, edge arrows,
 * node labels, edge labels, grid, selection highlight, animated dash pattern.
 * Does not implement: SDF text (uses native Canvas fillText with subpixel AA),
 * connect-drag preview, reroute handles (these are interaction overlays the
 * host application can render separately).
 */
export class Canvas2DRenderer implements Renderer {
  private ctx!: CanvasRenderingContext2D
  private canvas!: HTMLCanvasElement
  private dpr = 1
  private cachedHasAnimated = false

  initialize(
    canvas: HTMLCanvasElement,
    options: RendererOptions = {},
    _onContextLost?: () => void,
    _onContextRestored?: () => void,
  ): boolean {
    this.dpr = options.pixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1) ?? 1
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return false
    this.ctx = ctx
    this.canvas = canvas
    return true
  }

  resize(width: number, height: number): void {
    this.canvas.width  = Math.round(width  * this.dpr)
    this.canvas.height = Math.round(height * this.dpr)
    this.canvas.style.width  = `${width}px`
    this.canvas.style.height = `${height}px`
  }

  hasAnimatedEdges(): boolean { return this.cachedHasAnimated }

  render(graph: Graph, viewport: Viewport, frame: RenderFrame = {}): void {
    const ctx = this.ctx
    const selectedIds     = frame.selectedIds     ?? new Set<string>()
    const selectedEdgeIds = frame.selectedEdgeIds ?? new Set<string>()
    const bgColor         = frame.bgColor         ?? '#f7f7f7'
    const grid            = frame.grid            ?? null
    const dashOffset      = frame.dashOffset      ?? 0

    // Clear (use canvas pixel space, no transform)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Apply viewport: dpr * (zoom translate)
    const dpr  = this.dpr
    const zoom = viewport.zoom
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, viewport.x * dpr, viewport.y * dpr)

    if (grid?.visible) this.drawGrid(viewport, grid)

    const allNodes = graph.getNodes()
    const allEdges = graph.getEdges()

    // Filter hidden (collapsed-group children)
    const collapsedParents = new Set<string>()
    for (const n of allNodes) if (n.type === 'group' && n.collapsed) collapsedParents.add(n.id)
    const hiddenIds = new Set<string>()
    if (collapsedParents.size > 0) {
      for (const n of allNodes) if (n.parentId && collapsedParents.has(n.parentId)) hiddenIds.add(n.id)
    }
    const visAllNodes = hiddenIds.size > 0 ? allNodes.filter(n => !hiddenIds.has(n.id)) : allNodes
    const visAllEdges = hiddenIds.size > 0 ? allEdges.filter(e => !hiddenIds.has(e.source) && !hiddenIds.has(e.target)) : allEdges

    this.cachedHasAnimated = visAllEdges.some(e => e.animated)

    const bounds  = viewport.getVisibleBounds()
    const visNodes = cullNodes(visAllNodes, bounds)
    const nodeMap  = new Map(visAllNodes.map(n => [n.id, n]))
    const visEdges = cullEdges(visAllEdges, nodeMap, bounds)

    // Group nodes drawn first so child shapes sit on top
    const sorted = [...visNodes].sort((a, b) => (a.type === 'group' ? -1 : 1) - (b.type === 'group' ? -1 : 1))

    // Draw edges first (behind nodes)
    for (const edge of visEdges) this.drawEdge(edge, nodeMap, selectedEdgeIds.has(edge.id), dashOffset)
    for (const node of sorted)   this.drawNode(node, selectedIds.has(node.id))
    for (const node of sorted)   this.drawNodeLabel(node)
    for (const edge of visEdges) this.drawEdgeLabel(edge, nodeMap)
  }

  dispose(): void {
    // Canvas2D has nothing to release explicitly; consumers can drop the
    // canvas element to free memory.
  }

  // ── private drawing helpers ───────────────────────────────────────────────

  private drawGrid(viewport: Viewport, grid: NonNullable<RenderFrame['grid']>): void {
    const ctx = this.ctx
    const b = viewport.getVisibleBounds()
    const step = grid.size
    ctx.save()
    ctx.strokeStyle = grid.color
    ctx.lineWidth = 1 / viewport.zoom
    ctx.beginPath()
    if (grid.type === 'dots') {
      ctx.fillStyle = grid.color
      const r = 1 / viewport.zoom
      for (let x = Math.floor(b.minX / step) * step; x < b.maxX; x += step) {
        for (let y = Math.floor(b.minY / step) * step; y < b.maxY; y += step) {
          ctx.moveTo(x + r, y)
          ctx.arc(x, y, r, 0, Math.PI * 2)
        }
      }
      ctx.fill()
    } else {
      for (let x = Math.floor(b.minX / step) * step; x < b.maxX; x += step) {
        ctx.moveTo(x, b.minY)
        ctx.lineTo(x, b.maxY)
      }
      for (let y = Math.floor(b.minY / step) * step; y < b.maxY; y += step) {
        ctx.moveTo(b.minX, y)
        ctx.lineTo(b.maxX, y)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawNode(node: NodeData, selected: boolean): void {
    const ctx = this.ctx
    const s = { ...DEFAULT_NODE_STYLE, ...node.style }
    const shape = s.shape ?? 'rectangle'
    const { x, y, width: w, height: h } = node
    const cx = x + w / 2, cy = y + h / 2

    ctx.save()
    ctx.fillStyle   = s.backgroundColor
    ctx.strokeStyle = selected ? '#1a73e8' : s.borderColor
    ctx.lineWidth   = selected ? s.borderWidth + 1 : s.borderWidth

    ctx.beginPath()
    switch (shape) {
      case 'circle':
        ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2)
        break
      case 'diamond':
        ctx.moveTo(cx, y); ctx.lineTo(x + w, cy); ctx.lineTo(cx, y + h); ctx.lineTo(x, cy); ctx.closePath()
        break
      case 'hexagon': {
        const qw = w / 4
        ctx.moveTo(x + qw, y)
        ctx.lineTo(x + w - qw, y)
        ctx.lineTo(x + w, cy)
        ctx.lineTo(x + w - qw, y + h)
        ctx.lineTo(x + qw, y + h)
        ctx.lineTo(x, cy)
        ctx.closePath()
        break
      }
      default: {
        const r = Math.min(s.borderRadius, w / 2, h / 2)
        ctx.moveTo(x + r, y)
        ctx.arcTo(x + w, y,     x + w, y + h, r)
        ctx.arcTo(x + w, y + h, x,     y + h, r)
        ctx.arcTo(x,     y + h, x,     y,     r)
        ctx.arcTo(x,     y,     x + w, y,     r)
        ctx.closePath()
      }
    }
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  private drawNodeLabel(node: NodeData): void {
    if (!node.label || node.htmlContent) return
    const ctx = this.ctx
    const s = { ...DEFAULT_NODE_STYLE, ...node.style }
    ctx.save()
    ctx.fillStyle = s.textColor
    ctx.font = `${s.fontSize}px ${s.fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const cx = node.x + node.width  / 2
    const cy = node.y + node.height / 2
    ctx.fillText(node.label, cx, cy, Math.max(0, node.width - 16))
    ctx.restore()
  }

  private drawEdge(edge: EdgeData, nodeMap: Map<string, NodeData>, selected: boolean, dashOffset: number): void {
    const src = nodeMap.get(edge.source)
    const tgt = nodeMap.get(edge.target)
    if (!src || !tgt) return
    const [sx, sy] = handleXY(src, edge.sourceHandle)
    const [ex, ey] = handleXY(tgt, edge.targetHandle)
    const st = { ...DEFAULT_EDGE_STYLE, ...edge.style }

    const ctx = this.ctx
    ctx.save()
    ctx.strokeStyle = selected ? '#1a73e8' : st.color
    ctx.lineWidth   = selected ? st.width + 1 : st.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (edge.animated) {
      ctx.setLineDash([8, 4])
      ctx.lineDashOffset = -dashOffset
    } else if (st.dashArray && st.dashArray.length > 0) {
      ctx.setLineDash(st.dashArray)
    }

    ctx.beginPath()
    if (edge.waypoints && edge.waypoints.length > 0) {
      const pts = [[sx, sy], ...edge.waypoints.map(w => [w.x, w.y]), [ex, ey]]
      ctx.moveTo(pts[0]![0]!, pts[0]![1]!)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0]!, pts[i]![1]!)
    } else if (edge.type === 'straight') {
      ctx.moveTo(sx, sy); ctx.lineTo(ex, ey)
    } else if (edge.type === 'step') {
      const pts = stepWaypoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle)
      ctx.moveTo(pts[0]![0]!, pts[0]![1]!)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0]!, pts[i]![1]!)
    } else if (edge.type === 'smoothstep') {
      const r = edge.pathOptions?.borderRadius ?? DEFAULT_SMOOTHSTEP_BORDER_RADIUS
      const seg = edge.pathOptions?.arcSegments ?? DEFAULT_SMOOTHSTEP_ARC_SEGMENTS
      const pts = smoothStepWaypoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle, r, seg)
      ctx.moveTo(pts[0]![0]!, pts[0]![1]!)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0]!, pts[i]![1]!)
    } else {
      const [c1x, c1y, c2x, c2y] = edgeControlPoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle)
      ctx.moveTo(sx, sy)
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey)
    }
    ctx.stroke()

    // Arrow head
    this.drawArrow(sx, sy, ex, ey, edge, ctx.strokeStyle as string)
    ctx.restore()
  }

  private drawArrow(sx: number, sy: number, ex: number, ey: number, edge: EdgeData, color: string): void {
    let dx: number, dy: number
    if (edge.waypoints && edge.waypoints.length > 0) {
      const last = edge.waypoints[edge.waypoints.length - 1]!
      dx = ex - last.x; dy = ey - last.y
    } else if (edge.type === 'straight') {
      dx = ex - sx; dy = ey - sy
    } else if (edge.type === 'step') {
      const pts = stepWaypoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle)
      const last = pts[pts.length - 2]!
      dx = ex - last[0]!; dy = ey - last[1]!
    } else if (edge.type === 'smoothstep') {
      const r = edge.pathOptions?.borderRadius ?? DEFAULT_SMOOTHSTEP_BORDER_RADIUS
      const seg = edge.pathOptions?.arcSegments ?? DEFAULT_SMOOTHSTEP_ARC_SEGMENTS
      const pts = smoothStepWaypoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle, r, seg)
      const last = pts[pts.length - 2]!
      dx = ex - last[0]!; dy = ey - last[1]!
    } else {
      const [c1x, c1y, c2x, c2y] = edgeControlPoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle)
      const [px, py] = cubicBezierPoint(0.95, sx, sy, c1x, c1y, c2x, c2y, ex, ey)
      dx = ex - px; dy = ey - py
    }
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len, uy = dy / len
    const size = 8
    const ax = ex - ux * size, ay = ey - uy * size
    const px = -uy * size * 0.5, py = ux * size * 0.5

    const ctx = this.ctx
    ctx.save()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ax + px, ay + py)
    ctx.lineTo(ax - px, ay - py)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  private drawEdgeLabel(edge: EdgeData, nodeMap: Map<string, NodeData>): void {
    if (!edge.label) return
    const src = nodeMap.get(edge.source); const tgt = nodeMap.get(edge.target)
    if (!src || !tgt) return
    const [sx, sy] = handleXY(src, edge.sourceHandle)
    const [ex, ey] = handleXY(tgt, edge.targetHandle)
    let mx: number, my: number
    if (edge.type === 'straight' || (edge.waypoints && edge.waypoints.length > 0)) {
      mx = (sx + ex) / 2; my = (sy + ey) / 2
    } else {
      const [c1x, c1y, c2x, c2y] = edgeControlPoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle)
      const [bx, by] = cubicBezierPoint(0.5, sx, sy, c1x, c1y, c2x, c2y, ex, ey)
      mx = bx; my = by
    }

    const ctx = this.ctx
    ctx.save()
    ctx.font = '12px system-ui, sans-serif'
    const metrics = ctx.measureText(edge.label)
    const w = metrics.width + 12
    const h = 18
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillRect(mx - w / 2, my - h / 2, w, h)
    ctx.fillStyle = '#374151'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(edge.label, mx, my)
    ctx.restore()
  }
}
