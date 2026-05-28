import type { Graph } from '../graph/graph'
import type { NodeData } from '../graph/node'
import type { Viewport } from '../viewport/viewport'
import type { HitTester } from './hit-test'
import { getHandlePositions, type HandleSide, type HandlePos } from './connect'

const ENDPOINT_HIT_PX = 12
const HANDLE_HIT_PX   = 14

export interface RerouteState {
  edgeId:       string
  movingEnd:    'source' | 'target'
  fixedHandle:  HandlePos      // the end that doesn't move
  pendingEndWx: number
  pendingEndWy: number
  targetNodeId: string | null
  targetHandle: HandleSide | null
}

export interface EndpointCircle {
  wx:     number
  wy:     number
  edgeId: string
  end:    'source' | 'target'
}

export class EdgeReroute {
  private canvas:            HTMLCanvasElement
  private viewport:          Viewport
  private graph:             Graph
  private hitTester:         HitTester
  private getSelectedEdgeIds: () => Set<string>
  private onStateChange:     (s: RerouteState | null) => void
  private onReroute: (
    edgeId:      string,
    movingEnd:   'source' | 'target',
    targetNodeId: string,
    targetHandle: HandleSide,
  ) => void

  private state: RerouteState | null = null

  private readonly onMouseDown: (e: MouseEvent) => void
  private readonly onMouseMove: (e: MouseEvent) => void
  private readonly onMouseUp:   (e: MouseEvent) => void

  constructor(
    canvas:             HTMLCanvasElement,
    viewport:           Viewport,
    graph:              Graph,
    hitTester:          HitTester,
    getSelectedEdgeIds: () => Set<string>,
    onStateChange:      (s: RerouteState | null) => void,
    onReroute: (
      edgeId:       string,
      movingEnd:    'source' | 'target',
      targetNodeId: string,
      targetHandle: HandleSide,
    ) => void,
  ) {
    this.canvas             = canvas
    this.viewport           = viewport
    this.graph              = graph
    this.hitTester          = hitTester
    this.getSelectedEdgeIds = getSelectedEdgeIds
    this.onStateChange      = onStateChange
    this.onReroute          = onReroute

    this.onMouseDown = this.handleMouseDown.bind(this)
    this.onMouseMove = this.handleMouseMove.bind(this)
    this.onMouseUp   = this.handleMouseUp.bind(this)

    // Capture phase — must fire before ConnectDrag's bubble-phase listener
    canvas.addEventListener('mousedown', this.onMouseDown, true)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup',   this.onMouseUp)
  }

  isCapturing(): boolean { return this.state !== null }

  /** True if (clientX, clientY) is on an endpoint circle of a selected edge. */
  isOnEndpoint(clientX: number, clientY: number): boolean {
    const [wx, wy] = this.toWorld(clientX, clientY)
    const hitR = ENDPOINT_HIT_PX / this.viewport.zoom
    return this.getEndpointCircles().some(
      c => Math.hypot(wx - c.wx, wy - c.wy) <= hitR,
    )
  }

  /** Endpoint circles to render for currently selected edges. */
  getEndpointCircles(): EndpointCircle[] {
    const selectedIds = this.getSelectedEdgeIds()
    if (selectedIds.size === 0) return []

    const nodeMap = new Map(this.graph.getNodes().map(n => [n.id, n]))
    const result: EndpointCircle[] = []

    for (const edgeId of selectedIds) {
      const edge = this.graph.getEdge(edgeId)
      if (!edge) continue
      const src = nodeMap.get(edge.source)
      const tgt = nodeMap.get(edge.target)
      if (!src || !tgt) continue

      const srcSide  = edge.sourceHandle ?? 'right'
      const tgtSide  = edge.targetHandle ?? 'left'
      const srcH = getHandlePositions(src).find(h => h.side === srcSide) ?? getHandlePositions(src)[0]!
      const tgtH = getHandlePositions(tgt).find(h => h.side === tgtSide) ?? getHandlePositions(tgt)[0]!

      result.push({ wx: srcH.wx, wy: srcH.wy, edgeId, end: 'source' })
      result.push({ wx: tgtH.wx, wy: tgtH.wy, edgeId, end: 'target' })
    }
    return result
  }

