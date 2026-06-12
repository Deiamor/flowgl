import type { Graph } from '../graph/graph'
import type { Viewport } from '../viewport/viewport'
import type { NodeData } from '../graph/node'
import type { EdgeData } from '../graph/edge'

/**
 * Proximity Connect — during a node drag, if the dragged node's bbox sits
 * within `threshold` world units of another node's bbox, the layer marks
 * the closest such node as the *suggested target* and renders a ghost
 * line from the dragged node's center to the target's center. On drag end
 * the chart promotes the suggestion into a real edge (assuming the
 * connection passes `onBeforeConnect`).
 *
 * No event listeners — purely driven by the chart's drag callbacks.
 */
export interface ProximityConnectOptions {
  enabled?: boolean
  /** Max bbox-to-bbox distance in world units. Default: 80. */
  threshold?: number
  /** Generator for the new edge id. Default: `prox-<random>`. */
  generateEdgeId?: () => string
}

const DEFAULT_OPTS: Required<ProximityConnectOptions> = {
  enabled: false,
  threshold: 80,
  generateEdgeId: () => `prox-${Math.random().toString(36).slice(2, 10)}`,
}

const STYLE_TAG_ID = 'flowgl-proximity-style'
const STYLE_CSS = `
.flowgl-proximity-ghost{position:absolute;pointer-events:none;z-index:24;border-top:2px dashed #14b8a6;transform-origin:0 50%;}
.flowgl-proximity-halo{position:absolute;pointer-events:none;z-index:24;border:2px solid #14b8a6;border-radius:8px;box-shadow:0 0 0 6px rgba(20,184,166,.2);}
`

function ensureStyleTag(container: HTMLElement) {
  const doc = container.ownerDocument
  if (!doc) return
  if (doc.getElementById(STYLE_TAG_ID)) return
  const tag = doc.createElement('style')
  tag.id = STYLE_TAG_ID
  tag.textContent = STYLE_CSS
  doc.head?.appendChild(tag)
}

export class ProximityConnectLayer {
  private readonly container: HTMLElement
  private readonly viewport: Viewport
  private readonly graph: Graph
  private opts: Required<ProximityConnectOptions>
  private activeDragId: string | null = null
  private ghost: HTMLDivElement | null = null
  private halo: HTMLDivElement | null = null
  private currentTargetId: string | null = null

  constructor(container: HTMLElement, viewport: Viewport, graph: Graph, options?: ProximityConnectOptions) {
    this.container = container
    this.viewport = viewport
    this.graph = graph
    this.opts = { ...DEFAULT_OPTS, ...options }
    ensureStyleTag(container)
    const pos = getComputedStyle(container).position
    if (pos === 'static' || pos === '') container.style.position = 'relative'
  }

  setOptions(partial: ProximityConnectOptions): void { this.opts = { ...this.opts, ...partial } }
  getOptions(): Required<ProximityConnectOptions> { return { ...this.opts } }

  begin(dragId: string): void { this.activeDragId = dragId }

  /** Returns the suggested target id (null if none) — call after each drag move. */
  notifyMove(): string | null {
    if (!this.opts.enabled || !this.activeDragId) { this.clearVisuals(); return null }
    const dragNode = this.graph.getNode(this.activeDragId)
    if (!dragNode) { this.clearVisuals(); return null }
    const candidate = this.findNearestWithinThreshold(dragNode)
    this.currentTargetId = candidate?.id ?? null
    if (candidate) this.renderVisuals(dragNode, candidate)
    else this.clearVisuals()
    return this.currentTargetId
  }

  /**
   * Drag is finishing — return the suggested target so the chart can route
   * it through `onBeforeConnect` and create the edge. Then clears visuals.
   */
  end(): string | null {
    const target = this.currentTargetId
    this.activeDragId = null
    this.currentTargetId = null
    this.clearVisuals()
    return target
  }

  private clearVisuals(): void {
    if (this.ghost) { this.ghost.remove(); this.ghost = null }
    if (this.halo)  { this.halo.remove();  this.halo  = null }
  }

  private findNearestWithinThreshold(dragNode: NodeData): NodeData | null {
    const t = this.opts.threshold
    let best: NodeData | null = null
    let bestDist = Infinity
    for (const other of this.graph.getNodes()) {
      if (other.id === dragNode.id) continue
      if (other.id === dragNode.parentId) continue
      if (dragNode.parentId && other.parentId === dragNode.parentId && false) continue // siblings allowed
      // Skip if an edge already connects the two (either direction).
      if (this.edgeExists(dragNode.id, other.id)) continue
      const d = bboxDistance(dragNode, other)
      if (d <= t && d < bestDist) { bestDist = d; best = other }
    }
    return best
  }

  private edgeExists(a: string, b: string): boolean {
    for (const e of this.graph.getEdges() as EdgeData[]) {
      if ((e.source === a && e.target === b) || (e.source === b && e.target === a)) return true
    }
    return false
  }

  private renderVisuals(drag: NodeData, target: NodeData): void {
    const dragCx = drag.x + drag.width / 2
    const dragCy = drag.y + drag.height / 2
    const tgtCx  = target.x + target.width / 2
    const tgtCy  = target.y + target.height / 2

    const [sx, sy] = this.viewport.worldToScreen(dragCx, dragCy)
    const [ex, ey] = this.viewport.worldToScreen(tgtCx, tgtCy)
    const len = Math.hypot(ex - sx, ey - sy)
    const angle = Math.atan2(ey - sy, ex - sx)

    if (!this.ghost) {
      this.ghost = document.createElement('div')
      this.ghost.className = 'flowgl-proximity-ghost'
      this.ghost.setAttribute('data-flowgl-proximity-ghost', '')
      this.container.appendChild(this.ghost)
    }
    this.ghost.style.left = `${sx}px`
    this.ghost.style.top  = `${sy}px`
    this.ghost.style.width  = `${len}px`
    this.ghost.style.transform = `rotate(${angle}rad)`

    if (!this.halo) {
      this.halo = document.createElement('div')
      this.halo.className = 'flowgl-proximity-halo'
      this.halo.setAttribute('data-flowgl-proximity-halo', '')
      this.container.appendChild(this.halo)
    }
    const [tx, ty] = this.viewport.worldToScreen(target.x, target.y)
    const [tx2, ty2] = this.viewport.worldToScreen(target.x + target.width, target.y + target.height)
    this.halo.style.left   = `${tx}px`
    this.halo.style.top    = `${ty}px`
    this.halo.style.width  = `${tx2 - tx}px`
    this.halo.style.height = `${ty2 - ty}px`
  }

  dispose(): void {
    this.clearVisuals()
    this.activeDragId = null
    this.currentTargetId = null
  }
}

function bboxDistance(a: NodeData, b: NodeData): number {
  const ax2 = a.x + a.width,  ay2 = a.y + a.height
  const bx2 = b.x + b.width,  by2 = b.y + b.height
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(ax2, bx2))
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(ay2, by2))
  return Math.hypot(dx, dy)
}
