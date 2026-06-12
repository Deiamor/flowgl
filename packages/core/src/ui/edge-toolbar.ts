import type { Viewport } from '../viewport/viewport'
import type { Graph } from '../graph/graph'
import { edgeMidpoint, edgePathPoints } from '../renderer/webgl/util/edge-geometry'

function pointAtFraction(pts: [number, number][], t: number): [number, number] {
  if (pts.length < 2) return pts[0] ?? [0, 0]
  let total = 0
  const seg = new Array<number>(pts.length - 1)
  for (let i = 0; i + 1 < pts.length; i++) {
    seg[i] = Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1])
    total += seg[i]!
  }
  if (total === 0) return pts[0]!
  const target = total * Math.max(0, Math.min(1, t))
  let cum = 0
  for (let i = 0; i < seg.length; i++) {
    const next = cum + seg[i]!
    if (next >= target) {
      const f = (target - cum) / (seg[i] || 1)
      const a = pts[i]!, b = pts[i + 1]!
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
    }
    cum = next
  }
  return pts[pts.length - 1]!
}

export type EdgeToolbarAlign = 'above' | 'below' | 'inline'

export interface EdgeToolbarSpec {
  /** Which edge this toolbar belongs to. */
  edgeId: string
  /**
   * Vertical placement relative to the midpoint.
   *   - `'above'` (default) — sits above the edge by `offset` screen pixels
   *   - `'below'` — sits below by `offset`
   *   - `'inline'` — centered on the midpoint
   */
  align?: EdgeToolbarAlign
  /** Screen-pixel distance from the midpoint. Constant under zoom. Default: 12. */
  offset?: number
  /** Where along the edge to anchor (0 = source end, 1 = target end). Default: 0.5. */
  t?: number
  /**
   * Visibility policy:
   *   - `'auto'` (default): visible iff the edge is in the current selection
   *   - `true`: always visible while the edge exists
   *   - `false`: never visible
   */
  isVisible?: boolean | 'auto'
  /** Toolbar content. String → innerHTML (sanitized via chart hook); HTMLElement → appended. */
  content: HTMLElement | string
  /** Custom inline class. */
  className?: string
}

interface MountedToolbar extends EdgeToolbarSpec {
  id: string
  el: HTMLDivElement
}

