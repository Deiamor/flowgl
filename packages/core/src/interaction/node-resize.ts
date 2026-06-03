import type { Graph } from '../graph/graph'
import type { Viewport } from '../viewport/viewport'
import type { NodeData } from '../graph/node'

type Dir = 'nw' | 'ne' | 'se' | 'sw'

const HANDLE_HALF = 5    // CSS px — half side of handle square
const HIT_RADIUS  = 10   // CSS px — pointer hit radius
const MIN_W = 40
const MIN_H = 30

const DIR_CURSOR: Record<Dir, string> = {
  nw: 'nw-resize', ne: 'ne-resize',
  se: 'se-resize', sw: 'sw-resize',
}

interface Handle { dir: Dir; wx: number; wy: number }

function nodeHandles(node: NodeData): Handle[] {
  const { x, y, width: w, height: h } = node
  return [
    { dir: 'nw', wx: x,     wy: y     },
    { dir: 'ne', wx: x + w, wy: y     },
    { dir: 'se', wx: x + w, wy: y + h },
    { dir: 'sw', wx: x,     wy: y + h },
  ]
}

function applyResize(
  orig: NodeData, dir: Dir, dwx: number, dwy: number,
): { x: number; y: number; width: number; height: number } {
  const hasW = dir === 'nw' || dir === 'sw'
  const hasN = dir === 'nw' || dir === 'ne'
  const hasE = dir === 'ne' || dir === 'se'
  const hasS = dir === 'se' || dir === 'sw'

  let { x, y, width: w, height: h } = orig
  if (hasE) w = Math.max(MIN_W, w + dwx)
  if (hasS) h = Math.max(MIN_H, h + dwy)
  if (hasW) { const eff = Math.min(dwx, w - MIN_W); x += eff; w -= eff }
  if (hasN) { const eff = Math.min(dwy, h - MIN_H); y += eff; h -= eff }
  return { x, y, width: w, height: h }
}

export class NodeResize {
  private canvas: HTMLCanvasElement
  private overlay: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private viewport: Viewport
  private graph: Graph
  private onBeforeMutation: () => void
  private onUpdate: () => void
  private onResizeEnd: (id: string, x: number, y: number, width: number, height: number) => void

  private selectedNodeId: string | null = null
  private hoveredDir: Dir | null = null
  private disabled = false

  setDisabled(v: boolean): void { this.disabled = v }
  private dragState: {
    handle: Handle
    startWx: number
    startWy: number
    origNode: NodeData
    origChildren: Array<{ id: string; x: number; y: number }>
  } | null = null

  private readonly onMouseMove: (e: MouseEvent) => void
  private readonly onMouseDown: (e: MouseEvent) => void
  private readonly onMouseUp:   () => void

  constructor(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    viewport: Viewport,
    graph: Graph,
    onBeforeMutation: () => void,
    onUpdate: () => void,
    onResizeEnd: (id: string, x: number, y: number, width: number, height: number) => void = () => {},
  ) {
    this.canvas           = canvas
    this.viewport         = viewport
    this.graph            = graph
    this.onBeforeMutation = onBeforeMutation
    this.onUpdate         = onUpdate
    this.onResizeEnd      = onResizeEnd

    this.overlay = document.createElement('canvas')
    this.overlay.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:2;'
    container.appendChild(this.overlay)

    const ctx = this.overlay.getContext('2d')
    if (!ctx) throw new Error('NodeResize: 2d context unavailable')
    this.ctx = ctx

    this.onMouseMove = this.handleMouseMove.bind(this)
    this.onMouseDown = this.handleMouseDown.bind(this)
    this.onMouseUp   = this.handleMouseUp.bind(this)

    canvas.addEventListener('mousemove',  this.onMouseMove)
    canvas.addEventListener('mousedown',  this.onMouseDown)
    window.addEventListener('mouseup',    this.onMouseUp)
  }

  setSelectedNode(id: string | null): void {
    if (id !== this.selectedNodeId) {
      this.selectedNodeId = id
      if (!id) { this.hoveredDir = null; this.dragState = null }
    }
  }

  isCapturing(): boolean { return this.dragState !== null }

  isNearHandle(clientX: number, clientY: number): boolean {
    return this.findHandle(clientX, clientY) !== null
  }

