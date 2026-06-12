import type { Graph } from '../graph/graph'
import type { Viewport } from '../viewport/viewport'
import type { HitTester } from './hit-test'
import type { NodeData } from '../graph/node'

export type NodeMoveHandler      = (id: string, x: number, y: number) => void
export type NodeDragEndHandler   = (id: string, x: number, y: number) => void
export type NodeDragStartHandler = (id: string) => void

interface ChildOffset { id: string; dx: number; dy: number }

export class NodeDrag {
  private canvas: HTMLCanvasElement
  private viewport: Viewport
  private graph: Graph
  private hitTester: HitTester
  private onStart: NodeDragStartHandler
  private onMove: NodeMoveHandler
  private onEnd: NodeDragEndHandler
  private shouldBlock: (clientX: number, clientY: number) => boolean
  private getSnapGrid: () => number
  private getChildren: (nodeId: string) => string[]
  private getCoselected: (nodeId: string) => string[]
  private postSnap: ((nx: number, ny: number, dragId: string) => [number, number]) | null = null

  private dragging: NodeData | null = null
  private dragOffsetX = 0
  private dragOffsetY = 0
  private dragChildren: ChildOffset[] = []
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
    getSnapGrid: () => number = () => 0,
    getChildren: (nodeId: string) => string[] = () => [],
    getCoselected: (nodeId: string) => string[] = () => [],
  ) {
    this.canvas        = canvas
    this.viewport      = viewport
    this.graph         = graph
    this.hitTester     = hitTester
    this.onStart       = onStart
    this.onMove        = onMove
    this.onEnd         = onEnd
    this.shouldBlock   = shouldBlock
    this.getSnapGrid   = getSnapGrid
    this.getChildren   = getChildren
    this.getCoselected = getCoselected

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
    canvas.addEventListener('touchend',    this.onTouchEnd,   { passive: false })
    canvas.addEventListener('touchcancel', this.onTouchEnd,   { passive: false })
  }

  private snap(v: number): number {
    const g = this.getSnapGrid()
    return g > 0 ? Math.round(v / g) * g : v
  }

  /** Register a coords-rewrite hook called after grid snap, before updateNode. */
  setPostSnap(fn: ((nx: number, ny: number, dragId: string) => [number, number]) | null): void {
    this.postSnap = fn
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
    if (!node || node.locked) return
    e.stopPropagation()
    this.dragging    = node
    this.dragOffsetX = wx - node.x
    this.dragOffsetY = wy - node.y
    this.didMove     = false
    const children   = this.getChildren(node.id)
    const childSet   = new Set(children)
    const coselected = this.getCoselected(node.id).filter(id => !childSet.has(id))
    // When a coselected node is a group, also drag its children so they stay inside
    const allIds = new Set([node.id, ...children, ...coselected])
    for (const csId of coselected) {
      const csNode = this.graph.getNode(csId)
      if (csNode?.type === 'group') {
        for (const cId of this.getChildren(csId)) {
          if (!allIds.has(cId)) allIds.add(cId)
        }
      }
    }
    allIds.delete(node.id)
    this.dragChildren = [...allIds].map(id => {
      const n = this.graph.getNode(id)
      return n ? { id, dx: n.x - node.x, dy: n.y - node.y } : null
    }).filter(Boolean) as ChildOffset[]
    this.canvas.style.cursor = 'grab'
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.dragging) return
    const [wx, wy] = this.toWorld(e.clientX, e.clientY)
    let nx = this.snap(wx - this.dragOffsetX)
    let ny = this.snap(wy - this.dragOffsetY)
    if (!this.didMove) {
      this.onStart(this.dragging.id)
      this.didMove = true
    }
    if (this.postSnap) [nx, ny] = this.postSnap(nx, ny, this.dragging.id)
    this.graph.updateNode(this.dragging.id, { x: nx, y: ny })
    for (const c of this.dragChildren) this.graph.updateNode(c.id, { x: nx + c.dx, y: ny + c.dy })
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
    if (!node || node.locked) return
    e.preventDefault()
    e.stopPropagation()
    this.activeTouchId = touch.identifier
    this.dragging      = node
    this.dragOffsetX   = wx - node.x
    this.dragOffsetY   = wy - node.y
    this.didMove       = false
    const children     = this.getChildren(node.id)
    const childSet     = new Set(children)
    const coselected   = this.getCoselected(node.id).filter(id => !childSet.has(id))
    const allIds       = new Set([node.id, ...children, ...coselected])
    for (const csId of coselected) {
      const csNode = this.graph.getNode(csId)
      if (csNode?.type === 'group') {
        for (const cId of this.getChildren(csId)) {
          if (!allIds.has(cId)) allIds.add(cId)
        }
      }
    }
    allIds.delete(node.id)
    this.dragChildren  = [...allIds].map(id => {
      const n = this.graph.getNode(id)
      return n ? { id, dx: n.x - node.x, dy: n.y - node.y } : null
    }).filter(Boolean) as ChildOffset[]
    this.canvas.style.cursor = 'grab'
  }

  private handleTouchMove(e: TouchEvent): void {
    if (this.activeTouchId === null || !this.dragging) return
    const touch = Array.from(e.changedTouches).find(t => t.identifier === this.activeTouchId)
    if (!touch) return
    e.preventDefault()
    const [wx, wy] = this.toWorld(touch.clientX, touch.clientY)
    let nx = this.snap(wx - this.dragOffsetX)
    let ny = this.snap(wy - this.dragOffsetY)
    if (!this.didMove) {
      this.onStart(this.dragging.id)
      this.didMove = true
    }
    if (this.postSnap) [nx, ny] = this.postSnap(nx, ny, this.dragging.id)
    this.graph.updateNode(this.dragging.id, { x: nx, y: ny })
    for (const c of this.dragChildren) this.graph.updateNode(c.id, { x: nx + c.dx, y: ny + c.dy })
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
