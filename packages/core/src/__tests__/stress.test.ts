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

/**
 * Stress / churn tests. Drive thousands of add/remove cycles through the
 * chart and assert that internal data structures don't grow unboundedly,
 * subscribers don't leak across mutations, and dispose() releases
 * everything.
 *
 * The classic flowchart memory-leak triggers we exercise:
 *   - Add → remove → add a node with the same id. Caches keyed by id
 *     (atlas SDF entries, edge fingerprint strips) must not retain
 *     references to old data.
 *   - Nodes whose data is updated thousands of times. Subscriber set
 *     and dataUpdateStack must remain at constant size.
 *   - Overlay layers (Panel, NodeToolbar, EdgeToolbar, EdgeLabel,
 *     ViewportPortal) added and removed repeatedly. The mounted map
 *     and DOM nodes must drain to zero.
 *
 * happy-dom has no WebGL, so the WebGL programs are not exercised
 * — but the CPU-side caches and subscriber bookkeeping (which is
 * where the real-world leaks live) are.
 */

describe('Stress — churn + leak detection (0.8.2 production gate)', () => {
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

  it('1000 add/remove cycles leave node and edge counts at zero', () => {
    for (let i = 0; i < 1000; i++) {
      chart.addNode({ id: `n${i}`, label: `n${i}`, x: i, y: i, width: 50, height: 30 })
      if (i > 0) chart.addEdge({ id: `e${i}`, source: `n${i - 1}`, target: `n${i}` })
    }
    expect(chart.getNodes().length).toBe(1000)
    expect(chart.getEdges().length).toBe(999)

    // Remove every node — edges should cascade.
    for (let i = 0; i < 1000; i++) chart.removeNode(`n${i}`)
    expect(chart.getNodes().length).toBe(0)
    expect(chart.getEdges().length).toBe(0)
  })

  it('add → remove → add same id 500 times, internal state stays consistent', () => {
    for (let i = 0; i < 500; i++) {
      chart.addNode({ id: 'churn', label: 'x', x: 0, y: 0, width: 50, height: 30 })
      expect(chart.getNode('churn')).not.toBeUndefined()
      chart.removeNode('churn')
      expect(chart.getNode('churn')).toBeUndefined()
    }
    expect(chart.getNodes().length).toBe(0)
  })

  it('updateNodeData fired 5000× holds subscriber count constant', () => {
    chart.addNode({ id: 'a', label: 'a', x: 0, y: 0, width: 50, height: 30, data: { v: 0 } })
    const unsub = chart.subscribeNodeData('a', () => {})
    expect(chart.getNodeDataSubscriberCount('a')).toBe(1)
    for (let i = 0; i < 5000; i++) chart.updateNodeData('a', { v: i })
    expect(chart.getNodeDataSubscriberCount('a')).toBe(1)
    unsub()
    expect(chart.getNodeDataSubscriberCount('a')).toBe(0)
  })

  it('subscribe / unsubscribe 1000 cycles drain to zero', () => {
    chart.addNode({ id: 'a', label: 'a', x: 0, y: 0, width: 50, height: 30 })
    for (let i = 0; i < 1000; i++) {
      const unsub = chart.subscribeNodeData('a', () => {})
      unsub()
    }
    expect(chart.getNodeDataSubscriberCount('a')).toBe(0)
  })

  it('Panel + NodeToolbar + ViewportPortal + EdgeLabel + EdgeToolbar — 200 mount/unmount cycles drain DOM', () => {
    chart.addNode({ id: 'a', label: 'a', x: 0, y: 0, width: 50, height: 30 })
    chart.addNode({ id: 'b', label: 'b', x: 200, y: 0, width: 50, height: 30 })
    chart.addEdge({ id: 'e1', source: 'a', target: 'b' })
    for (let i = 0; i < 200; i++) {
      const p = chart.addPanel({ position: 'top-left', content: 'x' })
      const t = chart.addNodeToolbar({ nodeId: 'a', content: 'x', isVisible: true })
      const v = chart.addViewportPortal({ x: 0, y: 0, width: 10, height: 10, content: 'x' })
      const el = chart.addEdgeLabel({ edgeId: 'e1', content: 'x' })
      const et = chart.addEdgeToolbar({ edgeId: 'e1', content: 'x', isVisible: true })
      chart.removePanel(p)
      chart.removeNodeToolbar(t)
      chart.removeViewportPortal(v)
      chart.removeEdgeLabel(el)
      chart.removeEdgeToolbar(et)
    }
    expect(chart.listPanels().length).toBe(0)
    expect(chart.listNodeToolbars().length).toBe(0)
    expect(chart.listViewportPortals().length).toBe(0)
    expect(chart.listEdgeLabels().length).toBe(0)
    expect(chart.listEdgeToolbars().length).toBe(0)
    expect(container.querySelectorAll('[data-flowgl-node-toolbar]').length).toBe(0)
    expect(container.querySelectorAll('[data-flowgl-edge-toolbar]').length).toBe(0)
    expect(container.querySelectorAll('[data-flowgl-edge-label]').length).toBe(0)
    expect(container.querySelectorAll('[data-flowgl-viewport-portal]').length).toBe(0)
  })

  it('history snapshots stay bounded by historyLimit under 2000 mutations', () => {
    const chart2 = new FlowChart({ container: makeContainer(), historyLimit: 50, onError: () => {} })
    for (let i = 0; i < 2000; i++) {
      chart2.addNode({ id: `n${i}`, label: 'x', x: i, y: 0, width: 30, height: 30 })
    }
    // history depth never exceeds the configured cap
    let depth = 0
    while (chart2.undo()) depth++
    expect(depth).toBeLessThanOrEqual(50)
    chart2.dispose()
  })

  it('viewport zoom + pan churn 3000 ops does not throw and keeps state coherent', () => {
    for (let i = 0; i < 3000; i++) {
      const zoom = 0.5 + (i % 20) / 10
      chart.setViewport({ x: i, y: i * 2, zoom })
    }
    const v = chart.getViewport()
    expect(Number.isFinite(v.x)).toBe(true)
    expect(Number.isFinite(v.y)).toBe(true)
    expect(v.zoom).toBeGreaterThan(0)
  })

  it('dispose after heavy churn detaches every overlay layer DOM node', () => {
    for (let i = 0; i < 100; i++) {
      chart.addNode({ id: `n${i}`, label: 'x', x: i * 5, y: 0, width: 30, height: 30 })
    }
    chart.addEdge({ id: 'e', source: 'n0', target: 'n99' })
    chart.addPanel({ position: 'top-right', content: 'p' })
    chart.addNodeToolbar({ nodeId: 'n0', content: 'tb', isVisible: true })
    chart.addEdgeToolbar({ edgeId: 'e', content: 'et', isVisible: true })
    chart.addEdgeLabel({ edgeId: 'e', content: 'el' })
    chart.addViewportPortal({ x: 0, y: 0, width: 10, height: 10, content: 'vp' })

    chart.dispose()
    expect(container.querySelectorAll('[data-flowgl-panel]').length).toBe(0)
    expect(container.querySelectorAll('[data-flowgl-node-toolbar]').length).toBe(0)
    expect(container.querySelectorAll('[data-flowgl-edge-toolbar]').length).toBe(0)
    expect(container.querySelectorAll('[data-flowgl-edge-label]').length).toBe(0)
    expect(container.querySelectorAll('[data-flowgl-viewport-portal]').length).toBe(0)

    // Reinit so afterEach can dispose safely
    chart = new FlowChart({ container, onError: () => {} })
  })

  it('toJSON ↔ fromJSON of 1000 nodes round-trips without growth', () => {
    for (let i = 0; i < 1000; i++) {
      chart.addNode({ id: `n${i}`, label: `n${i}`, x: i, y: i, width: 50, height: 30 })
    }
    const json = chart.toJSON()
    chart.fromJSON(json)
    expect(chart.getNodes().length).toBe(1000)
    const json2 = chart.toJSON()
    expect(json2.nodes.length).toBe(json.nodes.length)
    expect(json2.edges.length).toBe(json.edges.length)
  })
})
