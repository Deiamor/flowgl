import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FlowChart } from '../flowchart'
import { HelperLinesLayer } from '../ui/helper-lines'
import { Graph } from '../graph/graph'
import { Viewport } from '../viewport/viewport'

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  Object.defineProperty(div, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
  })
  document.body.appendChild(div)
  return div
}

describe('HelperLines — 0.8.0', () => {
  let container: HTMLElement
  let chart: FlowChart

  beforeEach(() => {
    container = makeContainer()
    chart = new FlowChart({
      container,
      nodes: [
        { id: 'a', label: 'A', x: 100, y: 100, width: 100, height: 60 },
        { id: 'b', label: 'B', x: 400, y: 400, width: 100, height: 60 },
      ],
      onError: () => {},
      helperLines: { enabled: true, snap: 5, show: 20 },
    })
  })
  afterEach(() => {
    chart.dispose()
    container.remove()
  })

  it('getHelperLinesOptions reflects the constructor input', () => {
    expect(chart.getHelperLinesOptions()).toMatchObject({ enabled: true, snap: 5, show: 20 })
  })

  it('setHelperLinesOptions merges partial', () => {
    chart.setHelperLinesOptions({ snap: 10 })
    expect(chart.getHelperLinesOptions()).toMatchObject({ enabled: true, snap: 10, show: 20 })
  })

  it('layer is constructed before WebGL gate (exists on the chart)', () => {
    // The layer is private; observable side effect = the style tag is mounted.
    expect(document.getElementById('flowgl-helper-lines-style')).not.toBeNull()
  })

  // Direct layer tests use a fresh HelperLinesLayer to isolate the snap math
  // from the chart's drag pipeline (which is exercised by the CDP probe).
  describe('snap math (direct)', () => {
    function makeLayer(): { layer: HelperLinesLayer; graph: Graph; container: HTMLElement } {
      const c = makeContainer()
      const graph = new Graph()
      graph.addNode({ id: 'drag', label: 'D', x: 0, y: 0, width: 80, height: 50 })
      graph.addNode({ id: 'other', label: 'O', x: 200, y: 200, width: 80, height: 50 })
      const viewport = new Viewport()
      viewport.setSize(800, 600)
      const layer = new HelperLinesLayer(c, viewport, graph, { enabled: true, snap: 5, show: 20 })
      layer.begin('drag')
      return { layer, graph, container: c }
    }

    it('snaps to matching left edges within threshold', () => {
      const { layer, container } = makeLayer()
      // dragNode width=80. left edge candidates: 0, 40, 80.
      // other.x = 200 (left edge). Snap target candidates: 200, 240, 280.
      // Drop drag at (197, 0) — left edge=197 → matches other.left=200 (delta 3 ≤ 5)
      const [outX, outY] = layer.applySnap(197, 0)
      expect(outX).toBe(200)
      expect(outY).toBe(0)
      container.remove()
      layer.dispose()
    })

    it('matches within show but not snap → guide line rendered, no snap', () => {
      const { layer, container } = makeLayer()
      // delta = 8 (between snap=5 and show=20) → guide shown, no snap.
      const [outX] = layer.applySnap(192, 0)
      expect(outX).toBe(192)
      expect(container.querySelectorAll('.flowgl-helper-line').length).toBeGreaterThan(0)
      container.remove()
      layer.dispose()
    })

    it('outside show threshold → no guide, no snap', () => {
      const { layer, container } = makeLayer()
      const [outX] = layer.applySnap(50, 0)
      expect(outX).toBe(50)
      expect(container.querySelectorAll('.flowgl-helper-line').length).toBe(0)
      container.remove()
      layer.dispose()
    })

    it('center-to-center match snaps both axes', () => {
      const { layer, container } = makeLayer()
      // drag center should align to other center.
      // other center = (240, 225). drag center = (x + 40, y + 25).
      // To align: x = 200, y = 200 — but try near: x = 197, y = 198.
      const [outX, outY] = layer.applySnap(197, 198)
      // x snap: drag.cx=237, other.cx=240 → snap to 200.
      // y snap: drag.cy=223, other.cy=225 → snap to 200.
      expect(outX).toBe(200)
      expect(outY).toBe(200)
      container.remove()
      layer.dispose()
    })

    it('disabled layer returns input coords unchanged', () => {
      const { layer, container } = makeLayer()
      layer.setOptions({ enabled: false })
      const [outX, outY] = layer.applySnap(197, 0)
      expect(outX).toBe(197)
      expect(outY).toBe(0)
      container.remove()
      layer.dispose()
    })

    it('end() clears all guides and deactivates', () => {
      const { layer, container } = makeLayer()
      layer.applySnap(192, 0)
      expect(container.querySelectorAll('.flowgl-helper-line').length).toBeGreaterThan(0)
      layer.end()
      expect(layer.isActive()).toBe(false)
      expect(container.querySelectorAll('.flowgl-helper-line').length).toBe(0)
      container.remove()
    })
  })
})
