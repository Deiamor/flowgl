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

// extent clamping is exercised through the private clampToExtent helper —
// we reach into the instance for unit-level coverage. The drag-end pipeline
// itself is covered by the existing drag.test.ts.
function clamp(chart: FlowChart, nodeId: string) {
  const node = chart.getNode(nodeId)!
  const c = chart as unknown as { clampToExtent: (n: typeof node) => { x: number; y: number } | null }
  return c.clampToExtent(node)
}

describe("NodeData.extent — 0.6.0", () => {
  let container: HTMLElement

  beforeEach(() => { container = makeContainer() })
  afterEach(() => { container.remove() })

  it('extent undefined → clampToExtent returns null', () => {
    const chart = new FlowChart({
      container,
      nodes: [{ id: 'a', label: 'A', x: 100, y: 100, width: 50, height: 30 }],
      onError: () => {},
    })
    expect(clamp(chart, 'a')).toBeNull()
    chart.dispose()
  })

  it("extent: 'parent' clamps child inside parent bbox", () => {
    const chart = new FlowChart({
      container,
      nodes: [
        { id: 'g', label: 'G', x: 0, y: 0, width: 300, height: 200, type: 'group' },
        { id: 'c', label: 'C', x: 320, y: 50, width: 40, height: 30, parentId: 'g', extent: 'parent' },
      ],
      onError: () => {},
    })
    const r = clamp(chart, 'c')
    expect(r).toEqual({ x: 260, y: 50 })  // 300 - 40 = 260; y already inside
    chart.dispose()
  })

  it("extent: 'parent' clamps on the negative axis too", () => {
    const chart = new FlowChart({
      container,
      nodes: [
        { id: 'g', label: 'G', x: 100, y: 100, width: 300, height: 200, type: 'group' },
        { id: 'c', label: 'C', x: 50, y: 50, width: 40, height: 30, parentId: 'g', extent: 'parent' },
      ],
      onError: () => {},
    })
    const r = clamp(chart, 'c')
    expect(r).toEqual({ x: 100, y: 100 })
    chart.dispose()
  })

  it("extent: 'parent' with no parent reference returns null", () => {
    const chart = new FlowChart({
      container,
      nodes: [{ id: 'c', label: 'C', x: 0, y: 0, width: 40, height: 30, extent: 'parent' }],
      onError: () => {},
    })
    expect(clamp(chart, 'c')).toBeNull()
    chart.dispose()
  })

  it("extent: 'parent' with stale parentId returns null", () => {
    const chart = new FlowChart({
      container,
      nodes: [{ id: 'c', label: 'C', x: 0, y: 0, width: 40, height: 30, parentId: 'ghost', extent: 'parent' }],
      onError: () => {},
    })
    expect(clamp(chart, 'c')).toBeNull()
    chart.dispose()
  })

  it('extent as explicit rect clamps in both axes', () => {
    const chart = new FlowChart({
      container,
      nodes: [{
        id: 'c', label: 'C', x: 1000, y: -50, width: 40, height: 30,
        extent: { minX: 0, minY: 0, maxX: 500, maxY: 400 },
      }],
      onError: () => {},
    })
    expect(clamp(chart, 'c')).toEqual({ x: 460, y: 0 })  // 500 - 40 = 460; y clamped to 0
    chart.dispose()
  })

  it('extent: null is treated as no constraint', () => {
    const chart = new FlowChart({
      container,
      nodes: [{ id: 'c', label: 'C', x: 999, y: 999, width: 40, height: 30, extent: null }],
      onError: () => {},
    })
    expect(clamp(chart, 'c')).toBeNull()
    chart.dispose()
  })

  it('a node already inside its extent returns its current position', () => {
    const chart = new FlowChart({
      container,
      nodes: [{
        id: 'c', label: 'C', x: 50, y: 50, width: 40, height: 30,
        extent: { minX: 0, minY: 0, maxX: 200, maxY: 200 },
      }],
      onError: () => {},
    })
    expect(clamp(chart, 'c')).toEqual({ x: 50, y: 50 })
    chart.dispose()
  })
})
