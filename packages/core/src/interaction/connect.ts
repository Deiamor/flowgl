import type { Graph } from '../graph/graph'
import type { NodeData } from '../graph/node'
import type { Viewport } from '../viewport/viewport'
import type { HitTester } from './hit-test'

export type HandleSide = 'top' | 'right' | 'bottom' | 'left' | (string & {})

export interface HandlePos {
  nodeId: string
  side: HandleSide
  wx: number
  wy: number
}

export interface ConnectState {
  hoveredNodeId: string | null
  hoveredHandle: HandlePos | null   // specific handle circle under the cursor (idle)
  connectingFrom: HandlePos | null  // handle the drag started from
  pendingEndWx: number
  pendingEndWy: number
  targetNodeId: string | null
  targetHandle: HandleSide | null   // specific handle on target node during drag
}

// Radius (screen px) within which a handle is "hit"
const HANDLE_HIT_PX = 14

export function getHandlePositions(node: NodeData): HandlePos[] {
  const cx = node.x + node.width  / 2
  const cy = node.y + node.height / 2

  if (node.ports && node.ports.length > 0) {
    return node.ports.map(port => {
      const off = port.offset ?? 0.5
      let wx: number, wy: number
      switch (port.side) {
        case 'left':   wx = node.x;               wy = node.y + off * node.height; break
        case 'right':  wx = node.x + node.width;  wy = node.y + off * node.height; break
        case 'top':    wx = node.x + off * node.width; wy = node.y;                break
        case 'bottom': wx = node.x + off * node.width; wy = node.y + node.height;  break
        default:       wx = node.x + node.width;  wy = cy
      }
      return { nodeId: node.id, side: port.id, wx, wy }
    })
  }

  return [
    { nodeId: node.id, side: 'right',  wx: node.x + node.width, wy: cy },
    { nodeId: node.id, side: 'left',   wx: node.x,               wy: cy },
    { nodeId: node.id, side: 'bottom', wx: cx, wy: node.y + node.height },
    { nodeId: node.id, side: 'top',    wx: cx, wy: node.y },
  ]
}

export class ConnectDrag {
  private canvas: HTMLCanvasElement
  private viewport: Viewport
  private graph: Graph
  private hitTester: HitTester
  private onStateChange: (s: ConnectState) => void
  private onConnect: (
    sourceId: string,
    targetId: string,
    sourceHandle: HandleSide,
    targetHandle: HandleSide,
  ) => void

  private state: ConnectState = {
    hoveredNodeId:  null,
    hoveredHandle:  null,
    connectingFrom: null,
    pendingEndWx:   0,
    pendingEndWy:   0,
    targetNodeId:   null,
    targetHandle:   null,
  }

  private connectTouchId: number | null = null
  private disabled = false

  setDisabled(v: boolean): void { this.disabled = v }

  private readonly onMouseMove:  (e: MouseEvent) => void
  private readonly onMouseDown:  (e: MouseEvent) => void
  private readonly onMouseUp:    (e: MouseEvent) => void
  private readonly onMouseLeave: (e: MouseEvent) => void
  private readonly onTouchStart: (e: TouchEvent) => void
  private readonly onTouchMove:  (e: TouchEvent) => void
  private readonly onTouchEnd:   (e: TouchEvent) => void

  constructor(
    canvas: HTMLCanvasElement,
    viewport: Viewport,
    graph: Graph,
    hitTester: HitTester,
    onStateChange: (s: ConnectState) => void,
    onConnect: (
      sourceId: string,
      targetId: string,
      sourceHandle: HandleSide,
      targetHandle: HandleSide,
    ) => void,
  ) {
    this.canvas        = canvas
    this.viewport      = viewport
    this.graph         = graph
    this.hitTester     = hitTester
    this.onStateChange = onStateChange
    this.onConnect     = onConnect

    this.onMouseMove  = this.handleMouseMove.bind(this)
    this.onMouseDown  = this.handleMouseDown.bind(this)
    this.onMouseUp    = this.handleMouseUp.bind(this)
    this.onMouseLeave = this.handleMouseLeave.bind(this)
    this.onTouchStart = this.handleTouchStart.bind(this)
    this.onTouchMove  = this.handleTouchMove.bind(this)
    this.onTouchEnd   = this.handleTouchEnd.bind(this)

    canvas.addEventListener('mousemove',   this.onMouseMove)
    canvas.addEventListener('mousedown',   this.onMouseDown)
    window.addEventListener('mouseup',     this.onMouseUp)
    canvas.addEventListener('mouseleave',  this.onMouseLeave)
    canvas.addEventListener('touchstart',  this.onTouchStart, { passive: false })
    canvas.addEventListener('touchmove',   this.onTouchMove,  { passive: false })
    canvas.addEventListener('touchend',    this.onTouchEnd,   { passive: false })
    canvas.addEventListener('touchcancel', this.onTouchEnd,   { passive: false })
  }

