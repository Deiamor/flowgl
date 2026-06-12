import { safeColor, safeNumber } from '../services/safe-css'
import { sanitizeContent } from '../services/sanitize-html'

export type PanelPosition =
  | 'top-left'      | 'top-center'    | 'top-right'
  | 'center-left'   | 'center'        | 'center-right'
  | 'bottom-left'   | 'bottom-center' | 'bottom-right'

export interface PanelOptions {
  id?: string
  /** 9-position layout key. Default: `'top-left'`. */
  position?: PanelPosition
  /**
   * Inner content. Either an HTMLElement (mounted as-is) or an HTML string
   * (written via innerHTML — pass a `sanitizeHtml` function to the chart if
   * the string can contain untrusted input).
   */
  content: HTMLElement | string
  /** Distance in pixels from the chosen edge. Default: 12. */
  offset?: number
  /** Z-index of the panel div. Default: 30 (above minimap which is 20). */
  zIndex?: number
  className?: string
  /** Inline background color (uses the safe-css allow-list). */
  backgroundColor?: string
  /** Inline padding shortcut. Default: '8px 12px'. */
  padding?: string
  /** Optional click handler for the whole panel. */
  onClick?: (e: MouseEvent) => void
}

interface MountedPanel {
  id: string
  el: HTMLDivElement
  position: PanelPosition
  offset: number
  onClick: ((e: MouseEvent) => void) | undefined
}

const POSITION_STYLE: Record<PanelPosition, string> = {
  'top-left':      'top:{O}px;    left:{O}px;',
  'top-center':    'top:{O}px;    left:50%;       transform:translateX(-50%);',
  'top-right':     'top:{O}px;    right:{O}px;',
  'center-left':   'top:50%;      left:{O}px;     transform:translateY(-50%);',
  'center':        'top:50%;      left:50%;       transform:translate(-50%,-50%);',
  'center-right':  'top:50%;      right:{O}px;    transform:translateY(-50%);',
  'bottom-left':   'bottom:{O}px; left:{O}px;',
  'bottom-center': 'bottom:{O}px; left:50%;       transform:translateX(-50%);',
  'bottom-right':  'bottom:{O}px; right:{O}px;',
}

let panelSeq = 0

/**
 * DOM overlay container for arbitrary `<Panel>`-like widgets positioned over
 * the chart's viewport. Each panel is one absolutely-positioned `<div>`
 * inside the chart's container — the same parent the canvas mounts into.
 *
 * Panels do not participate in WebGL rendering and have no per-frame cost.
 * Adding 100 panels has the same render-loop cost as adding 0.
 */
export class PanelOverlay {
  private readonly container: HTMLElement
  private readonly sanitizeHtml: ((s: string) => string) | undefined
  private readonly panels = new Map<string, MountedPanel>()

  constructor(container: HTMLElement, sanitizeHtml?: (s: string) => string) {
    this.container = container
    this.sanitizeHtml = sanitizeHtml
    // Make the container a positioning context if it isn't already.
    const pos = getComputedStyle(container).position
    if (pos === 'static' || pos === '') container.style.position = 'relative'
  }

  add(options: PanelOptions): string {
    const id = options.id ?? `flowgl-panel-${++panelSeq}`
    if (this.panels.has(id)) this.remove(id)

    const offset = Math.max(0, safeNumber(options.offset ?? 12, 12))
    const zIndex = Math.max(0, safeNumber(options.zIndex ?? 30, 30))
    const position = options.position ?? 'top-left'
    const positionCss = POSITION_STYLE[position].replace(/\{O\}/g, String(offset))

    const el = document.createElement('div')
    el.dataset.flowglPanelId = id
    el.style.cssText = [
      'position:absolute',
      'pointer-events:auto',
      'box-sizing:border-box',
      `z-index:${zIndex}`,
      `padding:${options.padding ?? '8px 12px'}`,
      'border-radius:8px',
      'font-family:system-ui, -apple-system, sans-serif',
      positionCss,
    ].join(';')
    if (options.backgroundColor) {
      el.style.setProperty('background-color', safeColor(options.backgroundColor, 'transparent'))
    }
    if (options.className) {
      // Allow only valid CSS-identifier characters to avoid attribute breakouts.
      el.className = options.className.replace(/[^A-Za-z0-9_\- ]/g, '')
    }

    if (typeof options.content === 'string') {
      el.innerHTML = sanitizeContent(options.content, this.sanitizeHtml, 'Panel')
    } else {
      el.appendChild(options.content)
    }

    let onClick: ((e: MouseEvent) => void) | undefined
    if (options.onClick) {
      onClick = (e) => options.onClick!(e)
      el.addEventListener('click', onClick)
    }

    this.container.appendChild(el)
    this.panels.set(id, { id, el, position, offset, onClick })
    return id
  }

  /** Update the content / position of an existing panel. Returns false if the id is unknown. */
  update(id: string, options: Partial<Omit<PanelOptions, 'id'>>): boolean {
    const panel = this.panels.get(id)
    if (!panel) return false

    if (options.position || options.offset != null) {
      const offset = Math.max(0, safeNumber(options.offset ?? panel.offset, panel.offset))
      const position = options.position ?? panel.position
      const css = POSITION_STYLE[position].replace(/\{O\}/g, String(offset))
      // Reset positional inline styles before reapplying.
      panel.el.style.removeProperty('top')
      panel.el.style.removeProperty('bottom')
      panel.el.style.removeProperty('left')
      panel.el.style.removeProperty('right')
      panel.el.style.removeProperty('transform')
      for (const decl of css.split(';')) {
        const [k, v] = decl.split(':')
        if (k && v) panel.el.style.setProperty(k.trim(), v.trim())
      }
      panel.position = position
      panel.offset = offset
    }
    if (options.content != null) {
      if (typeof options.content === 'string') {
        panel.el.innerHTML = sanitizeContent(options.content, this.sanitizeHtml, 'Panel')
      } else {
        while (panel.el.firstChild) panel.el.removeChild(panel.el.firstChild)
        panel.el.appendChild(options.content)
      }
    }
    if (options.className != null) {
      panel.el.className = options.className.replace(/[^A-Za-z0-9_\- ]/g, '')
    }
    if (options.backgroundColor != null) {
      panel.el.style.setProperty('background-color', safeColor(options.backgroundColor, 'transparent'))
    }
    return true
  }

  remove(id: string): boolean {
    const panel = this.panels.get(id)
    if (!panel) return false
    if (panel.onClick) panel.el.removeEventListener('click', panel.onClick)
    panel.el.remove()
    this.panels.delete(id)
    return true
  }

  /** Returns the ids of every currently-mounted panel. */
  list(): string[] { return Array.from(this.panels.keys()) }

  dispose(): void {
    for (const id of Array.from(this.panels.keys())) this.remove(id)
  }
}
