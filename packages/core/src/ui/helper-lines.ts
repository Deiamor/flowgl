import type { Graph } from '../graph/graph'
import type { Viewport } from '../viewport/viewport'

/**
 * Alignment thresholds in **world units**. Snap happens when a candidate
 * coordinate is within `snap` of the dragged node's candidate. Guide lines
 * appear within `show` (must be ≥ `snap`). The two thresholds are kept
 * separate so the guide can preview an upcoming snap without already
 * teleporting the node.
 *
 * Defaults assume zoom 1; on lower zoom the world threshold maps to fewer
 * screen pixels (visually feels tighter) — by design, since at zoom < 1
 * users are looking at the whole graph and care more about coarse
 * alignment.
 */
export interface HelperLinesOptions {
  enabled?: boolean
  snap?: number
  show?: number
}

const DEFAULT_OPTS: Required<HelperLinesOptions> = {
  enabled: true,
  snap: 5,
  show: 10,
}

interface GuideLine {
  /** Orientation. */
  axis: 'v' | 'h'
  /** World coordinate of the guide line. */
  coord: number
  /** World start/end of the guide span (covers both bbox + match endpoints). */
  start: number
  end: number
}

const STYLE_TAG_ID = 'flowgl-helper-lines-style'
const STYLE_CSS = `
.flowgl-helper-line{position:absolute;background:#ec4899;pointer-events:none;z-index:25;}
.flowgl-helper-line[data-axis="v"]{width:1px;}
.flowgl-helper-line[data-axis="h"]{height:1px;}
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

/**
 * Figma-style alignment guides shown during a node drag. Snaps the dragged
 * node's left / center / right (and top / center / bottom) to matching
 * coordinates of every other node when within threshold.
 *
 * Lifecycle:
 *   - FlowChart constructs one layer per chart, after the WebGL gate.
 *   - drag.ts's onStart calls `begin(id)`; chartside applies the snap by
 *     intercepting onMove via `applySnap(nx, ny)`; onEnd calls `end()`.
 *   - The layer renders guide DIVs into the chart container while active
 *     and tears them down on `end()` / `dispose()`.
 */
export class HelperLinesLayer {
  private readonly container: HTMLElement
  private readonly viewport: Viewport
  private readonly graph: Graph
  private opts: Required<HelperLinesOptions>
  private activeDragId: string | null = null
  private lines: HTMLDivElement[] = []

  constructor(container: HTMLElement, viewport: Viewport, graph: Graph, options?: HelperLinesOptions) {
    this.container = container
    this.viewport = viewport
    this.graph = graph
    this.opts = { ...DEFAULT_OPTS, ...options }
    ensureStyleTag(container)
    const pos = getComputedStyle(container).position
    if (pos === 'static' || pos === '') container.style.position = 'relative'
  }

  setOptions(partial: HelperLinesOptions): void {
    this.opts = { ...this.opts, ...partial }
  }

  getOptions(): Required<HelperLinesOptions> { return { ...this.opts } }

  isActive(): boolean { return this.activeDragId !== null }

  begin(dragId: string): void {
    this.activeDragId = dragId
  }

  end(): void {
    this.activeDragId = null
    this.clearLines()
  }

  /**
   * Compute the snapped coords for the dragged node and update the rendered
   * guide lines. Returns the (possibly snapped) coordinates. When the layer
   * is disabled or no candidate is in threshold the input is returned
   * unchanged.
   */
  applySnap(nx: number, ny: number): [number, number] {
    if (!this.opts.enabled || this.activeDragId == null) return [nx, ny]
    const dragNode = this.graph.getNode(this.activeDragId)
    if (!dragNode) return [nx, ny]

    const w = dragNode.width
    const h = dragNode.height
    // Candidate world coordinates on the dragged node (left/center/right + top/center/bottom).
    const xCands = [nx, nx + w / 2, nx + w]
    const yCands = [ny, ny + h / 2, ny + h]

    let bestXDelta = 0, bestXAbs = Infinity, bestXMatchCoord = 0, bestXNodeId: string | null = null, bestXAxisIdx = -1
    let bestYDelta = 0, bestYAbs = Infinity, bestYMatchCoord = 0, bestYNodeId: string | null = null, bestYAxisIdx = -1

    for (const other of this.graph.getNodes()) {
      if (other.id === dragNode.id) continue
      if (other.id === dragNode.parentId) continue
      const oxCands = [other.x, other.x + other.width / 2, other.x + other.width]
      const oyCands = [other.y, other.y + other.height / 2, other.y + other.height]
      for (let i = 0; i < xCands.length; i++) {
        for (let j = 0; j < oxCands.length; j++) {
          const d = oxCands[j]! - xCands[i]!
          const a = Math.abs(d)
          if (a < bestXAbs) { bestXAbs = a; bestXDelta = d; bestXMatchCoord = oxCands[j]!; bestXNodeId = other.id; bestXAxisIdx = i }
        }
      }
      for (let i = 0; i < yCands.length; i++) {
        for (let j = 0; j < oyCands.length; j++) {
          const d = oyCands[j]! - yCands[i]!
          const a = Math.abs(d)
          if (a < bestYAbs) { bestYAbs = a; bestYDelta = d; bestYMatchCoord = oyCands[j]!; bestYNodeId = other.id; bestYAxisIdx = i }
        }
      }
    }

    const guides: GuideLine[] = []

    let outX = nx
    if (bestXNodeId && bestXAbs <= this.opts.snap) outX = nx + bestXDelta
    if (bestXNodeId && bestXAbs <= this.opts.show) {
      const other = this.graph.getNode(bestXNodeId)!
      const top    = Math.min(outX === nx ? ny : ny, other.y)
      const bottom = Math.max((outX === nx ? ny : ny) + h, other.y + other.height)
      guides.push({ axis: 'v', coord: bestXMatchCoord, start: top, end: bottom })
    }
    let outY = ny
    if (bestYNodeId && bestYAbs <= this.opts.snap) outY = ny + bestYDelta
    if (bestYNodeId && bestYAbs <= this.opts.show) {
      const other = this.graph.getNode(bestYNodeId)!
      const left  = Math.min(outX, other.x)
      const right = Math.max(outX + w, other.x + other.width)
      guides.push({ axis: 'h', coord: bestYMatchCoord, start: left, end: right })
    }

    // suppress unused
    void bestXAxisIdx; void bestYAxisIdx
    this.renderGuides(guides)
    return [outX, outY]
  }

  private clearLines(): void {
    for (const el of this.lines) el.remove()
    this.lines.length = 0
  }

  private renderGuides(guides: GuideLine[]): void {
    this.clearLines()
    for (const g of guides) {
      const el = document.createElement('div')
      el.className = 'flowgl-helper-line'
      el.setAttribute('data-axis', g.axis)
      if (g.axis === 'v') {
        const [sx, sy] = this.viewport.worldToScreen(g.coord, g.start)
        const [, ey]   = this.viewport.worldToScreen(g.coord, g.end)
        el.style.left = `${sx}px`
        el.style.top  = `${sy}px`
        el.style.height = `${Math.max(1, ey - sy)}px`
      } else {
        const [sx, sy] = this.viewport.worldToScreen(g.start, g.coord)
        const [ex]     = this.viewport.worldToScreen(g.end, g.coord)
        el.style.left = `${sx}px`
        el.style.top  = `${sy}px`
        el.style.width = `${Math.max(1, ex - sx)}px`
      }
      this.container.appendChild(el)
      this.lines.push(el)
    }
  }

  dispose(): void {
    this.clearLines()
    this.activeDragId = null
  }
}
