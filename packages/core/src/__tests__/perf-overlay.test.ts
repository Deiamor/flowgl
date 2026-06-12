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

describe('PerfOverlay — 0.5.0 differentiator', () => {
  let container: HTMLElement
  let chart: FlowChart

  beforeEach(() => {
    container = makeContainer()
    chart = new FlowChart({
      container,
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 200, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
      onError: () => {},
    })
  })
  afterEach(() => {
    chart.dispose()
    container.remove()
  })

  it('hasPerfOverlay() is false before show', () => {
    expect(chart.hasPerfOverlay()).toBe(false)
  })

  it('showPerfOverlay mounts a visible overlay div', () => {
    chart.showPerfOverlay()
    expect(chart.hasPerfOverlay()).toBe(true)
    const el = container.querySelector('.flowgl-perf-overlay') as HTMLDivElement
    expect(el).not.toBeNull()
  })

  it('overlay has aria-label for screen readers', () => {
    chart.showPerfOverlay()
    const el = container.querySelector('.flowgl-perf-overlay') as HTMLDivElement
    expect(el.getAttribute('aria-label')).toMatch(/performance overlay/i)
  })

  it('position option places the overlay at the requested corner', () => {
    chart.showPerfOverlay({ position: 'bottom-left', offset: 20 })
    const el = container.querySelector('.flowgl-perf-overlay') as HTMLDivElement
    expect(el.style.bottom).toBe('20px')
    expect(el.style.left).toBe('20px')
  })

  it('showCounts: false omits node/edge rows', () => {
    chart.showPerfOverlay({ showCounts: false })
    const labels = Array.from(container.querySelectorAll('.flowgl-perf-overlay__label'))
      .map(n => n.textContent)
    expect(labels).not.toContain('nodes')
    expect(labels).not.toContain('edges')
  })

  it('showAtlas: false omits the atlas-generation row', () => {
    chart.showPerfOverlay({ showAtlas: false })
    const labels = Array.from(container.querySelectorAll('.flowgl-perf-overlay__label'))
      .map(n => n.textContent)
    expect(labels).not.toContain('atlas gen')
  })

  it('default mount includes fps + frame + counts + atlas rows', () => {
    chart.showPerfOverlay()
    const labels = Array.from(container.querySelectorAll('.flowgl-perf-overlay__label'))
      .map(n => n.textContent)
    expect(labels).toEqual(['fps', 'ms/frame', 'nodes', 'edges', 'atlas gen'])
  })

  it('hidePerfOverlay removes the overlay from DOM and stops RAF', () => {
    chart.showPerfOverlay()
    expect(chart.hidePerfOverlay()).toBe(true)
    expect(container.querySelector('.flowgl-perf-overlay')).toBeNull()
    expect(chart.hasPerfOverlay()).toBe(false)
  })

  it('hidePerfOverlay returns false when not visible', () => {
    expect(chart.hidePerfOverlay()).toBe(false)
  })

  it('showPerfOverlay called twice replaces the prior mount', () => {
    chart.showPerfOverlay({ position: 'top-left' })
    chart.showPerfOverlay({ position: 'bottom-right' })
    const els = container.querySelectorAll('.flowgl-perf-overlay')
    expect(els.length).toBe(1)
    expect((els[0] as HTMLElement).style.bottom).toBe('12px')
    expect((els[0] as HTMLElement).style.right).toBe('12px')
  })

  it('dispose tears down the overlay', () => {
    chart.showPerfOverlay()
    chart.dispose()
    expect(container.querySelector('.flowgl-perf-overlay')).toBeNull()
    chart = new FlowChart({ container, onError: () => {} })
  })
})
