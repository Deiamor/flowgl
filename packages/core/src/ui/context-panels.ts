import type { Graph } from '../graph/graph'
import type { EdgeData } from '../graph/edge'
import type { GridConfig } from '../types'
import { DEFAULT_EDGE_STYLE } from '../graph/edge'
import { hierarchicalLayout, forceLayout, gridLayout } from '../layout/auto-layout'

export interface PanelDeps {
  graph:          Graph
  contextMenu:    { hide(): void }
  scheduleRender(): void
  beforeMutation(): void
  getBackground(): string
  setBackground(color: string): void
  getGridConfig(): GridConfig
  setGrid(config: Partial<GridConfig>): void
}

const PANEL_BASE = `
  background: #1a2340;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.5);
  padding: 14px;
  font-family: system-ui, -apple-system, sans-serif;
  user-select: none;
`

function section(title: string, marginBottom = '12px'): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.marginBottom = marginBottom
  const lbl = document.createElement('div')
  lbl.textContent = title
  lbl.style.cssText = 'font-size: 11px; color: #9ca3af; margin-bottom: 8px; letter-spacing: .03em;'
  wrap.appendChild(lbl)
  return wrap
}

function hr(): HTMLElement {
  const d = document.createElement('div')
  d.style.cssText = 'height: 1px; background: rgba(255,255,255,0.08); margin: 4px 0 12px;'
  return d
}

export class ContextPanels {
  constructor(private readonly deps: PanelDeps) {}

  // ── Edge style ─────────────────────────────────────────────────────────────