  private toWorld(clientX: number, clientY: number): [number, number] {
    const r = this.canvas.getBoundingClientRect()
    return this.viewport.screenToWorld(clientX - r.left, clientY - r.top)
  }

  private findTargetHandle(wx: number, wy: number, excludeNodeId: string): HandlePos | null {
    const hitR = HANDLE_HIT_PX / this.viewport.zoom

    for (const node of this.graph.getNodes()) {
      if (node.id === excludeNodeId) continue
      for (const h of getHandlePositions(node)) {
        if (Math.hypot(wx - h.wx, wy - h.wy) <= hitR) return h
      }
    }

    const bodyNode = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy)
    if (!bodyNode || bodyNode.id === excludeNodeId) return null

    let best: HandlePos | null = null, bestDist = Infinity
    for (const h of getHandlePositions(bodyNode)) {
      const d = Math.hypot(wx - h.wx, wy - h.wy)
      if (d < bestDist) { bestDist = d; best = h }
    }
    return best
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return
    const circles = this.getEndpointCircles()
    if (circles.length === 0) return

    const [wx, wy] = this.toWorld(e.clientX, e.clientY)
    const hitR = ENDPOINT_HIT_PX / this.viewport.zoom

    for (const circle of circles) {
      if (Math.hypot(wx - circle.wx, wy - circle.wy) > hitR) continue

      const edge    = this.graph.getEdge(circle.edgeId)
      if (!edge) continue
      const nodeMap = new Map(this.graph.getNodes().map(n => [n.id, n]))

      let fixedHandle: HandlePos
      if (circle.end === 'source') {
        // Moving source → fixed end is target
        const tgt    = nodeMap.get(edge.target)!
        const tgtSide = edge.targetHandle ?? 'left'
        fixedHandle  = getHandlePositions(tgt).find(h => h.side === tgtSide) ?? getHandlePositions(tgt)[0]!
      } else {
        // Moving target → fixed end is source
        const src    = nodeMap.get(edge.source)!
        const srcSide = edge.sourceHandle ?? 'right'
        fixedHandle  = getHandlePositions(src).find(h => h.side === srcSide) ?? getHandlePositions(src)[0]!
      }

      // Block ConnectDrag and all other bubble-phase listeners on this element
      e.stopPropagation()
      e.stopImmediatePropagation()

      this.state = {
        edgeId:       circle.edgeId,
        movingEnd:    circle.end,
        fixedHandle,
        pendingEndWx: wx,
        pendingEndWy: wy,
        targetNodeId: null,
        targetHandle: null,
      }
      this.onStateChange(this.state)
      this.canvas.style.cursor = 'crosshair'
      return
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.state) return
    const [wx, wy] = this.toWorld(e.clientX, e.clientY)

    const edge = this.graph.getEdge(this.state.edgeId)
    if (!edge) return

    const excludeNodeId = this.state.movingEnd === 'source' ? edge.source : edge.target
    const hit = this.findTargetHandle(wx, wy, excludeNodeId)

    this.state = {
      ...this.state,
      pendingEndWx: hit ? hit.wx  : wx,
      pendingEndWy: hit ? hit.wy  : wy,
      targetNodeId: hit ? hit.nodeId : null,
      targetHandle: hit ? hit.side   : null,
    }
    this.onStateChange(this.state)
  }

  private handleMouseUp(_e: MouseEvent): void {
    if (!this.state) return
    const { edgeId, movingEnd, targetNodeId, targetHandle } = this.state
    this.state = null
    this.onStateChange(null)
    this.canvas.style.cursor = ''

    if (targetNodeId && targetHandle) {
      this.onReroute(edgeId, movingEnd, targetNodeId, targetHandle)
    }
  }

  dispose(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown, true)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup',   this.onMouseUp)
  }
}
