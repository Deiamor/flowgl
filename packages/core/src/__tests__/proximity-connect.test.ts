import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FlowChart } from '../flowchart'
import { ProximityConnectLayer } from '../ui/proximity-connect'
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

describe('ProximityConnect — 0.8.0', () => {
  let container: HTMLElement
  let chart: FlowChart

  beforeEach(() => {
    container = makeContainer()
    chart = new FlowChart({
      container,
      nodes: [
        { id: 'a', label: 'A', x: 0, y: 0, width: 80, height: 50 },
        { id: 'b', label: 'B', x: 400, y: 0, width: 80, height: 50 },
      ],
      onError: () => {},
      proximityConnect: { enabled: true, threshold: 60 },
    })
  })
  afterEach(() => {
    chart.dispose()
    container.remove()
  })

  it('getProximityConnectOptions reflects construction', () => {
    expect(chart.getProximityConnectOptions()).toMatchObject({ enabled: true, threshold: 60 })
  })

  it('setProximityConnectOptions merges partial', () => {
    chart.setProximityConnectOptions({ threshold: 100 })
    expect(chart.getProximityConnectOptions()).toMatchObject({ enabled: true, threshold: 100 })
  })

  it('style tag mounted at chart creation', () => {
    expect(document.getElementById('flowgl-proximity-style')).not.toBeNull()
  })

  describe('proximity detection (direct)', () => {
    function makeLayer() {
      const c = makeContainer()
      const graph = new Graph()
      graph.addNode({ id: 'drag',  label: 'D', x: 0, y: 0, width: 80, height: 50 })
      graph.addNode({ id: 'near',  label: 'N', x: 130, y: 0, width: 80, height: 50 })   // 50 px gap
      graph.addNode({ id: 'far',   label: 'F', x: 500, y: 0, width: 80, height: 50 })   // 420 px gap
      const viewport = new Viewport()
      viewport.setSize(800, 600)
      const layer = new ProximityConnectLayer(c, viewport, graph, { enabled: true, threshold: 80 })
      return { c, graph, layer }
    }

    it('returns nearest within threshold on notifyMove', () => {
      const { c, layer } = makeLayer()
      layer.begin('drag')
      const target = layer.notifyMove()
      expect(target).toBe('near')
      layer.end()
      c.remove()
    })

    it('returns null when no node within threshold', () => {
      const { c, layer, graph } = makeLayer()
      graph.removeNode('near')
      layer.begin('drag')
      expect(layer.notifyMove()).toBeNull()
      c.remove()
      layer.end()
    })

    it('skips a target that already has an edge to the dragged node', () => {
      const { c, layer, graph } = makeLayer()
      graph.addEdge({ id: 'e1', source: 'drag', target: 'near' })
      layer.begin('drag')
      expect(layer.notifyMove()).toBeNull()
      c.remove()
      layer.end()
    })

    it('renders ghost + halo when a target is in range', () => {
      const { c, layer } = makeLayer()
      layer.begin('drag')
      layer.notifyMove()
      expect(c.querySelectorAll('[data-flowgl-proximity-ghost]').length).toBe(1)
      expect(c.querySelectorAll('[data-flowgl-proximity-halo]').length).toBe(1)
      layer.end()
      expect(c.querySelectorAll('[data-flowgl-proximity-ghost]').length).toBe(0)
      expect(c.querySelectorAll('[data-flowgl-proximity-halo]').length).toBe(0)
      c.remove()
    })

    it('disabled layer always returns null', () => {
      const { c, layer } = makeLayer()
      layer.setOptions({ enabled: false })
      layer.begin('drag')
      expect(layer.notifyMove()).toBeNull()
      c.remove()
      layer.end()
    })

    it('end() returns the current target and clears visuals', () => {
      const { c, layer } = makeLayer()
      layer.begin('drag')
      layer.notifyMove()
      const finalTarget = layer.end()
      expect(finalTarget).toBe('near')
      expect(c.querySelectorAll('[data-flowgl-proximity-ghost]').length).toBe(0)
      c.remove()
    })

    it('parent of dragged node is excluded from candidates', () => {
      const c = makeContainer()
      const graph = new Graph()
      graph.addNode({ id: 'p', label: 'p', x: 0, y: 0, width: 200, height: 100, type: 'group' })
      graph.addNode({ id: 'child', label: 'child', x: 10, y: 10, width: 50, height: 50, parentId: 'p' })
      const viewport = new Viewport()
      viewport.setSize(800, 600)
      const layer = new ProximityConnectLayer(c, viewport, graph, { enabled: true, threshold: 80 })
      layer.begin('child')
      expect(layer.notifyMove()).toBeNull()
      layer.end()
      c.remove()
    })
  })
})
