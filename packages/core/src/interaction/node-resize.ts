import type { Graph } from '../graph/graph'
import type { Viewport } from '../viewport/viewport'
import type { NodeData } from '../graph/node'

type Dir = 'nw' | 'ne' | 'se' | 'sw'

const HANDLE_HALF = 5    // CSS px — half side of handle square
const HIT_RADIUS  = 10   // CSS px — pointer hit radius
const MIN_W_DEFAULT = 40
const MIN_H_DEFAULT = 30
const MAX_W_DEFAULT = Number.MAX_SAFE_INTEGER
const MAX_H_DEFAULT = Number.MAX_SAFE_INTEGER

export interface NodeResizeRect {
  x: number; y: number; width: number; height: number
}

export interface NodeResizeOptions {
  /** Minimum allowed width (world units). Default 40. */
  minWidth?: number
  /** Minimum allowed height (world units). Default 30. */
  minHeight?: number
  /** Maximum allowed width. Default MAX_SAFE_INTEGER. */
  maxWidth?: number
  /** Maximum allowed height. Default MAX_SAFE_INTEGER. */
  maxHeight?: number
  /** Lock aspect ratio during resize. Default false. */
  keepAspectRatio?: boolean
  /** Predicate gating resize per node. Default — every non-locked node is resizable. */
  shouldResize?: (node: NodeData) => boolean
  /** Fired when a resize gesture begins (mousedown on a corner). */
  onResizeStart?: (id: string, rect: NodeResizeRect) => void
  /** Fired on every mouse-move during an active resize. */
  onResize?: (id: string, rect: NodeResizeRect) => void
  /** Fired when the resize gesture completes (mouseup). */
  onResizeEnd?: (id: string, rect: NodeResizeRect) => void
}

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
  minW: number, minH: number, maxW: number, maxH: number,
  keepAspect: boolean,
): { x: number; y: number; width: number; height: number } {
  const hasW = dir === 'nw' || dir === 'sw'
  const hasN = dir === 'nw' || dir === 'ne'
  const hasE = dir === 'ne' || dir === 'se'
  const hasS = dir === 'se' || dir === 'sw'

  let { x, y, width: w, height: h } = orig

  if (keepAspect && orig.height > 0 && orig.width > 0) {
    // Drive the resize by the dominant axis delta and derive the other from
    // the original aspect ratio. Sign matters — the dominant axis pick uses
    // the signed delta of each enabled side, not the absolute value.
    const ratio = orig.width / orig.height
    const dW = (hasE ? dwx : 0) + (hasW ? -dwx : 0)
    const dH = (hasS ? dwy : 0) + (hasN ? -dwy : 0)
    if (Math.abs(dW) >= Math.abs(dH * ratio)) {
      const newW = Math.max(minW, Math.min(maxW, orig.width + dW))
      const newH = Math.max(minH, Math.min(maxH, newW / ratio))
      const actualW = newH * ratio
      if (hasE) w = actualW
      if (hasW) { x = orig.x + (orig.width - actualW); w = actualW }
      if (hasS) h = newH
      if (hasN) { y = orig.y + (orig.height - newH); h = newH }
      return { x, y, width: w, height: h }
    } else {
      const newH = Math.max(minH, Math.min(maxH, orig.height + dH))
      const newW = Math.max(minW, Math.min(maxW, newH * ratio))
      const actualH = newW / ratio
      if (hasS) h = actualH
      if (hasN) { y = orig.y + (orig.height - actualH); h = actualH }
      if (hasE) w = newW
      if (hasW) { x = orig.x + (orig.width - newW); w = newW }
      return { x, y, width: w, height: h }
    }
  }

  if (hasE) w = Math.max(minW, Math.min(maxW, w + dwx))
  if (hasS) h = Math.max(minH, Math.min(maxH, h + dwy))
  if (hasW) {
    const target = Math.max(minW, Math.min(maxW, w - dwx))
    const delta  = w - target
    x += delta
    w = target
  }
  if (hasN) {
    const target = Math.max(minH, Math.min(maxH, h - dwy))
    const delta  = h - target
    y += delta
    h = target
  }
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
  private options: NodeResizeOptions = {}

  setOptions(options: NodeResizeOptions): void { this.options = { ...this.options, ...options } }
  getOptions(): NodeResizeOptions { return { ...this.options } }

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
      const o = this.options
      const minW = o.minWidth  ?? MIN_W_DEFAULT
      const minH = o.minHeight ?? MIN_H_DEFAULT
      const maxW = o.maxWidth  ?? MAX_W_DEFAULT
      const maxH = o.maxHeight ?? MAX_H_DEFAULT
      const keepAspect = !!o.keepAspectRatio || e.shiftKey
      const updates = applyResize(
        this.dragState.origNode, this.dragState.handle.dir, dwx, dwy,
        minW, minH, maxW, maxH, keepAspect,
      )
      this.graph.updateNode(this.dragState.origNode.id, updates)
      if (o.onResize) o.onResize(this.dragState.origNode.id, updates)
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
    if (this.options.shouldResize && !this.options.shouldResize(node)) return
    e.stopPropagation()
    if (this.options.onResizeStart) {
      this.options.onResizeStart(node.id, { x: node.x, y: node.y, width: node.width, height: node.height })
    }
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
      if (node) {
        const rect = { x: node.x, y: node.y, width: node.width, height: node.height }
        this.onResizeEnd(node.id, rect.x, rect.y, rect.width, rect.height)
        if (this.options.onResizeEnd) this.options.onResizeEnd(node.id, rect)
      }
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
