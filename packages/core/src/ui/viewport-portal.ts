import type { Viewport } from '../viewport/viewport'
import { sanitizeContent } from '../services/sanitize-html'

export interface ViewportPortalSpec {
  /** Caller-supplied id; auto-generated when omitted. */
  id?: string
  /** World-coordinate top-left anchor. */
  x: number
  /** World-coordinate top-left anchor. */
  y: number
  /** Optional explicit world-unit width. Required for layout that needs a known box. */
  width?: number
  /** Optional explicit world-unit height. */
  height?: number
  /** Content: HTMLElement (mounted as-is) or HTML string (sanitized via chart's hook). */
  content: HTMLElement | string
  /** Optional CSS class. Stripped of attribute-breakout characters. */
  className?: string
  /**
   * Z-index relative to other portals + node-toolbars. Default 35 — below
   * NodeToolbar (40) and PerfOverlay (45) so floating toolbars still win.
   */
  zIndex?: number
}

interface MountedPortal extends ViewportPortalSpec {
  id: string
  el: HTMLDivElement
}

let portalSeq = 0

/**
 * World-coordinate DOM portal layer. Children scale and translate with the
 * viewport — at zoom 2x they render twice as large; at zoom 0.5x, half. This
 * is the opposite contract from `NodeToolbar` (constant screen size).
 *
 * Typical use cases: in-canvas annotations, sticky notes, embedded media
 * tiles, overlays whose pixel size should match the underlying world geometry.
 */
export class ViewportPortalLayer {
  private readonly container: HTMLElement
  private readonly viewport: Viewport
  private readonly sanitizeHtml: ((s: string) => string) | undefined
  private portals = new Map<string, MountedPortal>()

  constructor(
    container: HTMLElement,
    viewport: Viewport,
    sanitizeHtml?: (s: string) => string,
  ) {
    this.container = container
    this.viewport = viewport
    this.sanitizeHtml = sanitizeHtml
    const pos = getComputedStyle(container).position
    if (pos === 'static' || pos === '') container.style.position = 'relative'
  }

  add(spec: ViewportPortalSpec): string {
    const id = spec.id ?? `flowgl-viewport-portal-${++portalSeq}`
    if (this.portals.has(id)) this.remove(id)
    const el = document.createElement('div')
    el.setAttribute('data-flowgl-viewport-portal', id)
    el.style.cssText = [
      'position:absolute',
      'top:0', 'left:0',
      `z-index:${Math.max(0, spec.zIndex ?? 35)}`,
      'transform-origin:0 0',
      'pointer-events:auto',
      'box-sizing:border-box',
    ].join(';')
    if (spec.width  != null) el.style.width  = `${spec.width}px`
    if (spec.height != null) el.style.height = `${spec.height}px`
    if (spec.className) el.className = spec.className.replace(/[^A-Za-z0-9_\- ]/g, '')

    if (typeof spec.content === 'string') {
      el.innerHTML = sanitizeContent(spec.content, this.sanitizeHtml, 'ViewportPortal')
    } else {
      el.appendChild(spec.content)
    }
    this.container.appendChild(el)
    const mounted: MountedPortal = { ...spec, id, el }
    this.portals.set(id, mounted)
    this.repositionOne(id)
    return id
  }

  update(id: string, partial: Partial<Omit<ViewportPortalSpec, 'id'>>): boolean {
    const p = this.portals.get(id)
    if (!p) return false
    if (partial.x      != null) p.x = partial.x
    if (partial.y      != null) p.y = partial.y
    if (partial.width  != null) { p.width  = partial.width;  p.el.style.width  = `${partial.width}px` }
    if (partial.height != null) { p.height = partial.height; p.el.style.height = `${partial.height}px` }
    if (partial.content !== undefined) {
      if (typeof partial.content === 'string') {
        p.el.innerHTML = sanitizeContent(partial.content, this.sanitizeHtml, 'ViewportPortal')
      } else {
        while (p.el.firstChild) p.el.removeChild(p.el.firstChild)
        p.el.appendChild(partial.content)
      }
    }
    if (partial.className != null) p.el.className = partial.className.replace(/[^A-Za-z0-9_\- ]/g, '')
    if (partial.zIndex != null) p.el.style.zIndex = String(Math.max(0, partial.zIndex))
    this.repositionOne(id)
    return true
  }

  remove(id: string): boolean {
    const p = this.portals.get(id)
    if (!p) return false
    p.el.remove()
    this.portals.delete(id)
    return true
  }

  list(): string[] { return Array.from(this.portals.keys()) }

  /** Recompute every portal's transform. Called from FlowChart's render loop. */
  reposition(): void {
    for (const id of this.portals.keys()) this.repositionOne(id)
  }

  private repositionOne(id: string): void {
    const t = this.portals.get(id)
    if (!t) return
    const [sx, sy] = this.viewport.worldToScreen(t.x, t.y)
    const zoom = this.viewport.zoom
    t.el.style.transform = `translate(${sx}px, ${sy}px) scale(${zoom})`
  }

  dispose(): void {
    for (const p of Array.from(this.portals.values())) p.el.remove()
    this.portals.clear()
  }
}
