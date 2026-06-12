import type { Graph } from '../graph/graph'
import type { Viewport } from '../viewport/viewport'
import type { EdgeData } from '../graph/edge'
import { handleXY } from '../renderer/webgl/util/handle-xy'
import { edgeControlPoints, cubicBezierPoint } from '../renderer/webgl/util/bezier'

const HIT_PX          = 10  // screen px radius to hit a waypoint handle
const MIDPOINT_HIT_PX = 8   // screen px radius to create a new waypoint from midpoint

type WaypointDragState = {
  edgeId:     string
  index:      number           // index in edge.waypoints array; -1 = new from midpoint
  insertAt:   number           // only used when index === -1
}

export class EdgeWaypoint {
  private canvas:   HTMLCanvasElement
  private viewport: Viewport
  private graph:    Graph
  private getSelectedEdgeIds: () => Set<string>
  private onChange: () => void

  private dragging: WaypointDragState | null = null

  private readonly onMouseDown: (e: MouseEvent) => void
  private readonly onMouseMove: (e: MouseEvent) => void
  private readonly onMouseUp:   (e: MouseEvent) => void

  constructor(
    canvas:   HTMLCanvasElement,
    viewport: Viewport,
    graph:    Graph,
    getSelectedEdgeIds: () => Set<string>,
    onChange: () => void,
  ) {
    this.canvas   = canvas
    this.viewport = viewport
    this.graph    = graph
    this.getSelectedEdgeIds = getSelectedEdgeIds
    this.onChange = onChange

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

  private toScreen(wx: number, wy: number): [number, number] {
    return this.viewport.worldToScreen(wx, wy)
  }

  /**
   * Midpoints of each segment between consecutive control points (source
   * handle, existing waypoints, target handle). These are the "drag
   * handles" the user grabs to insert a new waypoint. The control points
   * are read from the same source-of-truth as every other edge consumer
   * (`edge-geometry` resolves the default handles to `'right'`/`'left'`),
   * so a click on the visible midpoint hits this hit-test instead of a
   * phantom point past the visible curve.
   *
   * For the bezier branch we use only the source + target handles + any
   * existing waypoints (NOT the sampled curve points), because the user
   * is grabbing logical insert positions — at high curvature these still
   * sit slightly off the visible bezier, but inserting a waypoint at the
   * straight-segment midpoint is the right UX intent.
   */
  private getEdgeMidpoints(edge: EdgeData): { x: number; y: number; insertAt: number }[] {
    const nodeMap = new Map(this.graph.getNodes().map(n => [n.id, n]))
    const src = nodeMap.get(edge.source)
    const tgt = nodeMap.get(edge.target)
    if (!src || !tgt) return []

    // Use the renderer-aligned defaults for unspecified handles.
    const [sx, sy] = handleXY(src, edge.sourceHandle ?? 'right')
    const [ex, ey] = handleXY(tgt, edge.targetHandle ?? 'left')
    const wpts = edge.waypoints ?? []
    const pts: [number, number][] = [[sx, sy], ...wpts.map(w => [w.x, w.y] as [number, number]), [ex, ey]]
    const mids: { x: number; y: number; insertAt: number }[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      mids.push({ x: (pts[i]![0] + pts[i + 1]![0]) / 2, y: (pts[i]![1] + pts[i + 1]![1]) / 2, insertAt: i + 1 })
    }
    return mids
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return
    const selectedEdgeIds = this.getSelectedEdgeIds()
    if (selectedEdgeIds.size === 0) return
    const [wx, wy] = this.toWorld(e.clientX, e.clientY)
    const zoom = this.viewport.zoom
    const hitR  = HIT_PX / zoom
    const midR  = MIDPOINT_HIT_PX / zoom

    for (const edgeId of selectedEdgeIds) {
      const edge = this.graph.getEdge(edgeId)
      if (!edge) continue

      // Check existing waypoints first
      const wpts = edge.waypoints ?? []
      for (let i = 0; i < wpts.length; i++) {
        const w = wpts[i]!
        if (Math.hypot(wx - w.x, wy - w.y) <= hitR) {
          e.stopPropagation()
          this.dragging = { edgeId, index: i, insertAt: i }
          return
        }
      }

      // Check midpoints for new waypoint creation
      const mids = this.getEdgeMidpoints(edge)
      for (const mid of mids) {
        if (Math.hypot(wx - mid.x, wy - mid.y) <= midR) {
          e.stopPropagation()
          // Insert new waypoint at mid position
          const newWpts = [...wpts]
          newWpts.splice(mid.insertAt - 1, 0, { x: mid.x, y: mid.y })
          this.updateEdgeWaypoints(edgeId, newWpts)
          this.dragging = { edgeId, index: mid.insertAt - 1, insertAt: mid.insertAt - 1 }
          return
        }
      }
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.dragging) return
    const [wx, wy] = this.toWorld(e.clientX, e.clientY)
    const edge = this.graph.getEdge(this.dragging.edgeId)
    if (!edge) { this.dragging = null; return }
    const wpts = [...(edge.waypoints ?? [])]
    wpts[this.dragging.index] = { x: wx, y: wy }
    this.updateEdgeWaypoints(this.dragging.edgeId, wpts)
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.dragging) return
    // Double-click on waypoint would be handled separately; single release finishes drag
    this.dragging = null
  }

