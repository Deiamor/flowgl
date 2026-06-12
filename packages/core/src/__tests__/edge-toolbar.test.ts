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

describe('EdgeToolbar — 0.7.0', () => {
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

  it('addEdgeToolbar mounts a div with role=toolbar bound to the requested edge', () => {
    const id = chart.addEdgeToolbar({ edgeId: 'e1', content: '<button>delete</button>' })
    expect(id).toMatch(/^flowgl-edge-toolbar-/)
    const el = container.querySelector(`[data-flowgl-edge-toolbar="${id}"]`) as HTMLDivElement
    expect(el).not.toBeNull()
    expect(el.getAttribute('role')).toBe('toolbar')
    expect(el.querySelector('button')?.textContent).toBe('delete')
  })

  it('isVisible: true forces the toolbar visible without selection', () => {
    const id = chart.addEdgeToolbar({ edgeId: 'e1', content: 'x', isVisible: true })
    const el = container.querySelector(`[data-flowgl-edge-toolbar="${id}"]`) as HTMLDivElement
    expect(el.getAttribute('data-visible')).toBe('true')
  })

  it('isVisible: false keeps the toolbar hidden even when the edge is selected', () => {
    chart.setSelection({ edges: ['e1'] })
    const id = chart.addEdgeToolbar({ edgeId: 'e1', content: 'x', isVisible: false })
    const el = container.querySelector(`[data-flowgl-edge-toolbar="${id}"]`) as HTMLDivElement
    expect(el.getAttribute('data-visible')).toBe('false')
  })

  it('isVisible default ("auto") shows only when the edge is in the selection', () => {
    const id = chart.addEdgeToolbar({ edgeId: 'e1', content: 'x' })
    const el = container.querySelector(`[data-flowgl-edge-toolbar="${id}"]`) as HTMLDivElement
    expect(el.getAttribute('data-visible')).toBe('false')
    chart.setSelection({ edges: ['e1'] })
    expect(el.getAttribute('data-visible')).toBe('true')
    chart.setSelection({ edges: [] })
    expect(el.getAttribute('data-visible')).toBe('false')
  })

  it('hides when the edge is removed', () => {
    const id = chart.addEdgeToolbar({ edgeId: 'e1', content: 'x', isVisible: true })
    chart.removeEdge('e1')
    chart.updateEdgeToolbar(id, {})
    const el = container.querySelector(`[data-flowgl-edge-toolbar="${id}"]`) as HTMLDivElement
    expect(el.getAttribute('data-visible')).toBe('false')
  })

  it('hides when one endpoint node disappears', () => {
    const id = chart.addEdgeToolbar({ edgeId: 'e1', content: 'x', isVisible: true })
    chart.removeNode('a')
    chart.updateEdgeToolbar(id, {})
    const el = container.querySelector(`[data-flowgl-edge-toolbar="${id}"]`) as HTMLDivElement
    expect(el.getAttribute('data-visible')).toBe('false')
  })

  it('updateEdgeToolbar mutates content + align + offset', () => {
    const id = chart.addEdgeToolbar({ edgeId: 'e1', content: 'orig', isVisible: true })
    expect(chart.updateEdgeToolbar(id, { content: 'next', align: 'below', offset: 20 })).toBe(true)
    const el = container.querySelector(`[data-flowgl-edge-toolbar="${id}"]`) as HTMLDivElement
    expect(el.textContent).toBe('next')
    expect(el.style.transform).toContain('translate(-50%, 0%)')
  })

  it('updateEdgeToolbar returns false on unknown id', () => {
    expect(chart.updateEdgeToolbar('nope', { content: 'x' })).toBe(false)
  })

  it('removeEdgeToolbar detaches from DOM', () => {
    const id = chart.addEdgeToolbar({ edgeId: 'e1', content: 'x' })
    expect(chart.removeEdgeToolbar(id)).toBe(true)
    expect(container.querySelector(`[data-flowgl-edge-toolbar="${id}"]`)).toBeNull()
  })

  it('removeEdgeToolbar returns false on unknown id', () => {
    expect(chart.removeEdgeToolbar('nope')).toBe(false)
  })

  it('listEdgeToolbars returns mounted ids', () => {
    chart.addEdge({ id: 'e2', source: 'b', target: 'a' })
    const a = chart.addEdgeToolbar({ edgeId: 'e1', content: 'A' })
    const b = chart.addEdgeToolbar({ edgeId: 'e2', content: 'B' })
    expect(chart.listEdgeToolbars().sort()).toEqual([a, b].sort())
  })

  it('dispose tears every edge toolbar down', () => {
    chart.addEdgeToolbar({ edgeId: 'e1', content: 'x', isVisible: true })
    expect(container.querySelectorAll('[data-flowgl-edge-toolbar]').length).toBe(1)
    chart.dispose()
    expect(container.querySelectorAll('[data-flowgl-edge-toolbar]').length).toBe(0)
    chart = new FlowChart({ container, onError: () => {} })
  })

  it('align "above" centers horizontally and anchors the toolbar bottom at the midpoint', () => {
    const id = chart.addEdgeToolbar({ edgeId: 'e1', content: 'x', isVisible: true, align: 'above', offset: 10 })
    const el = container.querySelector(`[data-flowgl-edge-toolbar="${id}"]`) as HTMLDivElement
    expect(el.style.transform).toContain('translate(-50%, -100%)')
  })

  it('default align is "above"', () => {
    const id = chart.addEdgeToolbar({ edgeId: 'e1', content: 'x', isVisible: true })
    const el = container.querySelector(`[data-flowgl-edge-toolbar="${id}"]`) as HTMLDivElement
    expect(el.style.transform).toContain('translate(-50%, -100%)')
  })

  it('HTMLElement content appended as-is', () => {
    const span = document.createElement('span')
    span.textContent = 'inner'
    const id = chart.addEdgeToolbar({ edgeId: 'e1', content: span, isVisible: true })
    const el = container.querySelector(`[data-flowgl-edge-toolbar="${id}"]`) as HTMLDivElement
    expect(el.querySelector('span')?.textContent).toBe('inner')
  })
})