const STYLE_TAG_ID = 'flowgl-edge-toolbar-style'
const STYLE_CSS = `
.flowgl-edge-toolbar{position:absolute;display:inline-flex;background:rgba(255,255,255,.96);backdrop-filter:blur(6px);border:1px solid rgba(15,23,42,.08);border-radius:6px;padding:3px;box-shadow:0 4px 10px rgba(15,23,42,.1);gap:2px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;pointer-events:auto;z-index:40;user-select:none;}
.flowgl-edge-toolbar[data-visible="false"]{display:none;}
.flowgl-edge-toolbar button{appearance:none;border:none;background:transparent;color:#334155;cursor:pointer;border-radius:4px;padding:4px 8px;font:inherit;}
.flowgl-edge-toolbar button:hover{background:rgba(99,102,241,.1);color:#1e293b;}
.flowgl-edge-toolbar button:focus-visible{outline:2px solid #6366f1;outline-offset:2px;}
@media (prefers-color-scheme: dark){
.flowgl-edge-toolbar{background:rgba(30,41,59,.92);border-color:rgba(241,245,249,.1);box-shadow:0 4px 10px rgba(0,0,0,.4);}
.flowgl-edge-toolbar button{color:#cbd5e1;}
.flowgl-edge-toolbar button:hover{background:rgba(129,140,248,.18);color:#f1f5f9;}
}
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

let toolbarSeq = 0

/**
 * Floating, edge-anchored toolbar. Pixel size is constant under zoom — same
 * contract as `NodeToolbar`. The anchor is the straight-line midpoint
 * between the edge's source and target node centers (the same heuristic
 * `EdgeLabel` uses; visually close enough to the actual Bezier midpoint that
 * users do not notice, and cheap to compute every frame).
 */
export class EdgeToolbarLayer {
  private readonly container: HTMLElement
  private readonly viewport: Viewport
  private readonly graph: Graph
  private readonly sanitizeHtml: ((s: string) => string) | undefined
  private toolbars = new Map<string, MountedToolbar>()
  private selectedEdgeIds: Set<string> = new Set()

  constructor(
    container: HTMLElement,
    viewport: Viewport,
    graph: Graph,
    sanitizeHtml?: (s: string) => string,
  ) {
    this.container = container
    this.viewport = viewport
    this.graph = graph
    this.sanitizeHtml = sanitizeHtml
    ensureStyleTag(container)
    const pos = getComputedStyle(container).position
    if (pos === 'static' || pos === '') container.style.position = 'relative'
  }

  /** Forwarded from FlowChart on selectionChange. */
  setSelection(edgeIds: Iterable<string>): void {
    this.selectedEdgeIds = new Set(edgeIds)
    this.reposition()
  }

  add(spec: EdgeToolbarSpec): string {
    const id = `flowgl-edge-toolbar-${++toolbarSeq}`
    const el = document.createElement('div')
    el.className = 'flowgl-edge-toolbar'
    el.setAttribute('role', 'toolbar')
    el.setAttribute('data-flowgl-edge-toolbar', id)
    if (spec.className) {
      el.className += ' ' + spec.className.replace(/[^A-Za-z0-9_\- ]/g, '')
    }
    if (typeof spec.content === 'string') {
      const html = this.sanitizeHtml ? this.sanitizeHtml(spec.content) : spec.content
      el.innerHTML = html
    } else {
      el.appendChild(spec.content)
    }
    this.container.appendChild(el)
    this.toolbars.set(id, { ...spec, id, el })
    this.repositionOne(id)
    return id
  }

  update(id: string, partial: Partial<Omit<EdgeToolbarSpec, 'edgeId'>>): boolean {
    const t = this.toolbars.get(id)
    if (!t) return false
    if (partial.align) t.align = partial.align
    if (partial.offset != null) t.offset = partial.offset
    if (partial.t != null) t.t = partial.t
    if (partial.isVisible !== undefined) t.isVisible = partial.isVisible
    if (partial.content !== undefined) {
      if (typeof partial.content === 'string') {
        const html = this.sanitizeHtml ? this.sanitizeHtml(partial.content) : partial.content
        t.el.innerHTML = html
      } else {
        while (t.el.firstChild) t.el.removeChild(t.el.firstChild)
        t.el.appendChild(partial.content)
      }
    }
    if (partial.className) {
      t.el.className = 'flowgl-edge-toolbar ' + partial.className.replace(/[^A-Za-z0-9_\- ]/g, '')
    }
    this.repositionOne(id)
    return true
  }

  remove(id: string): boolean {
    const t = this.toolbars.get(id)
    if (!t) return false
    t.el.remove()
    this.toolbars.delete(id)
    return true
  }

  list(): string[] { return Array.from(this.toolbars.keys()) }

  reposition(): void {
    for (const id of this.toolbars.keys()) this.repositionOne(id)
  }

  private decideVisibility(spec: EdgeToolbarSpec, edgeExists: boolean): boolean {
    if (spec.isVisible === false) return false
    if (spec.isVisible === true) return edgeExists
    if (!edgeExists) return false
    return this.selectedEdgeIds.has(spec.edgeId)
  }

  private repositionOne(id: string): void {
    const t = this.toolbars.get(id)
    if (!t) return
    const edge = this.graph.getEdge(t.edgeId)
    if (!edge) { t.el.setAttribute('data-visible', 'false'); return }
    const src = this.graph.getNode(edge.source)
    const tgt = this.graph.getNode(edge.target)
    if (!src || !tgt) { t.el.setAttribute('data-visible', 'false'); return }

    const visible = this.decideVisibility(t, true)
    t.el.setAttribute('data-visible', visible ? 'true' : 'false')
    if (!visible) return

    // Anchor at the rendered-path midpoint (or arc-length fraction `t`).
    // Pre-0.8.1 this used the straight line between node centers, which
    // drifted off the visible polyline for step/smoothstep/waypoint edges.
    let wx: number, wy: number
    const tt = t.t
    if (tt == null || tt === 0.5) {
      const [mx, my] = edgeMidpoint(edge, src, tgt)
      wx = mx; wy = my
    } else {
      const pts = edgePathPoints(edge, src, tgt)
      const point = pointAtFraction(pts, tt)
      wx = point[0]; wy = point[1]
    }

    const [px, py] = this.viewport.worldToScreen(wx, wy)
    const align = t.align ?? 'above'
    const offset = t.offset ?? 12
    let dy = 0
    if (align === 'above') dy = -offset
    else if (align === 'below') dy = offset

    t.el.style.left = `${px}px`
    t.el.style.top  = `${py + dy}px`
    // For 'above', anchor the bottom of the toolbar at (px, py + dy).
    // For 'below', anchor the top. For 'inline', center.
    if (align === 'above') t.el.style.transform = 'translate(-50%, -100%)'
    else if (align === 'below') t.el.style.transform = 'translate(-50%, 0%)'
    else t.el.style.transform = 'translate(-50%, -50%)'
  }

  dispose(): void {
    for (const t of Array.from(this.toolbars.values())) t.el.remove()
    this.toolbars.clear()
  }
}