  isCapturing(): boolean {
    return this.state.connectingFrom !== null
  }

  /** True if the pointer is currently within click range of any handle. */
  isNearHandle(clientX: number, clientY: number): boolean {
    const [wx, wy] = this.toWorld(clientX, clientY)
    return this.findNearestHandle(wx, wy) !== null
  }

  cancel(): void {
    if (!this.state.connectingFrom) return
    this.setState({
      connectingFrom: null,
      pendingEndWx:   0,
      pendingEndWy:   0,
      targetNodeId:   null,
      targetHandle:   null,
    })
    this.canvas.style.cursor = ''
  }

  private toWorld(clientX: number, clientY: number): [number, number] {
    const r = this.canvas.getBoundingClientRect()
    return this.viewport.screenToWorld(clientX - r.left, clientY - r.top)
  }

  /**
   * Find the closest handle across ALL nodes — not just hoveredNode.
   * This is critical: handle circles extend beyond the node AABB, so
   * `findNodeAt` returns null when the cursor is over the protruding half.
   * Searching all handles avoids losing the hovered state in that zone.
   */
  private findNearestHandle(wx: number, wy: number): HandlePos | null {
    const hitR = HANDLE_HIT_PX / this.viewport.zoom
    const nodes = this.graph.getNodes()

    // Check hoveredNodeId first so it wins when multiple nodes overlap
    const ordered = this.state.hoveredNodeId
      ? [
          ...nodes.filter(n => n.id === this.state.hoveredNodeId),
          ...nodes.filter(n => n.id !== this.state.hoveredNodeId),
        ]
      : nodes

    for (const node of ordered) {
      for (const h of getHandlePositions(node)) {
        if (Math.hypot(wx - h.wx, wy - h.wy) <= hitR) return h
      }
    }
    return null
  }

