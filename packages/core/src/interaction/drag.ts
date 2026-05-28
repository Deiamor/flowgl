import type { Graph } from '../graph/graph'
import type { Viewport } from '../viewport/viewport'
import type { HitTester } from './hit-test'
import type { NodeData } from '../graph/node'

export type NodeMoveHandler    = (id: string, x: number, y: number) => void
export type NodeDragEndHandler = (id: string, x: number, y: number) => void
export type NodeDragStartHandler = () => void

export class NodeDrag {
  private canvas: HTMLCanvasElement
  private viewport: Viewport
  private graph: Graph
  private hitTester: HitTester
  private onStart: NodeDragStartHandler
  private onMove: NodeMoveHandler
  private onEnd: NodeDragEndHandler
  private shouldBlock: (clientX: number, clientY: number) => boolean

  private dragging: NodeData | null = null
  private dragOffsetX = 0
  private dragOffsetY = 0
  private didMove = false
  private activeTouchId: number | null = null

  private readonly onMouseDown:  (e: MouseEvent) => void
  private readonly onMouseMove:  (e: MouseEvent) => void
  private readonly onMouseUp:    (e: MouseEvent) => void
  private readonly onTouchStart: (e: TouchEvent) => void
  private readonly onTouchMove:  (e: TouchEvent) => void
  private readonly onTouchEnd:   (e: TouchEvent) => void

  constructor(
    canvas: HTMLCanvasElement,
    viewport: Viewport,
    graph: Graph,
    hitTester: HitTester,
    onStart: NodeDragStartHandler,
    onMove: NodeMoveHandler,
    onEnd: NodeDragEndHandler,
    shouldBlock: (clientX: number, clientY: number) => boolean = () => false,
  ) {
    this.canvas       = canvas
    this.viewport     = viewport
    this.graph        = graph
    this.hitTester    = hitTester
    this.onStart      = onStart
    this.onMove       = onMove
    this.onEnd        = onEnd
    this.shouldBlock  = shouldBlock

    this.onMouseDown  = this.handleMouseDown.bind(this)
    this.onMouseMove  = this.handleMouseMove.bind(this)
    this.onMouseUp    = this.handleMouseUp.bind(this)
    this.onTouchStart = this.handleTouchStart.bind(this)
    this.onTouchMove  = this.handleTouchMove.bind(this)
    this.onTouchEnd   = this.handleTouchEnd.bind(this)

    canvas.addEventListener('mousedown',   this.onMouseDown)
    window.addEventListener('mousemove',   this.onMouseMove)
    window.addEventListener('mouseup',     this.onMouseUp)
    canvas.addEventListener('touchstart',  this.onTouchStart, { passive: false })
    canvas.addEventListener('touchmove',   this.onTouchMove,  { passive: false })
    canvas.addEventListener('touchend',    this.onTouchEnd)
    canvas.addEventListener('touchcancel', this.onTouchEnd)
  }

  private toWorld(clientX: number, clientY: number): [number, number] {
    const r = this.canvas.getBoundingClientRect()
    return this.viewport.screenToWorld(clientX - r.left, clientY - r.top)
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return
    if (this.shouldBlock(e.clientX, e.clientY)) return
    const [wx, wy] = this.toWorld(e.clientX, e.clientY)
    const node = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy)
    if (!node) return
    e.stopPropagation()
    this.dragging    = node
    this.dragOffsetX = wx - node.x
    this.dragOffsetY = wy - node.y
    this.didMove     = false
    this.canvas.style.cursor = 'grab'
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.dragging) return
    const [wx, wy] = this.toWorld(e.clientX, e.clientY)
    const nx = wx - this.dragOffsetX
    const ny = wy - this.dragOffsetY
    if (!this.didMove) {
      this.onStart()
      this.didMove = true
    }
    this.graph.updateNode(this.dragging.id, { x: nx, y: ny })
    this.canvas.style.cursor = 'grabbing'
    this.onMove(this.dragging.id, nx, ny)
  }

  private handleMouseUp(_e: MouseEvent): void {
    if (!this.dragging) return
    const node = this.graph.getNode(this.dragging.id)
    if (node && this.didMove) this.onEnd(node.id, node.x, node.y)
    this.dragging = null
    this.canvas.style.cursor = ''
  }

  private handleTouchStart(e: TouchEvent): void {
    if (this.activeTouchId !== null || e.touches.length !== 1) return
    const touch = e.touches[0]!
    if (this.shouldBlock(touch.clientX, touch.clientY)) return
    const [wx, wy] = this.toWorld(touch.clientX, touch.clientY)
    const node = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy)
    if (!node) return
    e.preventDefault()
    e.stopPropagation()
    this.activeTouchId = touch.identifier
    this.dragging      = node
    this.dragOffsetX   = wx - node.x
    this.dragOffsetY   = wy - node.y
    this.didMove       = false
    this.canvas.style.cursor = 'grab'
  }

  private handleTouchMove(e: TouchEvent): void {
    if (this.activeTouchId === null || !this.dragging) return
    const touch = Array.from(e.changedTouches).find(t => t.identifier === this.activeTouchId)
    if (!touch) return
    e.preventDefault()
    const [wx, wy] = this.toWorld(touch.clientX, touch.clientY)
    const nx = wx - this.dragOffsetX
    const ny = wy - this.dragOffsetY
    if (!this.didMove) {
      this.onStart()
      this.didMove = true
    }
    this.graph.updateNode(this.dragging.id, { x: nx, y: ny })
    this.canvas.style.cursor = 'grabbing'
    this.onMove(this.dragging.id, nx, ny)
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (this.activeTouchId === null || !this.dragging) return
    const touch = Array.from(e.changedTouches).find(t => t.identifier === this.activeTouchId)
    if (!touch) return
    const node = this.graph.getNode(this.dragging.id)
    if (node && this.didMove) this.onEnd(node.id, node.x, node.y)
    this.dragging      = null
    this.activeTouchId = null
    this.canvas.style.cursor = ''
  }

  dispose(): void {
    this.canvas.removeEventListener('mousedown',   this.onMouseDown)
    window.removeEventListener('mousemove',        this.onMouseMove)
    window.removeEventListener('mouseup',          this.onMouseUp)
    this.canvas.removeEventListener('touchstart',  this.onTouchStart)
    this.canvas.removeEventListener('touchmove',   this.onTouchMove)
    this.canvas.removeEventListener('touchend',    this.onTouchEnd)
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd)
  }
}
