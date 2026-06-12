import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FlowChart } from '../flowchart'

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  Object.defineProperty(div, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
  })
  document.body.appendChild(div)
  return div
}

describe('ViewportPortal — 0.6.0', () => {
  let container: HTMLElement
  let chart: FlowChart

  beforeEach(() => {
    container = makeContainer()
    chart = new FlowChart({ container, onError: () => {} })
  })
  afterEach(() => {
    chart.dispose()
    container.remove()
  })

  it('addViewportPortal mounts an absolutely-positioned div', () => {
    const id = chart.addViewportPortal({ x: 100, y: 200, content: 'hello' })
    expect(id).toMatch(/^flowgl-viewport-portal-/)
    const el = container.querySelector(`[data-flowgl-viewport-portal="${id}"]`) as HTMLDivElement
    expect(el).not.toBeNull()
    expect(el.style.position).toBe('absolute')
    expect(el.style.transformOrigin).toBe('0 0')
    expect(el.textContent).toBe('hello')
  })

  it('initial transform reflects world→screen + scale(zoom)', () => {
    const id = chart.addViewportPortal({ x: 50, y: 80, content: 'x' })
    const el = container.querySelector(`[data-flowgl-viewport-portal="${id}"]`) as HTMLDivElement
    // At zoom 1, default viewport: transform = translate(sx,sy) scale(1)
    expect(el.style.transform).toMatch(/^translate\(.+?\) scale\(1\)$/)
  })

  it('zoom changes are reflected in the transform on next render-loop tick', () => {
    const id = chart.addViewportPortal({ x: 50, y: 80, content: 'x' })
    chart.setViewport({ ...chart.getViewport(), zoom: 2 })
    // Force reposition by triggering an update call (synchronous path)
    chart.updateViewportPortal(id, { x: 50, y: 80 })
    const el = container.querySelector(`[data-flowgl-viewport-portal="${id}"]`) as HTMLDivElement
    expect(el.style.transform).toMatch(/scale\(2\)$/)
  })

  it('explicit width/height set inline px', () => {
    const id = chart.addViewportPortal({ x: 0, y: 0, width: 200, height: 80, content: 'x' })
    const el = container.querySelector(`[data-flowgl-viewport-portal="${id}"]`) as HTMLDivElement
    expect(el.style.width).toBe('200px')
    expect(el.style.height).toBe('80px')
  })

  it('HTMLElement content is appended as-is', () => {
    const span = document.createElement('span')
    span.textContent = 'el-content'
    const id = chart.addViewportPortal({ x: 0, y: 0, content: span })
    const el = container.querySelector(`[data-flowgl-viewport-portal="${id}"]`) as HTMLDivElement
    expect(el.querySelector('span')?.textContent).toBe('el-content')
  })

  it('updateViewportPortal mutates position + content + size', () => {
    const id = chart.addViewportPortal({ x: 0, y: 0, content: 'a' })
    expect(chart.updateViewportPortal(id, { x: 100, y: 200, content: 'b', width: 50 })).toBe(true)
    const el = container.querySelector(`[data-flowgl-viewport-portal="${id}"]`) as HTMLDivElement
    expect(el.textContent).toBe('b')
    expect(el.style.width).toBe('50px')
  })

  it('updateViewportPortal returns false on unknown id', () => {
    expect(chart.updateViewportPortal('nope', { x: 0 })).toBe(false)
  })

  it('removeViewportPortal detaches from DOM', () => {
    const id = chart.addViewportPortal({ x: 0, y: 0, content: 'x' })
    expect(chart.removeViewportPortal(id)).toBe(true)
    expect(container.querySelector(`[data-flowgl-viewport-portal="${id}"]`)).toBeNull()
  })

  it('removeViewportPortal returns false on unknown id', () => {
    expect(chart.removeViewportPortal('nope')).toBe(false)
  })

  it('listViewportPortals returns mounted ids', () => {
    const a = chart.addViewportPortal({ x: 0, y: 0, content: 'A' })
    const b = chart.addViewportPortal({ x: 100, y: 0, content: 'B' })
    expect(chart.listViewportPortals().sort()).toEqual([a, b].sort())
  })

  it('dispose tears every portal down', () => {
    chart.addViewportPortal({ x: 0, y: 0, content: 'A' })
    chart.addViewportPortal({ x: 100, y: 0, content: 'B' })
    expect(container.querySelectorAll('[data-flowgl-viewport-portal]').length).toBe(2)
    chart.dispose()
    expect(container.querySelectorAll('[data-flowgl-viewport-portal]').length).toBe(0)
    chart = new FlowChart({ container, onError: () => {} })
  })

  it('re-adding the same id replaces the prior mount', () => {
    chart.addViewportPortal({ id: 'duped', x: 0, y: 0, content: 'first' })
    chart.addViewportPortal({ id: 'duped', x: 0, y: 0, content: 'second' })
    const els = container.querySelectorAll('[data-flowgl-viewport-portal="duped"]')
    expect(els.length).toBe(1)
    expect(els[0]!.textContent).toBe('second')
  })

  it('className strips attribute-breakout characters', () => {
    const id = chart.addViewportPortal({ x: 0, y: 0, content: 'x', className: 'ok" onclick="alert(1)' })
    const el = container.querySelector(`[data-flowgl-viewport-portal="${id}"]`) as HTMLDivElement
    expect(el.className).not.toMatch(/[="()]/)
  })
})