  /**
   * During connection drag: find the target handle to snap to.
   * Priority: handle hit radius on any non-source node → nearest handle on node body.
   * Returns the snap point so `pendingEndWx/Wy` can be updated.
   */
  private findTargetHandle(
    wx: number,
    wy: number,
    sourceNodeId: string,
  ): HandlePos | null {
    const hitR = HANDLE_HIT_PX / this.viewport.zoom

    // 1. Cursor within handle hit radius on any non-source node
    for (const node of this.graph.getNodes()) {
      if (node.id === sourceNodeId) continue
      for (const h of getHandlePositions(node)) {
        if (Math.hypot(wx - h.wx, wy - h.wy) <= hitR) return h
      }
    }

    // 2. Cursor inside node body → snap to geometrically nearest handle
    const targetNode = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy)
    if (!targetNode || targetNode.id === sourceNodeId) return null
    return this.nearestHandleOnNode(targetNode, wx, wy)
  }

  /** Returns the handle on `node` whose world position is closest to (wx, wy). */
  private nearestHandleOnNode(node: NodeData, wx: number, wy: number): HandlePos {
    let best: HandlePos | null = null
    let bestDist = Infinity
    for (const h of getHandlePositions(node)) {
      const d = Math.hypot(wx - h.wx, wy - h.wy)
      if (d < bestDist) { bestDist = d; best = h }
    }
    return best!
  }

  private setState(patch: Partial<ConnectState>): void {
    this.state = { ...this.state, ...patch }
    this.onStateChange(this.state)
  }

  private handleMouseMove(e: MouseEvent): void {
    const [wx, wy] = this.toWorld(e.clientX, e.clientY)

    // ── While dragging a connection ─────────────────────────────────
    if (this.state.connectingFrom) {
      const sourceNodeId = this.state.connectingFrom.nodeId
      const hit = this.findTargetHandle(wx, wy, sourceNodeId)

      this.setState({
        pendingEndWx: hit ? hit.wx : wx,
        pendingEndWy: hit ? hit.wy : wy,
        targetNodeId: hit ? hit.nodeId : null,
        targetHandle: hit ? hit.side  : null,
      })
      return
    }

    // ── Idle: compute hovered node + hovered handle ─────────────────
    const bodyNode   = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy)
    const nearHandle = this.findNearestHandle(wx, wy)

    // Handle zone can be outside the node body → prefer handle's node
    const newHoverId = nearHandle?.nodeId ?? bodyNode?.id ?? null

    this.canvas.style.cursor = nearHandle ? 'crosshair' : ''

    if (
      newHoverId          !== this.state.hoveredNodeId ||
      nearHandle?.side    !== this.state.hoveredHandle?.side ||
      nearHandle?.nodeId  !== this.state.hoveredHandle?.nodeId
    ) {
      this.setState({ hoveredNodeId: newHoverId, hoveredHandle: nearHandle ?? null })
    }
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0 || this.disabled) return
    // Use the already-tracked hoveredHandle — avoids re-computation lag
    const handle = this.state.hoveredHandle
    if (!handle) return
    e.stopPropagation()
    const [wx, wy] = this.toWorld(e.clientX, e.clientY)
    this.setState({
      connectingFrom: handle,
      pendingEndWx:   wx,
      pendingEndWy:   wy,
      targetNodeId:   null,
      targetHandle:   null,
    })
    this.canvas.style.cursor = 'crosshair'
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.state.connectingFrom) return
    const from = this.state.connectingFrom

    // targetHandle is already tracked in state (updated every mousemove)
    const targetId     = this.state.targetNodeId
    const targetHandle = this.state.targetHandle

    this.setState({
      connectingFrom: null,
      pendingEndWx:   0,
      pendingEndWy:   0,
      targetNodeId:   null,
      targetHandle:   null,
      hoveredNodeId:  targetId ?? null,
      hoveredHandle:  null,
    })
    this.canvas.style.cursor = ''

    if (targetId && targetHandle) {
      this.onConnect(from.nodeId, targetId, from.side, targetHandle)
    }
  }

  private handleMouseLeave(): void {
    if (this.state.connectingFrom) return   // keep connection active
    if (this.state.hoveredNodeId || this.state.hoveredHandle) {
      this.setState({ hoveredNodeId: null, hoveredHandle: null })
      this.canvas.style.cursor = ''
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    if (this.disabled || this.connectTouchId !== null || e.touches.length !== 1) return
    const touch = e.touches[0]!
    const [wx, wy] = this.toWorld(touch.clientX, touch.clientY)
    const handle = this.findNearestHandle(wx, wy)
    if (!handle) return
    e.preventDefault()
    e.stopPropagation()
    this.connectTouchId = touch.identifier
    this.setState({
      connectingFrom: handle,
      pendingEndWx:   wx,
      pendingEndWy:   wy,
      targetNodeId:   null,
      targetHandle:   null,
    })
    this.canvas.style.cursor = 'crosshair'
  }

  private handleTouchMove(e: TouchEvent): void {
    if (this.connectTouchId === null || !this.state.connectingFrom) return
    const touch = Array.from(e.changedTouches).find(t => t.identifier === this.connectTouchId)
    if (!touch) return
    e.preventDefault()
    const [wx, wy] = this.toWorld(touch.clientX, touch.clientY)
    const sourceNodeId = this.state.connectingFrom.nodeId
    const hit = this.findTargetHandle(wx, wy, sourceNodeId)
    this.setState({
      pendingEndWx: hit ? hit.wx : wx,
      pendingEndWy: hit ? hit.wy : wy,
      targetNodeId: hit ? hit.nodeId : null,
      targetHandle: hit ? hit.side  : null,
    })
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (this.connectTouchId === null || !this.state.connectingFrom) return
    const touch = Array.from(e.changedTouches).find(t => t.identifier === this.connectTouchId)
    if (!touch) return
    const from         = this.state.connectingFrom
    const targetId     = this.state.targetNodeId
    const targetHandle = this.state.targetHandle
    this.connectTouchId = null
    this.setState({
      connectingFrom: null,
      pendingEndWx:   0,
      pendingEndWy:   0,
      targetNodeId:   null,
      targetHandle:   null,
    })
    this.canvas.style.cursor = ''
    if (targetId && targetHandle) {
      this.onConnect(from.nodeId, targetId, from.side, targetHandle)
    }
  }

  dispose(): void {
    this.canvas.removeEventListener('mousemove',   this.onMouseMove)
    this.canvas.removeEventListener('mousedown',   this.onMouseDown)
    window.removeEventListener('mouseup',          this.onMouseUp)
    this.canvas.removeEventListener('mouseleave',  this.onMouseLeave)
    this.canvas.removeEventListener('touchstart',  this.onTouchStart)
    this.canvas.removeEventListener('touchmove',   this.onTouchMove)
    this.canvas.removeEventListener('touchend',    this.onTouchEnd)
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd)
  }
}
