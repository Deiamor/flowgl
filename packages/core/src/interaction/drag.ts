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

  private readonly onMouseDown: (e: MouseEvent) => void
  private readonly onMouseMove: (e: MouseEvent) => void
  private readonly onMouseUp:   (e: MouseEvent) => void

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

    this.onMouseDown = this.handleMouseDown.bind(this)
    this.onMouseMove = this.handleMouseMove.bind(this)
    this.onMouseUp   = this.handleMouseUp.bind(this)

    canvas.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup',   this.onMouseUp)
  }

  private toWorld(clientX: number, clientY: number): [number, number] {
    const r = this.canvas.getBoundingClientRect()
    return this.viewport.screenToWorld(clientX - r.left, clientY - r.top)
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return
    // ConnectDrag gets priority when near a handle
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
    // onStart is deferred to first actual movement so click-only does not pollute history
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.dragging) return
    const [wx, wy] = this.toWorld(e.clientX, e.clientY)
    const nx = wx - this.dragOffsetX
    const ny = wy - this.dragOffsetY
    if (!this.didMove) {
      this.onStart()   // capture pre-drag snapshot before first updateNode
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

  dispose(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup',   this.onMouseUp)
  }
}
