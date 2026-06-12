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

export interface EdgeLabelSpec {
  /** Caller-supplied id; auto-generated when omitted. */
  id?: string
  /** Edge to attach to. The label hides if the edge is removed or its endpoints disappear. */
  edgeId: string
  /** HTML string (sanitized via the chart's hook if provided) or an HTMLElement. */
  content: HTMLElement | string
  /**
   * Position along the edge midpoint (0..1 mapped t along the source-target
   * line). Default 0.5 — exact midpoint.
   */
  t?: number
  /** Optional CSS class — stripped of attribute-breakout chars. */
  className?: string
  /**
   * z-index. Default 38 — above ViewportPortal (35), below NodeToolbar (40)
   * so node-anchored toolbars still win.
   */
  zIndex?: number
}

interface MountedLabel extends EdgeLabelSpec {
  id: string
  el: HTMLDivElement
}

const STYLE_TAG_ID = 'flowgl-edge-label-overlay-style'
const STYLE_CSS = `
.flowgl-edge-label{position:absolute;display:inline-block;background:rgba(255,255,255,.96);backdrop-filter:blur(4px);border:1px solid rgba(15,23,42,.08);border-radius:6px;padding:2px 7px;font:13px/1.4 system-ui,-apple-system,sans-serif;color:#0f172a;box-shadow:0 1px 3px rgba(15,23,42,.08);pointer-events:auto;user-select:none;}
.flowgl-edge-label[data-visible="false"]{display:none;}
@media (prefers-color-scheme: dark){
.flowgl-edge-label{background:rgba(30,41,59,.92);border-color:rgba(241,245,249,.1);color:#f1f5f9;box-shadow:0 1px 3px rgba(0,0,0,.4);}
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

let labelSeq = 0

/**
 * HTML-overlay edge labels — an alternative to the atlas SDF labels for cases
 * where the label needs arbitrary HTML (badges, buttons, mini-graphs, etc.).
 *
 * **Performance note**: each label is one DOM element repositioned every render
 * frame. Practical budget is on the order of tens of HTML labels on screen at
 * once — use the atlas labels (`EdgeData.label`) for the bulk of the graph
 * and reserve `addEdgeLabel(...)` for the few that genuinely need HTML.
 *
 * The label position is the **straight-line midpoint** between the centers of
 * the source and target nodes (matching the visual midpoint of a Bezier edge
 * closely enough that nobody has to compute the actual Bezier).
 */
export class EdgeLabelOverlay {
  private readonly container: HTMLElement
  private readonly viewport: Viewport
  private readonly graph: Graph
  private readonly sanitizeHtml: ((s: string) => string) | undefined
  private labels = new Map<string, MountedLabel>()

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

  add(spec: EdgeLabelSpec): string {
    const id = spec.id ?? `flowgl-edge-label-${++labelSeq}`
    if (this.labels.has(id)) this.remove(id)
    const el = document.createElement('div')
    el.className = 'flowgl-edge-label'
    el.setAttribute('data-flowgl-edge-label', id)
    el.style.zIndex = String(Math.max(0, spec.zIndex ?? 38))
    if (spec.className) el.className += ' ' + spec.className.replace(/[^A-Za-z0-9_\- ]/g, '')
    if (typeof spec.content === 'string') {
      const html = this.sanitizeHtml ? this.sanitizeHtml(spec.content) : spec.content
      el.innerHTML = html
    } else {
      el.appendChild(spec.content)
    }
    this.container.appendChild(el)
    this.labels.set(id, { ...spec, id, el })
    this.repositionOne(id)
    return id
  }

  update(id: string, partial: Partial<Omit<EdgeLabelSpec, 'edgeId'>>): boolean {
    const l = this.labels.get(id)
    if (!l) return false
    if (partial.t != null) l.t = partial.t
    if (partial.zIndex != null) l.el.style.zIndex = String(Math.max(0, partial.zIndex))
    if (partial.content !== undefined) {
      if (typeof partial.content === 'string') {
        const html = this.sanitizeHtml ? this.sanitizeHtml(partial.content) : partial.content
        l.el.innerHTML = html
      } else {
        while (l.el.firstChild) l.el.removeChild(l.el.firstChild)
        l.el.appendChild(partial.content)
      }
    }
    if (partial.className != null) {
      l.el.className = 'flowgl-edge-label ' + partial.className.replace(/[^A-Za-z0-9_\- ]/g, '')
    }
    this.repositionOne(id)
    return true
  }

  remove(id: string): boolean {
    const l = this.labels.get(id)
    if (!l) return false
    l.el.remove()
    this.labels.delete(id)
    return true
  }

  list(): string[] { return Array.from(this.labels.keys()) }

  /** Recompute every label's screen position + visibility. Call once per render frame. */
  reposition(): void {
    for (const id of this.labels.keys()) this.repositionOne(id)
  }

  private repositionOne(id: string): void {
    const l = this.labels.get(id)
    if (!l) return
    const edge = this.graph.getEdge(l.edgeId)
    if (!edge) { l.el.setAttribute('data-visible', 'false'); return }
    const src = this.graph.getNode(edge.source)
    const tgt = this.graph.getNode(edge.target)
    if (!src || !tgt) { l.el.setAttribute('data-visible', 'false'); return }

    // Anchor at the rendered-path midpoint (arc-length walk through the
    // shared edge-geometry helper). Pre-0.8.1 this used the straight line
    // between node centers, which drifted off the visible polyline for
    // step / smoothstep / waypoint-edited edges.
    let wx: number, wy: number
    const t = l.t
    if (t == null || t === 0.5) {
      const [mx, my] = edgeMidpoint(edge, src, tgt)
      wx = mx; wy = my
    } else {
      // Non-default t: lerp along the polyline by fraction of arc length.
      const pts = edgePathPoints(edge, src, tgt)
      const point = pointAtFraction(pts, t)
      wx = point[0]; wy = point[1]
    }

    const [px, py] = this.viewport.worldToScreen(wx, wy)
    l.el.setAttribute('data-visible', 'true')
    l.el.style.left = `${px}px`
    l.el.style.top  = `${py}px`
    l.el.style.transform = 'translate(-50%, -50%)'
  }

  dispose(): void {
    for (const l of Array.from(this.labels.values())) l.el.remove()
    this.labels.clear()
  }
}
