import { PanelOverlay, type PanelPosition } from './panel-overlay'

export interface ControlButtonOptions {
  /** Stable id used as part of the DOM element data-attribute. */
  id: string
  /** Inline SVG / text rendered inside the button. */
  icon: string
  /** Tooltip + aria-label. */
  title: string
  /** Click handler. */
  onClick: () => void
  /** Optional disabled state (renders semi-transparent + ignores clicks). */
  disabled?: boolean
}

export interface ControlsOptions {
  /** Panel position. Default: 'bottom-left'. */
  position?: PanelPosition
  /** Distance from the chosen edge in pixels. Default: 16. */
  offset?: number
  /** Layout direction. Default: 'vertical'. */
  orientation?: 'horizontal' | 'vertical'
  /** Show the zoom-in / zoom-out buttons. Default: true. */
  showZoom?: boolean
  /** Show the fit-view button. Default: true. */
  showFitView?: boolean
  /** Show the lock / interactive toggle. Default: true. */
  showInteractive?: boolean
  /**
   * Replace the zoom-in handler. If omitted, the controls call
   * `chart.zoomIn()` directly.
   */
  onZoomIn?: () => void
  /** Replace the zoom-out handler. */
  onZoomOut?: () => void
  /** Replace the fit-view handler. */
  onFitView?: () => void
  /**
   * Called when the lock button is toggled. Receives the new `readOnly`
   * state (true = locked, false = interactive). If omitted, the controls
   * call `chart.setReadOnly()` directly.
   */
  onInteractiveChange?: (readOnly: boolean) => void
  /** Custom buttons appended after the built-ins. */
  customButtons?: ControlButtonOptions[]
}

const ICON_ZOOM_IN  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>'
const ICON_ZOOM_OUT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/></svg>'
const ICON_FIT      = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/></svg>'
const ICON_LOCK     = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
const ICON_UNLOCK   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>'

const STYLE_TAG_ID = 'flowgl-controls-style'
const STYLE_CSS = `
.flowgl-controls{display:flex;background:rgba(255,255,255,.94);backdrop-filter:blur(6px);border:1px solid rgba(15,23,42,.08);border-radius:8px;padding:4px;box-shadow:0 4px 12px rgba(15,23,42,.08);gap:2px;}
.flowgl-controls[data-orient="vertical"]{flex-direction:column}
.flowgl-controls[data-orient="horizontal"]{flex-direction:row}
.flowgl-controls__btn{appearance:none;border:none;background:transparent;color:#334155;cursor:pointer;border-radius:5px;padding:6px;display:flex;align-items:center;justify-content:center;min-width:28px;min-height:28px;font:inherit;}
.flowgl-controls__btn:hover{background:rgba(99,102,241,.1);color:#1e293b;}
.flowgl-controls__btn:focus-visible{outline:2px solid #6366f1;outline-offset:2px;}
.flowgl-controls__btn[aria-disabled="true"]{opacity:.4;cursor:not-allowed;pointer-events:none;}
.flowgl-controls__btn[data-state="on"]{background:rgba(239,68,68,.12);color:#dc2626;}
@media (prefers-color-scheme: dark){
.flowgl-controls{background:rgba(30,41,59,.88);border-color:rgba(241,245,249,.1);box-shadow:0 4px 12px rgba(0,0,0,.32);}
.flowgl-controls__btn{color:#cbd5e1;}
.flowgl-controls__btn:hover{background:rgba(129,140,248,.18);color:#f1f5f9;}
}
`

interface MountedControls {
  panelId: string
  el: HTMLDivElement
  lockBtn: HTMLButtonElement | null
  buttons: HTMLButtonElement[]
  onInteractiveChange?: (readOnly: boolean) => void
}

let controlsSeq = 0

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
 * Mount a Controls panel onto a PanelOverlay-aware host. The host (FlowChart)
 * passes itself in as the API surface for the button handlers.
 *
 * Built-in buttons: zoom-in, zoom-out, fit-view, lock/interactive toggle.
 * Each is opt-out via the options. Custom buttons append after the built-ins.
 *
 * The Controls panel is a regular `Panel` underneath — `chart.removePanel(id)`
 * also detaches it, and `dispose()` cleans up via the panel layer.
 */
export class Controls {
  private readonly host: ControlsHost
  private mounted: MountedControls | null = null

