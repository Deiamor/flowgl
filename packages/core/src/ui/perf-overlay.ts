import type { Viewport } from '../viewport/viewport'
import type { Graph } from '../graph/graph'

export interface PerfOverlayOptions {
  /** Where to anchor the overlay. Default: 'top-right'. */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** Distance from the chosen edge in pixels. Default: 12. */
  offset?: number
  /** Sampling window in ms — fps is averaged over this. Default: 1000. */
  windowMs?: number
  /** Show node + edge counts. Default: true. */
  showCounts?: boolean
  /** Show the atlas generation counter (lights up on eviction). Default: true. */
  showAtlas?: boolean
  /** Custom inline className. */
  className?: string
}

interface AtlasProbe { generation?: number }

const STYLE_TAG_ID = 'flowgl-perf-overlay-style'
const STYLE_CSS = `
.flowgl-perf-overlay{position:absolute;display:grid;grid-template-columns:auto auto;gap:2px 10px;background:rgba(15,23,42,.88);backdrop-filter:blur(6px);color:#cbd5e1;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:11px;line-height:1.4;padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.06);box-shadow:0 4px 10px rgba(0,0,0,.25);z-index:45;user-select:none;pointer-events:none;}
.flowgl-perf-overlay__label{opacity:.6;}
.flowgl-perf-overlay__value{color:#f1f5f9;font-weight:600;text-align:right;}
.flowgl-perf-overlay__value.is-green{color:#22c55e;}
.flowgl-perf-overlay__value.is-yellow{color:#fbbf24;}
.flowgl-perf-overlay__value.is-red{color:#f87171;}
.flowgl-perf-overlay__value.is-flash{animation:flowgl-perf-flash .6s ease-out 1;}
@keyframes flowgl-perf-flash{0%{color:#fbbf24}100%{color:#f1f5f9}}
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
 * Real-time performance overlay — fps + frame time + atlas eviction counter
 * + node/edge counts. Distinct from anything React Flow ships: it surfaces
 * the WebGL2 metrics our renderer makes available directly in the UI.
 *
 * The overlay measures by hooking requestAnimationFrame on its own — it does
 * not require the chart to call into it. That means the fps reading reflects
 * what the actual browser frame budget allowed, not just the chart's render
 * loop.
 */
export class PerfOverlay {
  private readonly container: HTMLElement
  private readonly viewport: Viewport
  private readonly graph: Graph
  private readonly atlasProbe: () => AtlasProbe | null
  private options: Required<Omit<PerfOverlayOptions, 'className'>> & { className?: string }
  private el: HTMLDivElement | null = null
  private vFps!: HTMLSpanElement
  private vFrame!: HTMLSpanElement
  private vNodes!: HTMLSpanElement | null
  private vEdges!: HTMLSpanElement | null
  private vAtlas!: HTMLSpanElement | null
  private rafId: number | null = null
  private windowStart = 0
  private frames = 0
  private accumMs = 0
  private lastTs = 0
  private prevAtlasGen = -1

  constructor(
    container: HTMLElement,
    viewport: Viewport,
    graph: Graph,
    atlasProbe: () => AtlasProbe | null,
    options: PerfOverlayOptions = {},
  ) {
    this.container = container
    this.viewport = viewport
    this.graph = graph
    this.atlasProbe = atlasProbe
    this.options = {
      position:   options.position   ?? 'top-right',
      offset:     options.offset     ?? 12,
      windowMs:   options.windowMs   ?? 1000,
      showCounts: options.showCounts ?? true,
      showAtlas:  options.showAtlas  ?? true,
      ...(options.className !== undefined ? { className: options.className } : {}),
    }
    ensureStyleTag(container)
    const pos = getComputedStyle(container).position
    if (pos === 'static' || pos === '') container.style.position = 'relative'
  }

  show(): void {
    if (this.el) return
    const opt = this.options
    const el = document.createElement('div')
    el.className = 'flowgl-perf-overlay'
    if (opt.className) {
      el.className += ' ' + opt.className.replace(/[^A-Za-z0-9_\- ]/g, '')
    }
    el.setAttribute('aria-label', 'Performance overlay (fps, frame time, node count, atlas generation)')
    const place = (k: 'top' | 'bottom', v: number) => k === 'top'
      ? (el.style.top    = `${v}px`)
      : (el.style.bottom = `${v}px`)
    const placeH = (k: 'left' | 'right', v: number) => k === 'left'
      ? (el.style.left  = `${v}px`)
      : (el.style.right = `${v}px`)
    const [vert, horiz] = opt.position.split('-') as ['top' | 'bottom', 'left' | 'right']
    place(vert, opt.offset); placeH(horiz, opt.offset)

    const row = (label: string): HTMLSpanElement => {
      const l = document.createElement('span'); l.className = 'flowgl-perf-overlay__label'; l.textContent = label
      const v = document.createElement('span'); v.className = 'flowgl-perf-overlay__value'; v.textContent = '—'
      el.appendChild(l); el.appendChild(v); return v
    }
    this.vFps   = row('fps')
    this.vFrame = row('ms/frame')
    this.vNodes = opt.showCounts ? row('nodes') : null
    this.vEdges = opt.showCounts ? row('edges') : null
    this.vAtlas = opt.showAtlas  ? row('atlas gen') : null

    this.container.appendChild(el)
    this.el = el
    this.start()
  }

  hide(): void {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null }
    this.el?.remove()
    this.el = null
  }

  isVisible(): boolean { return this.el !== null }

  private start(): void {
    this.windowStart = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    this.lastTs = this.windowStart
    this.frames = 0
    this.accumMs = 0
    const tick = (ts: number) => {
      if (!this.el) return
      const delta = ts - this.lastTs
      this.lastTs = ts
      if (delta > 0 && delta < 1000) { this.accumMs += delta; this.frames += 1 }
      const elapsed = ts - this.windowStart
      if (elapsed >= this.options.windowMs) {
        const fps = (this.frames / elapsed) * 1000
        const ms  = this.frames > 0 ? this.accumMs / this.frames : 0
        this.vFps.textContent   = fps.toFixed(1)
        this.vFrame.textContent = ms.toFixed(2)
        this.vFps.className     = 'flowgl-perf-overlay__value ' + (fps >= 55 ? 'is-green' : fps >= 28 ? 'is-yellow' : 'is-red')
        this.vFrame.className   = 'flowgl-perf-overlay__value ' + (ms <= 18 ? 'is-green' : ms <= 35 ? 'is-yellow' : 'is-red')
        if (this.vNodes) this.vNodes.textContent = String(this.graph.getNodes().length)
        if (this.vEdges) this.vEdges.textContent = String(this.graph.getEdges().length)
        if (this.vAtlas) {
          const probe = this.atlasProbe()
          const gen = probe?.generation ?? 0
          this.vAtlas.textContent = String(gen)
          if (this.prevAtlasGen !== -1 && gen !== this.prevAtlasGen) {
            this.vAtlas.classList.add('is-flash')
            setTimeout(() => this.vAtlas?.classList.remove('is-flash'), 600)
          }
          this.prevAtlasGen = gen
        }
        // Reset window
        this.windowStart = ts
        this.frames = 0
        this.accumMs = 0
      }
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  dispose(): void { this.hide() }
}