  edgeStyle(edge: EdgeData): HTMLElement {
    const { graph, scheduleRender, beforeMutation } = this.deps
    const merged = { ...DEFAULT_EDGE_STYLE, ...edge.style }

    const panel = document.createElement('div')
    panel.style.cssText = PANEL_BASE + 'min-width: 220px;'

    // ── Color ────────────────────────────────────────────────────────
    const colorSec = section('Color')
    const COLORS = ['#64748b', '#1a73e8', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#ec4899', '#06b6d4']
    const swatchRow = document.createElement('div')
    swatchRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;'

    const refreshSwatches = (): void => {
      const current = { ...DEFAULT_EDGE_STYLE, ...graph.getEdge(edge.id)?.style }.color
      swatchRow.querySelectorAll<HTMLElement>('[data-color]').forEach(el => {
        const c = el.dataset['color']!
        el.style.outline = c === current ? '2px solid #fff' : '2px solid transparent'
        el.style.outlineOffset = '1px'
      })
    }

    for (const color of COLORS) {
      const sw = document.createElement('div')
      sw.dataset['color'] = color
      sw.style.cssText = `
        width: 22px; height: 22px; border-radius: 50%; background: ${color}; cursor: pointer;
        transition: transform .1s, outline .1s;
        outline: 2px solid ${color === merged.color ? '#fff' : 'transparent'}; outline-offset: 1px;
      `
      sw.addEventListener('pointerenter', () => { sw.style.transform = 'scale(1.18)' })
      sw.addEventListener('pointerleave', () => { sw.style.transform = 'scale(1)' })
      sw.addEventListener('pointerdown', e => {
        e.stopPropagation()
        beforeMutation()
        graph.updateEdge(edge.id, { style: { ...graph.getEdge(edge.id)?.style, color } })
        scheduleRender()
        refreshSwatches()
      })
      swatchRow.appendChild(sw)
    }
    colorSec.appendChild(swatchRow)
    panel.appendChild(colorSec)
    panel.appendChild(hr())

    // ── Width ────────────────────────────────────────────────────────
    const widthSec = section('Width')
    const WIDTHS = [{ label: 'Thin', value: 1 }, { label: 'Medium', value: 2 }, { label: 'Thick', value: 4 }]
    const widthRow = document.createElement('div')
    widthRow.style.cssText = 'display: flex; gap: 6px;'

    const refreshWidths = (): void => {
      const current = { ...DEFAULT_EDGE_STYLE, ...graph.getEdge(edge.id)?.style }.width
      widthRow.querySelectorAll<HTMLElement>('[data-width]').forEach(el => {
        const active = String(current) === el.dataset['width']
        el.style.background = active ? 'rgba(255,255,255,0.15)' : 'transparent'
        el.style.borderColor = active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'
      })
    }

    for (const w of WIDTHS) {
      const btn = document.createElement('button')
      btn.dataset['width'] = String(w.value)
      const active = merged.width === w.value
      btn.style.cssText = `
        flex: 1; padding: 8px 4px; border-radius: 6px; cursor: pointer;
        border: 1px solid ${active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'};
        background: ${active ? 'rgba(255,255,255,0.15)' : 'transparent'};
        color: #d1d5db; font-size: 11px; font-family: inherit;
        display: flex; flex-direction: column; align-items: center; gap: 5px;
        transition: background .1s, border-color .1s;
      `
      const line = document.createElement('div')
      line.style.cssText = `width: 28px; height: ${w.value}px; background: #d1d5db; border-radius: 2px;`
      const lbl = document.createElement('span')
      lbl.textContent = w.label
      btn.appendChild(line)
      btn.appendChild(lbl)
      btn.addEventListener('pointerenter', () => {
        if (btn.dataset['width'] !== String({ ...DEFAULT_EDGE_STYLE, ...graph.getEdge(edge.id)?.style }.width))
          btn.style.background = 'rgba(255,255,255,0.08)'
      })
      btn.addEventListener('pointerleave', () => refreshWidths())
      btn.addEventListener('pointerdown', e => {
        e.stopPropagation()
        beforeMutation()
        graph.updateEdge(edge.id, { style: { ...graph.getEdge(edge.id)?.style, width: w.value } })
        scheduleRender()
        refreshWidths()
      })
      widthRow.appendChild(btn)
    }
    widthSec.appendChild(widthRow)
    panel.appendChild(widthSec)
    panel.appendChild(hr())

    // ── Line style ───────────────────────────────────────────────────
    const dashSec = section('Line Style', '0')
    const DASH_OPTS = [
      { label: 'Solid',  dashArray: undefined as [number, number] | undefined },
      { label: 'Dashed', dashArray: [8, 4] as [number, number] },
      { label: 'Dotted', dashArray: [2, 4] as [number, number] },
    ]
    const dashRow = document.createElement('div')
    dashRow.style.cssText = 'display: flex; gap: 6px;'

    const refreshDash = (): void => {
      const current = { ...DEFAULT_EDGE_STYLE, ...graph.getEdge(edge.id)?.style }.dashArray
      dashRow.querySelectorAll<HTMLElement>('[data-dash]').forEach(el => {
        const active = el.dataset['dash'] === (current ? JSON.stringify(current) : 'solid')
        el.style.background = active ? 'rgba(255,255,255,0.15)' : 'transparent'
        el.style.borderColor = active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'
      })
    }

    for (const opt of DASH_OPTS) {
      const btn = document.createElement('button')
      btn.dataset['dash'] = opt.dashArray ? JSON.stringify(opt.dashArray) : 'solid'
      const active = opt.dashArray
        ? JSON.stringify(merged.dashArray) === JSON.stringify(opt.dashArray)
        : !merged.dashArray
      btn.style.cssText = `
        flex: 1; padding: 8px 4px; border-radius: 6px; cursor: pointer;
        border: 1px solid ${active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'};
        background: ${active ? 'rgba(255,255,255,0.15)' : 'transparent'};
        color: #d1d5db; font-size: 11px; font-family: inherit;
        display: flex; flex-direction: column; align-items: center; gap: 5px;
        transition: background .1s, border-color .1s;
      `
      const preview = document.createElement('div')
      preview.style.cssText = 'width: 32px; height: 12px; display: flex; align-items: center;'
      const lineEl = document.createElement('div')
      if (!opt.dashArray) {
        lineEl.style.cssText = 'width: 100%; height: 2px; background: #d1d5db; border-radius: 1px;'
      } else {
        const [dash, gap] = opt.dashArray
        lineEl.style.cssText = `
          width: 100%; height: 2px; border-radius: 1px;
          background: repeating-linear-gradient(
            90deg,
            #d1d5db 0px, #d1d5db ${dash}px,
            transparent ${dash}px, transparent ${dash + gap}px
          );
        `
      }
      preview.appendChild(lineEl)
      const lbl = document.createElement('span')
      lbl.textContent = opt.label
      btn.appendChild(preview)
      btn.appendChild(lbl)
      btn.addEventListener('pointerenter', () => {
        if (!active) btn.style.background = 'rgba(255,255,255,0.08)'
      })
      btn.addEventListener('pointerleave', () => refreshDash())
      btn.addEventListener('pointerdown', e => {
        e.stopPropagation()
        beforeMutation()
        const cur = { ...graph.getEdge(edge.id)?.style }
        if (opt.dashArray) {
          graph.updateEdge(edge.id, { style: { ...cur, dashArray: opt.dashArray } })
        } else {
          const { dashArray: _da, ...rest } = cur
          graph.updateEdge(edge.id, { style: rest })
        }
        scheduleRender()
        refreshDash()
      })
      dashRow.appendChild(btn)
    }
    dashSec.appendChild(dashRow)
    panel.appendChild(dashSec)
    return panel
  }

  // ── Background ─────────────────────────────────────────────────────────────

  background(): HTMLElement {
    const { getBackground, setBackground } = this.deps
    const panel = document.createElement('div')
    panel.style.cssText = PANEL_BASE + 'min-width: 180px;'

    const title = document.createElement('div')
    title.textContent = 'Background'
    title.style.cssText = 'font-size: 11px; color: #9ca3af; margin-bottom: 10px; letter-spacing: .03em;'
    panel.appendChild(title)

    const PRESETS = [
      { label: 'Light Gray', color: '#f7f7f7' },
      { label: 'White',      color: '#ffffff' },
      { label: 'Warm White', color: '#fffbf0' },
      { label: 'Blue Gray',  color: '#f0f4f8' },
      { label: 'Slate Dark', color: '#1e293b' },
      { label: 'Midnight',   color: '#0f172a' },
    ]

    const grid = document.createElement('div')
    grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px;'

    const refresh = (): void => {
      grid.querySelectorAll<HTMLElement>('[data-bg]').forEach(el => {
        el.style.outline = el.dataset['bg'] === getBackground()
          ? '2px solid #fff' : '2px solid transparent'
      })
    }

    for (const p of PRESETS) {
      const btn = document.createElement('button')
      btn.dataset['bg'] = p.color
      btn.style.cssText = `
        padding: 7px 10px; border-radius: 6px; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.05);
        color: #d1d5db; font-size: 11px; font-family: inherit;
        display: flex; align-items: center; gap: 7px;
        outline: ${p.color === getBackground() ? '2px solid #fff' : '2px solid transparent'};
        outline-offset: 1px; transition: background .1s;
      `
      const swatch = document.createElement('div')
      swatch.style.cssText = `
        width: 14px; height: 14px; border-radius: 3px; flex-shrink: 0;
        background: ${p.color}; border: 1px solid rgba(0,0,0,0.15);
      `
      const lbl = document.createElement('span')
      lbl.textContent = p.label
      btn.appendChild(swatch)
      btn.appendChild(lbl)
      btn.addEventListener('pointerenter', () => { btn.style.background = 'rgba(255,255,255,0.1)' })
      btn.addEventListener('pointerleave', () => { btn.style.background = 'rgba(255,255,255,0.05)' })
      btn.addEventListener('pointerdown', e => {
        e.stopPropagation()
        setBackground(p.color)
        refresh()
      })
      grid.appendChild(btn)
    }
    panel.appendChild(grid)
    return panel
  }

  // ── Grid ───────────────────────────────────────────────────────────────────

  grid(): HTMLElement {
    const { getGridConfig, setGrid } = this.deps
    const panel = document.createElement('div')
    panel.style.cssText = PANEL_BASE + 'min-width: 200px;'

    const title = document.createElement('div')
    title.textContent = 'Grid'
    title.style.cssText = 'font-size: 11px; color: #9ca3af; margin-bottom: 10px; letter-spacing: .03em;'
    panel.appendChild(title)

    const row = (label: string, control: HTMLElement): HTMLElement => {
      const wrap = document.createElement('div')
      wrap.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;'
      const lbl = document.createElement('span')
      lbl.textContent = label
      lbl.style.cssText = 'font-size: 12px; color: #d1d5db;'
      wrap.appendChild(lbl)
      wrap.appendChild(control)
      return wrap
    }

    // Toggle
    const toggleBtn = document.createElement('button')
    const refreshToggle = (): void => {
      const on = getGridConfig().visible
      toggleBtn.textContent = on ? 'On' : 'Off'
      toggleBtn.style.background = on ? '#1a73e8' : 'rgba(255,255,255,0.08)'
      toggleBtn.style.color = on ? '#fff' : '#9ca3af'
    }
    toggleBtn.style.cssText = `
      padding: 4px 12px; border-radius: 5px; cursor: pointer;
      border: 1px solid rgba(255,255,255,0.15);
      font-size: 11px; font-family: inherit; transition: background .1s, color .1s;
    `
    refreshToggle()
    toggleBtn.addEventListener('pointerdown', e => {
      e.stopPropagation()
      setGrid({ visible: !getGridConfig().visible })
      refreshToggle()
    })
    panel.appendChild(row('Show Grid', toggleBtn))

    // Type
    const typeWrap = document.createElement('div')
    typeWrap.style.cssText = 'display: flex; gap: 4px;'
    const refreshType = (): void => {
      typeWrap.querySelectorAll<HTMLElement>('[data-gtype]').forEach(el => {
        const active = el.dataset['gtype'] === getGridConfig().type
        el.style.background = active ? 'rgba(255,255,255,0.15)' : 'transparent'
        el.style.borderColor = active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'
      })
    }
    for (const t of ['dots', 'lines'] as const) {
      const btn = document.createElement('button')
      btn.dataset['gtype'] = t
      btn.textContent = t.charAt(0).toUpperCase() + t.slice(1)
      btn.style.cssText = `
        flex: 1; padding: 4px 0; border-radius: 5px; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.15);
        background: ${getGridConfig().type === t ? 'rgba(255,255,255,0.15)' : 'transparent'};
        color: #d1d5db; font-size: 11px; font-family: inherit; transition: background .1s;
      `
      btn.addEventListener('pointerdown', e => {
        e.stopPropagation()
        setGrid({ type: t })
        refreshType()
      })
      typeWrap.appendChild(btn)
    }
    panel.appendChild(row('Type', typeWrap))

    // Size
    const sizeWrap = document.createElement('div')
    sizeWrap.style.cssText = 'display: flex; gap: 4px;'
    const SIZES = [{ label: 'S', value: 10 }, { label: 'M', value: 20 }, { label: 'L', value: 40 }]
    const refreshSize = (): void => {
      sizeWrap.querySelectorAll<HTMLElement>('[data-gsize]').forEach(el => {
        const active = el.dataset['gsize'] === String(getGridConfig().size)
        el.style.background = active ? 'rgba(255,255,255,0.15)' : 'transparent'
        el.style.borderColor = active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'
      })
    }
    for (const s of SIZES) {
      const btn = document.createElement('button')
      btn.dataset['gsize'] = String(s.value)
      btn.textContent = s.label
      btn.style.cssText = `
        flex: 1; padding: 4px 0; border-radius: 5px; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.15);
        background: ${getGridConfig().size === s.value ? 'rgba(255,255,255,0.15)' : 'transparent'};
        color: #d1d5db; font-size: 11px; font-family: inherit; transition: background .1s;
      `
      btn.addEventListener('pointerdown', e => {
        e.stopPropagation()
        setGrid({ size: s.value })
        refreshSize()
      })
      sizeWrap.appendChild(btn)
    }
    panel.appendChild(row('Size', sizeWrap))
    return panel
  }

  // ── Auto layout ────────────────────────────────────────────────────────────

  autoLayout(): HTMLElement {
    const { graph, contextMenu, scheduleRender, beforeMutation } = this.deps
    const panel = document.createElement('div')
    panel.style.cssText = PANEL_BASE + 'min-width: 180px;'

    const title = document.createElement('div')
    title.textContent = 'Auto Layout'
    title.style.cssText = 'font-size: 11px; color: #9ca3af; margin-bottom: 10px; letter-spacing: .03em;'
    panel.appendChild(title)

    const makeBtn = (label: string, desc: string, onClick: () => void): HTMLElement => {
      const btn = document.createElement('button')
      btn.style.cssText = `
        width: 100%; padding: 10px 12px; border-radius: 6px; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.05);
        color: #d1d5db; font-family: inherit;
        text-align: left; margin-bottom: 6px; transition: background .1s;
      `
      const name = document.createElement('div')
      name.textContent = label
      name.style.cssText = 'font-size: 12px; font-weight: 500;'
      const sub = document.createElement('div')
      sub.textContent = desc
      sub.style.cssText = 'font-size: 10px; color: #6b7280; margin-top: 2px;'
      btn.appendChild(name)
      btn.appendChild(sub)
      btn.addEventListener('pointerenter', () => { btn.style.background = 'rgba(255,255,255,0.1)' })
      btn.addEventListener('pointerleave', () => { btn.style.background = 'rgba(255,255,255,0.05)' })
      btn.addEventListener('pointerdown', e => {
        e.stopPropagation()
        onClick()
        contextMenu.hide()
      })
      return btn
    }

    panel.appendChild(makeBtn('Hierarchical', 'Layer-based, minimizes edge crossings', () => {
      beforeMutation()
      const result = hierarchicalLayout(graph.getNodes(), graph.getEdges())
      for (const [id, pos] of result) graph.updateNode(id, pos)
      scheduleRender()
    }))

    panel.appendChild(makeBtn('Force', 'Spring-based organic arrangement', () => {
      beforeMutation()
      const result = forceLayout(graph.getNodes(), graph.getEdges())
      for (const [id, pos] of result) graph.updateNode(id, pos)
      scheduleRender()
    }))

    panel.appendChild(makeBtn('Grid', 'Arrange nodes in a uniform grid', () => {
      beforeMutation()
      const result = gridLayout(graph.getNodes())
      for (const [id, pos] of result) graph.updateNode(id, pos)
      scheduleRender()
    }))

    return panel
  }

  dispose(): void {
    // Panel HTMLElements are factory-created per context-menu show; they are
    // appended to and removed from DOM by ContextMenu, which owns their lifecycle.
    // The deps object holds no DOM references that need teardown here.
  }
}