  private updateEdgeWaypoints(edgeId: string, waypoints: { x: number; y: number }[]): void {
    this.graph.updateEdge(edgeId, { waypoints })
    this.onChange()
  }

  /** Remove a waypoint by world-coordinate proximity (for right-click or double-click). */
  removeWaypointAt(edgeId: string, wx: number, wy: number): boolean {
    const edge = this.graph.getEdge(edgeId)
    if (!edge?.waypoints) return false
    const hitR = HIT_PX / this.viewport.zoom
    const idx = edge.waypoints.findIndex(w => Math.hypot(wx - w.x, wy - w.y) <= hitR)
    if (idx < 0) return false
    const newWpts = edge.waypoints.filter((_, i) => i !== idx)
    this.updateEdgeWaypoints(edgeId, newWpts.length > 0 ? newWpts : [])
    return true
  }

  /** Returns waypoint screen positions for all selected edges (for overlay rendering). */
  getWaypointHandles(): { edgeId: string; wx: number; wy: number; isMid: boolean }[] {
    const result: { edgeId: string; wx: number; wy: number; isMid: boolean }[] = []
    for (const edgeId of this.getSelectedEdgeIds()) {
      const edge = this.graph.getEdge(edgeId)
      if (!edge) continue
      for (const w of edge.waypoints ?? []) {
        result.push({ edgeId, wx: w.x, wy: w.y, isMid: false })
      }
      for (const m of this.getEdgeMidpoints(edge)) {
        result.push({ edgeId, wx: m.x, wy: m.y, isMid: true })
      }
    }
    return result
  }

  isCapturing(): boolean { return this.dragging !== null }

  /**
   * Returns true when (clientX, clientY) is over a waypoint handle or
   * midpoint hit area for any selected edge. Other interaction layers
   * (PanZoom) use this in their `shouldBlock` predicate so they do not
   * fire a competing pan when the user is about to grab a waypoint.
   * Pre-0.8.1 PanZoom did not check this — concurrent panning shifted
   * the viewport so the world coords seen by the waypoint drag never
   * moved, freezing the dragged waypoint at its insert position.
   */
  isNearMidpoint(clientX: number, clientY: number): boolean {
    const selected = this.getSelectedEdgeIds()
    if (selected.size === 0) return false
    const [wx, wy] = this.toWorld(clientX, clientY)
    const zoom = this.viewport.zoom
    const hitR = HIT_PX / zoom
    const midR = MIDPOINT_HIT_PX / zoom
    for (const edgeId of selected) {
      const edge = this.graph.getEdge(edgeId)
      if (!edge) continue
      for (const w of edge.waypoints ?? []) {
        if (Math.hypot(wx - w.x, wy - w.y) <= hitR) return true
      }
      const mids = this.getEdgeMidpoints(edge)
      for (const mid of mids) {
        if (Math.hypot(wx - mid.x, wy - mid.y) <= midR) return true
      }
    }
    return false
  }

  dispose(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup',   this.onMouseUp)
  }
}
