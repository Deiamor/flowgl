import type { NodeData } from '../graph/node'
import type { Viewport } from '../viewport/viewport'
import type { Graph } from '../graph/graph'
import { sanitizeContent } from '../services/sanitize-html'

export type NodeToolbarPosition = 'top' | 'bottom' | 'left' | 'right'
export type NodeToolbarAlign = 'start' | 'center' | 'end'

export interface NodeToolbarSpec {
  /**
   * Which node(s) this toolbar belongs to. When a string array is passed, the
   * toolbar is shown only when *all* listed nodes are selected (matching
   * React Flow's multi-node toolbar contract).
   */
  nodeId: string | string[]
  /** Edge of the node to attach to. Default: 'top'. */
  position?: NodeToolbarPosition
  /** Alignment along the chosen edge. Default: 'center'. */
  align?: NodeToolbarAlign
  /** Distance from the node edge in *screen* pixels (constant under zoom). Default: 10. */
  offset?: number
  /**
   * Visibility policy:
   *   - `'auto'` (default): visible iff the node is in the current selection
   *     and no other unrelated nodes are selected.
   *   - `true`: always visible while the node exists.
   *   - `false`: never visible.
   */
  isVisible?: boolean | 'auto'
  /** Toolbar content. Either a string (innerHTML, sanitized via the chart's hook) or an HTMLElement. */
  content: HTMLElement | string
  /** Custom inline class. */
  className?: string
}

interface MountedToolbar extends NodeToolbarSpec {
  id: string
  el: HTMLDivElement
}