  constructor(host: ControlsHost) {
    this.host = host
  }

  show(options: ControlsOptions = {}): string {
    if (this.mounted) this.hide()

    const container = this.host.getContainer()
    ensureStyleTag(container)

    const orient = options.orientation ?? 'vertical'
    const el = document.createElement('div')
    el.className = 'flowgl-controls'
    el.setAttribute('data-orient', orient)
    el.setAttribute('role', 'toolbar')
    el.setAttribute('aria-label', 'Chart controls')

    const buttons: HTMLButtonElement[] = []
    let lockBtn: HTMLButtonElement | null = null

    const make = (opts: ControlButtonOptions): HTMLButtonElement => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'flowgl-controls__btn'
      btn.setAttribute('data-flowgl-control', opts.id)
      btn.setAttribute('title', opts.title)
      btn.setAttribute('aria-label', opts.title)
      btn.innerHTML = opts.icon
      if (opts.disabled) btn.setAttribute('aria-disabled', 'true')
      btn.addEventListener('click', () => {
        if (btn.getAttribute('aria-disabled') === 'true') return
        opts.onClick()
      })
      return btn
    }

    if (options.showZoom !== false) {
      const onIn  = options.onZoomIn  ?? (() => this.host.zoomIn())
      const onOut = options.onZoomOut ?? (() => this.host.zoomOut())
      const b1 = make({ id: 'zoom-in',  icon: ICON_ZOOM_IN,  title: 'Zoom in',  onClick: onIn })
      const b2 = make({ id: 'zoom-out', icon: ICON_ZOOM_OUT, title: 'Zoom out', onClick: onOut })
      el.appendChild(b1); el.appendChild(b2)
      buttons.push(b1, b2)
    }
    if (options.showFitView !== false) {
      const onFit = options.onFitView ?? (() => this.host.fitView())
      const b = make({ id: 'fit-view', icon: ICON_FIT, title: 'Fit view', onClick: onFit })
      el.appendChild(b)
      buttons.push(b)
    }
    if (options.showInteractive !== false) {
      let readOnly = this.host.isReadOnly()
      const renderLock = () => {
        if (!lockBtn) return
        lockBtn.innerHTML = readOnly ? ICON_LOCK : ICON_UNLOCK
        lockBtn.setAttribute('title', readOnly ? 'Unlock — enable editing' : 'Lock — disable editing')
        lockBtn.setAttribute('aria-label', readOnly ? 'Unlock chart' : 'Lock chart')
        lockBtn.setAttribute('aria-pressed', readOnly ? 'true' : 'false')
        lockBtn.setAttribute('data-state', readOnly ? 'on' : 'off')
      }
      lockBtn = make({ id: 'lock', icon: ICON_UNLOCK, title: 'Lock chart', onClick: () => {
        readOnly = !readOnly
        const cb = options.onInteractiveChange
        if (cb) cb(readOnly)
        else this.host.setReadOnly(readOnly)
        renderLock()
      } })
      renderLock()
      el.appendChild(lockBtn)
      buttons.push(lockBtn)
    }
    for (const custom of options.customButtons ?? []) {
      const b = make(custom)
      el.appendChild(b)
      buttons.push(b)
    }

    const panelId = `flowgl-controls-${++controlsSeq}`
    this.host.getPanelOverlay().add({
      id: panelId,
      position: options.position ?? 'bottom-left',
      offset: options.offset ?? 16,
      content: el,
      padding: '0',
    })
    const mounted: MountedControls = { panelId, el, lockBtn, buttons }
    if (options.onInteractiveChange) mounted.onInteractiveChange = options.onInteractiveChange
    this.mounted = mounted
    return panelId
  }

  isVisible(): boolean { return this.mounted !== null }

  hide(): boolean {
    if (!this.mounted) return false
    const removed = this.host.getPanelOverlay().remove(this.mounted.panelId)
    this.mounted = null
    return removed
  }

  dispose(): void { this.hide() }
}

/**
 * The slice of FlowChart that Controls needs. Defined narrowly so the host
 * doesn't leak any other surface into this module.
 */
export interface ControlsHost {
  getContainer(): HTMLElement
  getPanelOverlay(): PanelOverlay
  zoomIn(): void
  zoomOut(): void
  fitView(): void
  isReadOnly(): boolean
  setReadOnly(value: boolean): void
}
