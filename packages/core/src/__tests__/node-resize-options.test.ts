import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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

// 0.6.0 — options are now stored on FlowChart itself (not just on the
// NodeResize interaction layer), so they survive a WebGL-failed init and can
// be read back even when the interaction module never constructed. The
// resize behaviour itself is covered by existing NodeResize tests; this
// file pins the options round-trip on the public surface.

describe('NodeResize options — 0.6.0 polish', () => {
  let container: HTMLElement
  let chart: FlowChart

  beforeEach(() => {
    container = makeContainer()
    chart = new FlowChart({
      container,
      nodes: [n('a', 100, 100, 150, 100)],
      onError: () => {},
    })
  })
  afterEach(() => {
    chart.dispose()
    container.remove()
  })

  it('setOptions / getOptions roundtrips', () => {
    chart.setNodeResizeOptions({ minWidth: 60, minHeight: 40, keepAspectRatio: true })
    expect(chart.getNodeResizeOptions()).toEqual({ minWidth: 60, minHeight: 40, keepAspectRatio: true })
  })

  it('FlowChartOptions.nodeResize applies on construct', () => {
    const c2 = new FlowChart({
      container: makeContainer(),
      nodes: [n('a')],
      nodeResize: { minWidth: 80, minHeight: 50 },
      onError: () => {},
    })
    expect(c2.getNodeResizeOptions().minWidth).toBe(80)
    expect(c2.getNodeResizeOptions().minHeight).toBe(50)
    c2.dispose()
  })

  it('options object replaces individual fields without dropping others', () => {
    chart.setNodeResizeOptions({ minWidth: 60 })
    chart.setNodeResizeOptions({ maxWidth: 500 })
    const o = chart.getNodeResizeOptions()
    expect(o.minWidth).toBe(60)
    expect(o.maxWidth).toBe(500)
  })

  it('shouldResize predicate is callable and receives the node', () => {
    const fn = vi.fn(() => true)
    chart.setNodeResizeOptions({ shouldResize: fn })
    const cb = chart.getNodeResizeOptions().shouldResize!
    cb(n('x'))
    expect(fn).toHaveBeenCalledOnce()
  })

  it('onResizeStart / onResize / onResizeEnd are stored in options', () => {
    const start = vi.fn(), live = vi.fn(), end = vi.fn()
    chart.setNodeResizeOptions({ onResizeStart: start, onResize: live, onResizeEnd: end })
    expect(chart.getNodeResizeOptions().onResizeStart).toBe(start)
    expect(chart.getNodeResizeOptions().onResize).toBe(live)
    expect(chart.getNodeResizeOptions().onResizeEnd).toBe(end)
  })

  it('keepAspectRatio default is undefined / false', () => {
    expect(chart.getNodeResizeOptions().keepAspectRatio).toBeUndefined()
  })

  it('maxWidth / maxHeight stored when supplied', () => {
    chart.setNodeResizeOptions({ maxWidth: 1000, maxHeight: 800 })
    expect(chart.getNodeResizeOptions().maxWidth).toBe(1000)
    expect(chart.getNodeResizeOptions().maxHeight).toBe(800)
  })
})

// applyResize is module-private; assert its observable contract through the
// options channel exclusively above. Visual behavior of resize handles is
// covered by the existing NodeResize tests in node-resize.test.ts.
