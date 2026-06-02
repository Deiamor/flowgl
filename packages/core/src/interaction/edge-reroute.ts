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
  private disabled = false

  setDisabled(v: boolean): void { this.disabled = v }

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
      const srcHandles = getHandlePositions(src)
      const tgtHandles = getHandlePositions(tgt)
      const srcH = srcHandles.find(h => h.side === srcSide) ?? srcHandles[0]!
      const tgtH = tgtHandles.find(h => h.side === tgtSide) ?? tgtHandles[0]!

      result.push({ wx: srcH.wx, wy: srcH.wy, edgeId, end: 'source' })
      result.push({ wx: tgtH.wx, wy: tgtH.wy, edgeId, end: 'target' })
    }
    return result
  }

  private toWorld(clientX: number, clientY: number): [number, number] {
    const r = this.canvas.getBoundingClientRect()
    return this.viewport.screenToWorld(clientX - r.left, clientY - r.top)
  }

  private findTargetHandle(
    wx: number, wy: number,
    excludeHandle: { nodeId: string, side: string },
  ): HandlePos | null {
    const hitR = HANDLE_HIT_PX / this.viewport.zoom

    // Allow reconnecting to any handle except the exact one currently connected
    for (const node of this.graph.getNodes()) {
      for (const h of getHandlePositions(node)) {
        if (h.nodeId === excludeHandle.nodeId && h.side === excludeHandle.side) continue
        if (Math.hypot(wx - h.wx, wy - h.wy) <= hitR) return h
      }
    }

    // Body-drop fallback: only for OTHER nodes (ambiguous which port on same node)
    const bodyNode = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy)
    if (!bodyNode || bodyNode.id === excludeHandle.nodeId) return null

    let best: HandlePos | null = null, bestDist = Infinity
    for (const h of getHandlePositions(bodyNode)) {
      const d = Math.hypot(wx - h.wx, wy - h.wy)
      if (d < bestDist) { bestDist = d; best = h }
    }
    return best
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0 || this.disabled) return
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
        const tgt     = nodeMap.get(edge.target)!
        const tgtSide = edge.targetHandle ?? 'left'
        const tgtH    = getHandlePositions(tgt)
        fixedHandle   = tgtH.find(h => h.side === tgtSide) ?? tgtH[0]!
      } else {
        const src     = nodeMap.get(edge.source)!
        const srcSide = edge.sourceHandle ?? 'right'
        const srcH    = getHandlePositions(src)
        fixedHandle   = srcH.find(h => h.side === srcSide) ?? srcH[0]!
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

    const excludeHandle = this.state.movingEnd === 'source'
      ? { nodeId: edge.source, side: edge.sourceHandle ?? 'right' }
      : { nodeId: edge.target, side: edge.targetHandle ?? 'left' }
    const hit = this.findTargetHandle(wx, wy, excludeHandle)

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
