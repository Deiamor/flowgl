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

const node = (id: string, x = 100, y = 100, w = 120, h = 60): NodeData => ({
  id, label: id, x, y, width: w, height: h,
})

describe('NodeToolbar — 0.5.0', () => {
  let container: HTMLElement
  let chart: FlowChart

  beforeEach(() => {
    container = makeContainer()
    chart = new FlowChart({
      container,
      nodes: [node('a', 100, 100), node('b', 400, 100)],
      onError: () => {},
    })
  })
  afterEach(() => {
    chart.dispose()
    container.remove()
  })

  it('addNodeToolbar mounts a toolbar div bound to the requested node', () => {
    const id = chart.addNodeToolbar({ nodeId: 'a', content: '<button>delete</button>' })
    expect(id).toMatch(/^flowgl-node-toolbar-/)
    const el = container.querySelector(`[data-flowgl-node-toolbar="${id}"]`) as HTMLDivElement
    expect(el).not.toBeNull()
    expect(el.getAttribute('role')).toBe('toolbar')
    expect(el.querySelector('button')?.textContent).toBe('delete')
  })

  it('isVisible: true forces the toolbar visible without selection', () => {
    const id = chart.addNodeToolbar({ nodeId: 'a', content: 'x', isVisible: true })
    const el = container.querySelector(`[data-flowgl-node-toolbar="${id}"]`) as HTMLDivElement
    expect(el.getAttribute('data-visible')).toBe('true')
  })

  it('isVisible: false keeps the toolbar hidden even when selected', () => {
    chart.setSelectedIds(['a'])
    const id = chart.addNodeToolbar({ nodeId: 'a', content: 'x', isVisible: false })
    const el = container.querySelector(`[data-flowgl-node-toolbar="${id}"]`) as HTMLDivElement
    expect(el.getAttribute('data-visible')).toBe('false')
  })

  it('isVisible default ("auto") shows only when the node is in the selection', () => {
    const id = chart.addNodeToolbar({ nodeId: 'a', content: 'x' })
    const el = container.querySelector(`[data-flowgl-node-toolbar="${id}"]`) as HTMLDivElement
    expect(el.getAttribute('data-visible')).toBe('false')
    chart.setSelectedIds(['a'])
    // setSelection is synchronous through the toolbar layer
    expect(el.getAttribute('data-visible')).toBe('true')
  })

  it('multi-node toolbar with array nodeId is visible only when every target is in the selection', () => {
    const id = chart.addNodeToolbar({ nodeId: ['a', 'b'], content: 'pair' })
    const el = container.querySelector(`[data-flowgl-node-toolbar="${id}"]`) as HTMLDivElement
    chart.setSelectedIds(['a'])
    expect(el.getAttribute('data-visible')).toBe('false')
    chart.setSelectedIds(['a', 'b'])
    expect(el.getAttribute('data-visible')).toBe('true')
  })

  it('updateNodeToolbar mutates content and position', () => {
    const id = chart.addNodeToolbar({ nodeId: 'a', content: 'orig', isVisible: true })
    expect(chart.updateNodeToolbar(id, { content: 'next', position: 'bottom', offset: 24 })).toBe(true)
    const el = container.querySelector(`[data-flowgl-node-toolbar="${id}"]`) as HTMLDivElement
    expect(el.textContent).toBe('next')
  })

  it('updateNodeToolbar returns false on unknown id', () => {
    expect(chart.updateNodeToolbar('nope', { content: 'x' })).toBe(false)
  })

  it('removeNodeToolbar detaches from DOM', () => {
    const id = chart.addNodeToolbar({ nodeId: 'a', content: 'x' })
    expect(chart.removeNodeToolbar(id)).toBe(true)
    expect(container.querySelector(`[data-flowgl-node-toolbar="${id}"]`)).toBeNull()
  })

  it('removeNodeToolbar returns false on unknown id', () => {
    expect(chart.removeNodeToolbar('nope')).toBe(false)
  })

  it('listNodeToolbars returns mounted ids', () => {
    const a = chart.addNodeToolbar({ nodeId: 'a', content: 'A' })
    const b = chart.addNodeToolbar({ nodeId: 'b', content: 'B' })
    expect(chart.listNodeToolbars().sort()).toEqual([a, b].sort())
  })

  it('dispose tears down every toolbar', () => {
    chart.addNodeToolbar({ nodeId: 'a', content: 'A' })
    chart.addNodeToolbar({ nodeId: 'b', content: 'B' })
    expect(container.querySelectorAll('[data-flowgl-node-toolbar]').length).toBe(2)
    chart.dispose()
    expect(container.querySelectorAll('[data-flowgl-node-toolbar]').length).toBe(0)
    chart = new FlowChart({ container, onError: () => {} })
  })

  it('unknown node id leaves the toolbar hidden without throwing', () => {
    const id = chart.addNodeToolbar({ nodeId: 'ghost', content: 'x', isVisible: true })
    const el = container.querySelector(`[data-flowgl-node-toolbar="${id}"]`) as HTMLDivElement
    expect(el.getAttribute('data-visible')).toBe('false')
  })

  it('multi-node toolbar hides if the selection contains extras (matches React Flow auto behaviour)', () => {
    chart.addNode(node('c', 700, 100))
    const id = chart.addNodeToolbar({ nodeId: ['a', 'b'], content: 'pair' })
    const el = container.querySelector(`[data-flowgl-node-toolbar="${id}"]`) as HTMLDivElement
    chart.setSelectedIds(['a', 'b'])
    expect(el.getAttribute('data-visible')).toBe('true')
    chart.setSelectedIds(['a', 'b', 'c'])
    expect(el.getAttribute('data-visible')).toBe('false')
  })
})
