import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Canvas2DRenderer } from '../renderer/canvas2d/index'
import { Graph } from '../graph/graph'
import { Viewport } from '../viewport/viewport'

/**
 * Canvas 2D renderer unit tests. happy-dom has a 2D context, so unlike the
 * WebGL2 renderer we can actually exercise the render path here.
 */

function makeMockCtx(): CanvasRenderingContext2D {
  const m = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    font: '', textAlign: 'start', textBaseline: 'alphabetic', lineDashOffset: 0,
    setTransform: vi.fn(),
    fillRect:     vi.fn(),
    clearRect:    vi.fn(),
    beginPath:    vi.fn(),
    closePath:    vi.fn(),
    moveTo:       vi.fn(),
    lineTo:       vi.fn(),
    bezierCurveTo: vi.fn(),
    arcTo:        vi.fn(),
    arc:          vi.fn(),
    ellipse:      vi.fn(),
    fill:         vi.fn(),
    stroke:       vi.fn(),
    fillText:     vi.fn(),
    measureText:  vi.fn(() => ({ width: 50 } as TextMetrics)),
    save:         vi.fn(),
    restore:      vi.fn(),
    setLineDash:  vi.fn(),
  }
  return m as unknown as CanvasRenderingContext2D
}

function makeMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600
  const mockCtx = makeMockCtx()
  Object.defineProperty(canvas, 'getContext', { value: (type: string) => type === '2d' ? mockCtx : null })
  return canvas
}

describe('Canvas2DRenderer', () => {
  let renderer: Canvas2DRenderer
  let canvas:   HTMLCanvasElement
  let graph:    Graph
  let viewport: Viewport

  beforeEach(() => {
    renderer = new Canvas2DRenderer()
    canvas   = makeMockCanvas()
    graph    = new Graph()
    viewport = new Viewport()
    viewport.setSize(800, 600)
  })

  it('initialize returns true and is idempotent on a 2D canvas', () => {
    expect(renderer.initialize(canvas)).toBe(true)
    expect(renderer.initialize(canvas)).toBe(true)
  })

  it('initialize returns false when getContext("2d") yields null', () => {
    const broken = document.createElement('canvas')
    Object.defineProperty(broken, 'getContext', { value: () => null })
    expect(renderer.initialize(broken)).toBe(false)
  })

  it('resize updates canvas backing-store and CSS size', () => {
    renderer.initialize(canvas, { pixelRatio: 2 })
    renderer.resize(400, 300)
    expect(canvas.width).toBe(800)        // 400 * 2
    expect(canvas.height).toBe(600)
    expect(canvas.style.width).toBe('400px')
    expect(canvas.style.height).toBe('300px')
  })

  it('render with an empty graph clears to the background color', () => {
    renderer.initialize(canvas)
    renderer.resize(800, 600)
    renderer.render(graph, viewport, { bgColor: '#abcdef' })
    const ctx = canvas.getContext('2d')!
    expect(ctx.fillRect).toHaveBeenCalled()
  })

  it('render draws a node body and a node label', () => {
    renderer.initialize(canvas)
    renderer.resize(800, 600)
    graph.addNode({ id: 'a', x: 100, y: 100, width: 150, height: 50, label: 'Hello' })
    renderer.render(graph, viewport)
    const ctx = canvas.getContext('2d')!
    expect(ctx.beginPath).toHaveBeenCalled()
    expect(ctx.fill).toHaveBeenCalled()
    expect(ctx.fillText).toHaveBeenCalledWith('Hello', 175, 125, expect.any(Number))
  })

  it('render skips the label when htmlContent is set', () => {
    renderer.initialize(canvas)
    renderer.resize(800, 600)
    graph.addNode({ id: 'a', x: 100, y: 100, width: 150, height: 50, label: 'Hello', htmlContent: '<b>x</b>' })
    renderer.render(graph, viewport)
    const ctx = canvas.getContext('2d')!
    expect(ctx.fillText).not.toHaveBeenCalledWith('Hello', expect.any(Number), expect.any(Number), expect.any(Number))
  })

  it('render draws an edge between two nodes', () => {
    renderer.initialize(canvas)
    renderer.resize(800, 600)
    graph.addNode({ id: 'a', x: 0,   y: 0, width: 100, height: 50, label: 'A' })
    graph.addNode({ id: 'b', x: 200, y: 0, width: 100, height: 50, label: 'B' })
    graph.addEdge({ id: 'e', source: 'a', target: 'b' })
    renderer.render(graph, viewport)
    const ctx = canvas.getContext('2d')!
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('hasAnimatedEdges reflects the last rendered frame', () => {
    renderer.initialize(canvas)
    renderer.resize(800, 600)
    graph.addNode({ id: 'a', x: 0,   y: 0, width: 100, height: 50, label: 'A' })
    graph.addNode({ id: 'b', x: 200, y: 0, width: 100, height: 50, label: 'B' })
    graph.addEdge({ id: 'e', source: 'a', target: 'b' })
    renderer.render(graph, viewport)
    expect(renderer.hasAnimatedEdges()).toBe(false)
    graph.updateEdge('e', { animated: true })
    renderer.render(graph, viewport)
    expect(renderer.hasAnimatedEdges()).toBe(true)
  })

  it('dispose is a safe no-op', () => {
    renderer.initialize(canvas)
    expect(() => renderer.dispose()).not.toThrow()
  })

  it('selectedIds highlights node border', () => {
    renderer.initialize(canvas)
    renderer.resize(800, 600)
    graph.addNode({ id: 'a', x: 100, y: 100, width: 150, height: 50, label: 'A' })
    renderer.render(graph, viewport, { selectedIds: new Set(['a']) })
    // Just assert it did not throw and exercised the highlight branch.
    expect(canvas.getContext('2d')!.stroke).toHaveBeenCalled()
  })
})
