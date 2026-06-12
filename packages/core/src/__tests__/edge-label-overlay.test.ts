import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FlowChart } from '../flowchart'
import type { NodeData } from '../graph/node'

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  Object.defineProperty(div, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
  })
  document.body.appendChild(div)
  return div
}

const n = (id: string, x = 0, y = 0, w = 100, h = 50): NodeData => ({
  id, label: id, x, y, width: w, height: h,
})

describe('EdgeLabel HTML overlay — 0.6.0', () => {
  let container: HTMLElement
  let chart: FlowChart

  beforeEach(() => {
    container = makeContainer()
    chart = new FlowChart({
      container,
      nodes: [n('a', 0, 0), n('b', 400, 0)],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
      onError: () => {},
    })
  })
  afterEach(() => {
    chart.dispose()
    container.remove()
  })

  it('addEdgeLabel mounts a div anchored at the edge midpoint', () => {
    const id = chart.addEdgeLabel({ edgeId: 'e1', content: '<span>OK</span>' })
    expect(id).toMatch(/^flowgl-edge-label-/)
    const el = container.querySelector(`[data-flowgl-edge-label="${id}"]`) as HTMLDivElement
    expect(el).not.toBeNull()
    expect(el.getAttribute('data-visible')).toBe('true')
    expect(el.querySelector('span')?.textContent).toBe('OK')
  })

  it('label hides when the edge is removed', () => {
    const id = chart.addEdgeLabel({ edgeId: 'e1', content: 'x' })
    chart.removeEdge('e1')
    const el = container.querySelector(`[data-flowgl-edge-label="${id}"]`) as HTMLDivElement
    // Force a reposition by issuing a no-op update
    chart.updateEdgeLabel(id, {})
    expect(el.getAttribute('data-visible')).toBe('false')
  })

  it('label hides when one endpoint node disappears', () => {
    const id = chart.addEdgeLabel({ edgeId: 'e1', content: 'x' })
    chart.removeNode('a')
    chart.updateEdgeLabel(id, {})
    const el = container.querySelector(`[data-flowgl-edge-label="${id}"]`) as HTMLDivElement
    expect(el.getAttribute('data-visible')).toBe('false')
  })

  it('label transform centers on the midpoint via translate(-50%, -50%)', () => {
    const id = chart.addEdgeLabel({ edgeId: 'e1', content: 'x' })
    const el = container.querySelector(`[data-flowgl-edge-label="${id}"]`) as HTMLDivElement
    expect(el.style.transform).toMatch(/translate\(-50%, ?-50%\)/)
  })

  it('updateEdgeLabel mutates content + t', () => {
    const id = chart.addEdgeLabel({ edgeId: 'e1', content: 'a' })
    expect(chart.updateEdgeLabel(id, { content: 'b', t: 0.25 })).toBe(true)
    const el = container.querySelector(`[data-flowgl-edge-label="${id}"]`) as HTMLDivElement
    expect(el.textContent).toBe('b')
  })

  it('updateEdgeLabel returns false on unknown id', () => {
    expect(chart.updateEdgeLabel('nope', { content: 'x' })).toBe(false)
  })

  it('removeEdgeLabel detaches from DOM', () => {
    const id = chart.addEdgeLabel({ edgeId: 'e1', content: 'x' })
    expect(chart.removeEdgeLabel(id)).toBe(true)
    expect(container.querySelector(`[data-flowgl-edge-label="${id}"]`)).toBeNull()
  })

  it('removeEdgeLabel returns false on unknown id', () => {
    expect(chart.removeEdgeLabel('nope')).toBe(false)
  })

  it('listEdgeLabels returns mounted ids', () => {
    const a = chart.addEdgeLabel({ edgeId: 'e1', content: 'A' })
    chart.addEdge({ id: 'e2', source: 'b', target: 'a' })
    const b = chart.addEdgeLabel({ edgeId: 'e2', content: 'B' })
    expect(chart.listEdgeLabels().sort()).toEqual([a, b].sort())
  })

  it('dispose tears every edge label down', () => {
    chart.addEdgeLabel({ edgeId: 'e1', content: 'x' })
    expect(container.querySelectorAll('[data-flowgl-edge-label]').length).toBe(1)
    chart.dispose()
    expect(container.querySelectorAll('[data-flowgl-edge-label]').length).toBe(0)
    chart = new FlowChart({ container, onError: () => {} })
  })

  it('HTMLElement content appended as-is', () => {
    const span = document.createElement('span')
    span.textContent = 'inner-el'
    const id = chart.addEdgeLabel({ edgeId: 'e1', content: span })
    const el = container.querySelector(`[data-flowgl-edge-label="${id}"]`) as HTMLDivElement
    expect(el.querySelector('span')?.textContent).toBe('inner-el')
  })
})