  private toScreen(clientX: number, clientY: number): [number, number] {
    const r = this.canvas.getBoundingClientRect()
    return [clientX - r.left, clientY - r.top]
  }

  private toWorld(clientX: number, clientY: number): [number, number] {
    const [sx, sy] = this.toScreen(clientX, clientY)
    return this.viewport.screenToWorld(sx, sy)
  }

  private findHandle(clientX: number, clientY: number): Handle | null {
    if (!this.selectedNodeId) return null
    const node = this.graph.getNode(this.selectedNodeId)
    if (!node || node.locked) return null
    const [sx, sy] = this.toScreen(clientX, clientY)
    for (const h of nodeHandles(node)) {
      const [hx, hy] = this.viewport.worldToScreen(h.wx, h.wy)
      if (Math.hypot(sx - hx, sy - hy) <= HIT_RADIUS) return h
    }
    return null
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.dragState) {
      const [wx, wy] = this.toWorld(e.clientX, e.clientY)
      const dwx = wx - this.dragState.startWx
      const dwy = wy - this.dragState.startWy
      const updates = applyResize(this.dragState.origNode, this.dragState.handle.dir, dwx, dwy)
      this.graph.updateNode(this.dragState.origNode.id, updates)
      // When group origin changes (W/N resize), move children by the same delta
      if (this.dragState.origChildren.length > 0) {
        const dx = updates.x - this.dragState.origNode.x
        const dy = updates.y - this.dragState.origNode.y
        if (dx !== 0 || dy !== 0) {
          for (const child of this.dragState.origChildren) {
            this.graph.updateNode(child.id, { x: child.x + dx, y: child.y + dy })
          }
        }
      }
      this.onUpdate()
      return
    }

    const h = this.findHandle(e.clientX, e.clientY)
    const newDir = h?.dir ?? null
    if (newDir !== this.hoveredDir) {
      this.hoveredDir = newDir
      this.canvas.style.cursor = newDir ? DIR_CURSOR[newDir] : ''
      this.onUpdate()
    }
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0 || this.disabled) return
    const h = this.findHandle(e.clientX, e.clientY)
    if (!h || !this.selectedNodeId) return
    const node = this.graph.getNode(this.selectedNodeId)
    if (!node) return
    e.stopPropagation()
    this.onBeforeMutation()
    const [wx, wy] = this.toWorld(e.clientX, e.clientY)
    const origChildren = node.type === 'group'
      ? this.graph.getNodes()
          .filter(c => c.parentId === node.id)
          .map(c => ({ id: c.id, x: c.x, y: c.y }))
      : []
    this.dragState = { handle: h, startWx: wx, startWy: wy, origNode: { ...node }, origChildren }
  }

  private handleMouseUp(): void {
    if (this.dragState) {
      const node = this.graph.getNode(this.dragState.origNode.id)
      if (node) this.onResizeEnd(node.id, node.x, node.y, node.width, node.height)
      this.dragState = null
      this.canvas.style.cursor = this.hoveredDir ? DIR_CURSOR[this.hoveredDir] : ''
    }
  }

  render(): void {
    const { overlay, ctx, viewport } = this
    const w = this.canvas.offsetWidth
    const h = this.canvas.offsetHeight
    if (overlay.width !== w || overlay.height !== h) {
      overlay.width = w
      overlay.height = h
    }
    ctx.clearRect(0, 0, w, h)

    if (!this.selectedNodeId) return
    const node = this.graph.getNode(this.selectedNodeId)
    if (!node) return

    for (const handle of nodeHandles(node)) {
      const [sx, sy] = viewport.worldToScreen(handle.wx, handle.wy)
      const isHovered = handle.dir === this.hoveredDir
      ctx.fillStyle   = isHovered ? '#1a6ef5' : '#ffffff'
      ctx.strokeStyle = '#1a6ef5'
      ctx.lineWidth   = 1.5
      ctx.beginPath()
      ctx.rect(sx - HANDLE_HALF, sy - HANDLE_HALF, HANDLE_HALF * 2, HANDLE_HALF * 2)
      ctx.fill()
      ctx.stroke()
    }
  }

  dispose(): void {
    this.canvas.removeEventListener('mousemove',  this.onMouseMove)
    this.canvas.removeEventListener('mousedown',  this.onMouseDown)
    window.removeEventListener('mouseup',         this.onMouseUp)
    this.overlay.remove()
  }
}