const STYLE_TAG_ID = 'flowgl-node-toolbar-style'
const STYLE_CSS = `
.flowgl-node-toolbar{position:absolute;display:inline-flex;background:rgba(255,255,255,.96);backdrop-filter:blur(6px);border:1px solid rgba(15,23,42,.08);border-radius:6px;padding:3px;box-shadow:0 4px 10px rgba(15,23,42,.1);gap:2px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;pointer-events:auto;z-index:40;user-select:none;}
.flowgl-node-toolbar[data-visible="false"]{display:none;}
.flowgl-node-toolbar button{appearance:none;border:none;background:transparent;color:#334155;cursor:pointer;border-radius:4px;padding:4px 8px;font:inherit;}
.flowgl-node-toolbar button:hover{background:rgba(99,102,241,.1);color:#1e293b;}
.flowgl-node-toolbar button:focus-visible{outline:2px solid #6366f1;outline-offset:2px;}
@media (prefers-color-scheme: dark){
.flowgl-node-toolbar{background:rgba(30,41,59,.92);border-color:rgba(241,245,249,.1);box-shadow:0 4px 10px rgba(0,0,0,.4);}
.flowgl-node-toolbar button{color:#cbd5e1;}
.flowgl-node-toolbar button:hover{background:rgba(129,140,248,.18);color:#f1f5f9;}
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
 * Manages floating node-attached toolbars. Each toolbar's pixel size is
 * **constant regardless of zoom** — the underlying node may render at any
 * scale, but the toolbar buttons stay legible / clickable.
 *
 * Position computation pipeline (per frame, called from FlowChart's render
 * loop):
 *   - For each mounted toolbar, look up the corresponding node.
 *   - Decide visibility (selection-aware for `'auto'`, explicit for boolean).
 *   - Project the node's anchor point (chosen position + align) to screen
 *     coords via `viewport.worldToScreen`.
 *   - Apply screen-pixel offset away from the node edge.
 *   - Write `transform: translate(x, y)` on the toolbar div.
 */
export class NodeToolbarLayer {
  private readonly container: HTMLElement
  private readonly viewport: Viewport
  private readonly graph: Graph
  private readonly sanitizeHtml: ((s: string) => string) | undefined
  private toolbars = new Map<string, MountedToolbar>()
  private selectedIds: Set<string> = new Set()

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

  /** Inform the layer of the current selection. Called from FlowChart on selectionChange. */
  setSelection(ids: Iterable<string>): void {
    this.selectedIds = new Set(ids)
    this.reposition()
  }

  add(spec: NodeToolbarSpec): string {
    const id = `flowgl-node-toolbar-${++toolbarSeq}`
    const el = document.createElement('div')
    el.className = 'flowgl-node-toolbar'
    el.setAttribute('role', 'toolbar')
    el.setAttribute('data-flowgl-node-toolbar', id)
    if (spec.className) {
      el.className += ' ' + spec.className.replace(/[^A-Za-z0-9_\- ]/g, '')
    }
    if (typeof spec.content === 'string') {
      el.innerHTML = sanitizeContent(spec.content, this.sanitizeHtml, 'NodeToolbar')
    } else {
      el.appendChild(spec.content)
    }
    this.container.appendChild(el)
    this.toolbars.set(id, { ...spec, id, el })
    this.repositionOne(id)
    return id
  }

  update(id: string, partial: Partial<Omit<NodeToolbarSpec, 'nodeId'>>): boolean {
    const t = this.toolbars.get(id)
    if (!t) return false
    if (partial.position) t.position = partial.position
    if (partial.align) t.align = partial.align
    if (partial.offset != null) t.offset = partial.offset
    if (partial.isVisible !== undefined) t.isVisible = partial.isVisible
    if (partial.content !== undefined) {
      if (typeof partial.content === 'string') {
        t.el.innerHTML = sanitizeContent(partial.content, this.sanitizeHtml, 'NodeToolbar')
      } else {
        while (t.el.firstChild) t.el.removeChild(t.el.firstChild)
        t.el.appendChild(partial.content)
      }
    }
    if (partial.className) {
      t.el.className = 'flowgl-node-toolbar ' + partial.className.replace(/[^A-Za-z0-9_\- ]/g, '')
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

  /** Recompute every mounted toolbar's screen position + visibility. */
  reposition(): void {
    for (const id of this.toolbars.keys()) this.repositionOne(id)
  }

  private resolveTargetNodes(spec: NodeToolbarSpec): NodeData[] {
    const ids = Array.isArray(spec.nodeId) ? spec.nodeId : [spec.nodeId]
    const out: NodeData[] = []
    for (const id of ids) {
      const n = this.graph.getNode(id)
      if (n) out.push(n)
    }
    return out
  }

  private decideVisibility(spec: NodeToolbarSpec, nodes: NodeData[]): boolean {
    if (spec.isVisible === false) return false
    if (spec.isVisible === true) return nodes.length > 0
    // 'auto' — visible iff every target node is selected AND the selection
    // contains nothing else (the React Flow behaviour: a per-node toolbar
    // hides during multi-select unless the consumer forces it visible).
    if (nodes.length === 0) return false
    if (this.selectedIds.size === 0) return false
    for (const n of nodes) if (!this.selectedIds.has(n.id)) return false
    const ids = new Set(nodes.map(n => n.id))
    for (const sel of this.selectedIds) if (!ids.has(sel)) return false
    return true
  }

  private anchorFor(nodes: NodeData[], position: NodeToolbarPosition, align: NodeToolbarAlign): [number, number] {
    // AABB of the target nodes in world coords.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      if (n.x < minX) minX = n.x
      if (n.y < minY) minY = n.y
      if (n.x + n.width  > maxX) maxX = n.x + n.width
      if (n.y + n.height > maxY) maxY = n.y + n.height
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    if (position === 'top')    return [align === 'start' ? minX : align === 'end' ? maxX : cx, minY]
    if (position === 'bottom') return [align === 'start' ? minX : align === 'end' ? maxX : cx, maxY]
    if (position === 'left')   return [minX, align === 'start' ? minY : align === 'end' ? maxY : cy]
    return [maxX, align === 'start' ? minY : align === 'end' ? maxY : cy] // right
  }

  private repositionOne(id: string): void {
    const t = this.toolbars.get(id)
    if (!t) return
    const nodes = this.resolveTargetNodes(t)
    const visible = this.decideVisibility(t, nodes)
    t.el.setAttribute('data-visible', visible ? 'true' : 'false')
    if (!visible || nodes.length === 0) return

    const position = t.position ?? 'top'
    const align = t.align ?? 'center'
    const offset = t.offset ?? 10

    const [wx, wy] = this.anchorFor(nodes, position, align)
    const [sx, sy] = this.viewport.worldToScreen(wx, wy)

    // After translate(-50%, -50%) the toolbar centers on (sx, sy). Apply the
    // edge-offset *away* from the node in screen pixels.
    let dx = 0, dy = 0
    if (position === 'top')    dy = -offset
    if (position === 'bottom') dy =  offset
    if (position === 'left')   dx = -offset
    if (position === 'right')  dx =  offset

    // For start/end align, switch the translate origin so the toolbar isn't
    // centered on that corner.
    let translate = 'translate(-50%, -50%)'
    if (position === 'top' || position === 'bottom') {
      if (align === 'start') translate = `translate(0, ${position === 'top' ? '-100%' : '0'})`
      else if (align === 'end') translate = `translate(-100%, ${position === 'top' ? '-100%' : '0'})`
      else translate = `translate(-50%, ${position === 'top' ? '-100%' : '0'})`
    } else {
      if (align === 'start') translate = `translate(${position === 'left' ? '-100%' : '0'}, 0)`
      else if (align === 'end') translate = `translate(${position === 'left' ? '-100%' : '0'}, -100%)`
      else translate = `translate(${position === 'left' ? '-100%' : '0'}, -50%)`
    }

    t.el.style.left = `${sx + dx}px`
    t.el.style.top  = `${sy + dy}px`
    t.el.style.transform = translate
  }

  dispose(): void {
    for (const t of Array.from(this.toolbars.values())) t.el.remove()
    this.toolbars.clear()
  }
}
