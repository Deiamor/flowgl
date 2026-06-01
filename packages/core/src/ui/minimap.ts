import type { NodeData } from '../graph/node'
import type { EdgeData } from '../graph/edge'
import type { Viewport } from '../viewport/viewport'
import { DEFAULT_MINIMAP_CONFIG } from '../types'
import type { MinimapConfig } from '../types'

const PAD    = 8
const RADIUS = 6

export class Minimap {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private config: MinimapConfig

  // World-to-minimap transform, updated each render
  private scale      = 1
  private mapOffX    = 0
  private mapOffY    = 0
  private boundsMinX = 0
  private boundsMinY = 0
  private hasContent = false

  private dragging = false
  private onNavigate: (wx: number, wy: number) => void

  private readonly onMouseDown: (e: MouseEvent) => void
  private readonly onMouseMove: (e: MouseEvent) => void
  private readonly onMouseUp:   () => void

  constructor(
    container: HTMLElement,
    config: Partial<MinimapConfig>,
    onNavigate: (wx: number, wy: number) => void,
  ) {
    this.config     = { ...DEFAULT_MINIMAP_CONFIG, ...config }
    this.onNavigate = onNavigate

    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative'
    }

    this.canvas        = document.createElement('canvas')
    this.canvas.width  = this.config.width
    this.canvas.height = this.config.height
    this.canvas.style.cssText = this.positionStyle()
    container.appendChild(this.canvas)

    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Minimap: 2d context unavailable')
    this.ctx = ctx

    this.onMouseDown = (e: MouseEvent) => {
      e.stopPropagation()
      this.dragging = true
      this.navigate(e)
    }
    this.onMouseMove = (e: MouseEvent) => {
      if (!this.dragging) return
      e.stopPropagation()
      this.navigate(e)
    }
    this.onMouseUp = () => { this.dragging = false }

    this.canvas.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mousemove',  this.onMouseMove)
    window.addEventListener('mouseup',    this.onMouseUp)
  }

  private positionStyle(): string {
    const { position, width, height } = this.config
    const corner = ({
      'top-left':     'top:8px;left:8px',
      'top-right':    'top:8px;right:8px',
      'bottom-left':  'bottom:8px;left:8px',
      'bottom-right': 'bottom:8px;right:8px',
    } as Record<string, string>)[position]
    return `position:absolute;${corner};width:${width}px;height:${height}px;` +
           `border-radius:${RADIUS}px;box-shadow:0 2px 8px rgba(0,0,0,0.15);` +
           `cursor:pointer;z-index:10;`
  }

  private navigate(e: MouseEvent): void {
    if (!this.hasContent) return
    const rect = this.canvas.getBoundingClientRect()
    const mx   = e.clientX - rect.left
    const my   = e.clientY - rect.top
    const wx   = (mx - this.mapOffX) / this.scale + this.boundsMinX
    const wy   = (my - this.mapOffY) / this.scale + this.boundsMinY
    this.onNavigate(wx, wy)
  }

  render(nodes: NodeData[], edges: EdgeData[], viewport: Viewport): void {
    const { width: W, height: H, background, nodeColor } = this.config
    const ctx = this.ctx

    ctx.clearRect(0, 0, W, H)

    // Panel background
    ctx.fillStyle = background
    ctx.beginPath()
    ctx.roundRect(0, 0, W, H, RADIUS)
    ctx.fill()

    if (nodes.length === 0) {
      this.hasContent = false
      return
    }
    this.hasContent = true

    // Compute world bounds of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      if (n.x              < minX) minX = n.x
      if (n.y              < minY) minY = n.y
      if (n.x + n.width  > maxX) maxX = n.x + n.width
      if (n.y + n.height > maxY) maxY = n.y + n.height
    }

    const boundsW = maxX - minX
    const boundsH = maxY - minY
    const availW  = W - PAD * 2
    const availH  = H - PAD * 2
    const scale   = Math.min(availW / Math.max(boundsW, 1), availH / Math.max(boundsH, 1))
    const offX    = PAD + (availW - boundsW * scale) / 2
    const offY    = PAD + (availH - boundsH * scale) / 2

    this.scale      = scale
    this.boundsMinX = minX
    this.boundsMinY = minY
    this.mapOffX    = offX
    this.mapOffY    = offY

    const mx = (wx: number) => offX + (wx - minX) * scale
    const my = (wy: number) => offY + (wy - minY) * scale

    // Clip all drawing to the panel
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(0, 0, W, H, RADIUS)
    ctx.clip()

    // Edges — batched into one path for performance
    if (edges.length > 0) {
      const nodeMap = new Map<string, NodeData>()
      for (const n of nodes) nodeMap.set(n.id, n)

      ctx.strokeStyle = 'rgba(148,163,184,0.45)'
      ctx.lineWidth   = Math.max(0.5, scale * 1.5)
      ctx.beginPath()
      for (const edge of edges) {
        const src = nodeMap.get(edge.source)
        const tgt = nodeMap.get(edge.target)
        if (!src || !tgt) continue
        ctx.moveTo(mx(src.x + src.width  / 2), my(src.y + src.height / 2))
        ctx.lineTo(mx(tgt.x + tgt.width  / 2), my(tgt.y + tgt.height / 2))
      }
      ctx.stroke()
    }

    // Nodes
    for (const node of nodes) {
      const nx = mx(node.x)
      const ny = my(node.y)
      const nw = Math.max(1, node.width  * scale)
      const nh = Math.max(1, node.height * scale)
      ctx.fillStyle = node.style?.backgroundColor ?? nodeColor
      ctx.fillRect(nx, ny, nw, nh)
    }

    // Viewport rectangle
    const vpLeft  = mx(-viewport.x / viewport.zoom)
    const vpTop   = my(-viewport.y / viewport.zoom)
    const vpW     = (viewport.canvasWidth  / viewport.zoom) * scale
    const vpH     = (viewport.canvasHeight / viewport.zoom) * scale

    ctx.fillStyle   = 'rgba(59,130,246,0.08)'
    ctx.strokeStyle = 'rgba(59,130,246,0.75)'
    ctx.lineWidth   = 1.5
    ctx.beginPath()
    ctx.rect(vpLeft, vpTop, vpW, vpH)
    ctx.fill()
    ctx.stroke()

    ctx.restore()
  }

  setConfig(patch: Partial<MinimapConfig>): void {
    this.config = { ...this.config, ...patch }
    const { width, height } = this.config
    this.canvas.width  = width
    this.canvas.height = height
    this.canvas.style.cssText = this.positionStyle()
  }

  dispose(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup',   this.onMouseUp)
    this.canvas.remove()
  }
}
