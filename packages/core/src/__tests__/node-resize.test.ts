import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NodeResize } from '../interaction/node-resize'
import { Viewport } from '../viewport/viewport'
import { Graph } from '../graph/graph'
import type { NodeData } from '../graph/node'

function makeMockCtx() {
  return {
    clearRect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D
}

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas') as HTMLCanvasElement
  Object.defineProperty(c, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
  })
  Object.defineProperty(c, 'offsetWidth',  { get: () => 800 })
  Object.defineProperty(c, 'offsetHeight', { get: () => 600 })
  return c
}

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}

// Mock HTMLCanvasElement.prototype.getContext globally so the internal overlay canvas
// created by NodeResize can return a usable 2D context in happy-dom.
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
  (id: string) => id === '2d' ? makeMockCtx() : null,
)

const nd = (id: string, x = 100, y = 100, w = 120, h = 60): NodeData => ({
  id, label: id, x, y, width: w, height: h,
})

describe('NodeResize', () => {
  let canvas:    HTMLCanvasElement
  let container: HTMLElement
  let viewport:  Viewport
  let graph:     Graph
  let onBeforeMutation: ReturnType<typeof vi.fn>
  let onUpdate:         ReturnType<typeof vi.fn>
  let onResizeEnd:      ReturnType<typeof vi.fn>
  let resize:    NodeResize

  beforeEach(() => {
    canvas    = makeCanvas()
    container = makeContainer()
    viewport  = new Viewport()
    viewport.setSize(800, 600)
    graph     = new Graph()
    graph.addNode(nd('a'))

    onBeforeMutation = vi.fn()
    onUpdate         = vi.fn()
    onResizeEnd      = vi.fn()

    resize = new NodeResize(container, canvas, viewport, graph, onBeforeMutation, onUpdate, onResizeEnd)
  })

  it('constructs without throwing', () => {
    expect(resize).toBeDefined()
  })

  it('isCapturing() returns false initially', () => {
    expect(resize.isCapturing()).toBe(false)
  })

  it('isNearHandle() returns false when no node is selected', () => {
    expect(resize.isNearHandle(0, 0)).toBe(false)
  })

  it('setSelectedNode sets node id', () => {
    resize.setSelectedNode('a')
    expect(resize.isCapturing()).toBe(false)
  })

  it('setSelectedNode(null) clears selection', () => {
    resize.setSelectedNode('a')
    resize.setSelectedNode(null)
    expect(resize.isNearHandle(100, 100)).toBe(false)
  })

  it('render() does not throw with no selected node', () => {
    expect(() => resize.render()).not.toThrow()
  })

  it('render() does not throw with selected node', () => {
    resize.setSelectedNode('a')
    expect(() => resize.render()).not.toThrow()
  })

  it('render() does not throw when selected node does not exist in graph', () => {
    resize.setSelectedNode('ghost')
    expect(() => resize.render()).not.toThrow()
  })

  it('isNearHandle() returns true when pointer is on corner handle', () => {
    // Node a: x=100, y=100, w=120, h=60
    // SE corner at world (220, 160) → screen (220, 160) at zoom=1, offset=0
    // viewport.worldToScreen(220, 160) = [220*1+0, 160*1+0] = [220, 160]
    resize.setSelectedNode('a')
    // clientX, clientY = 220, 160 → screen 220, 160 → near SE handle
    const near = resize.isNearHandle(220, 160)
    expect(near).toBe(true)
  })

  it('isNearHandle() returns false when far from all handles', () => {
    resize.setSelectedNode('a')
    expect(resize.isNearHandle(500, 500)).toBe(false)
  })

  it('isNearHandle() returns false for locked node', () => {
    graph.updateNode('a', { locked: true })
    resize.setSelectedNode('a')
    expect(resize.isNearHandle(100, 100)).toBe(false)
  })

  it('setDisabled prevents drag start', () => {
    resize.setSelectedNode('a')
    resize.setDisabled(true)
    // mousedown on SE handle should be ignored
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 220, clientY: 160, bubbles: true,
    }))
    expect(onBeforeMutation).not.toHaveBeenCalled()
  })

  it('dispose() removes event listeners without throw', () => {
    expect(() => resize.dispose()).not.toThrow()
  })

  it('mousedown on NW handle starts drag, triggers onBeforeMutation', () => {
    resize.setSelectedNode('a')
    // NW corner: world (100, 100) → screen (100, 100)
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 100, bubbles: true,
    }))
    expect(onBeforeMutation).toHaveBeenCalledOnce()
    expect(resize.isCapturing()).toBe(true)
  })

  it('mousemove during drag updates node position', () => {
    resize.setSelectedNode('a')
    // Start drag on SE corner
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 220, clientY: 160, bubbles: true,
    }))
    expect(resize.isCapturing()).toBe(true)
    // mousemove is bound to canvas (not window)
    canvas.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 250, clientY: 190, bubbles: true,
    }))
    expect(onUpdate).toHaveBeenCalled()
    const node = graph.getNode('a')!
    expect(node.width).toBeGreaterThan(120)
    expect(node.height).toBeGreaterThan(60)
  })

  it('mouseup ends drag and fires onResizeEnd', () => {
    resize.setSelectedNode('a')
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 220, clientY: 160, bubbles: true,
    }))
    canvas.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 250, clientY: 190, bubbles: true,
    }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    expect(resize.isCapturing()).toBe(false)
    expect(onResizeEnd).toHaveBeenCalledOnce()
  })

  it('mouseup without prior drag does nothing', () => {
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    expect(onResizeEnd).not.toHaveBeenCalled()
  })

  it('right mouse button down is ignored', () => {
    resize.setSelectedNode('a')
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 2, clientX: 220, clientY: 160, bubbles: true,
    }))
    expect(onBeforeMutation).not.toHaveBeenCalled()
  })

  it('resize enforces MIN_W=40 on SW drag', () => {
    graph.addNode({ id: 'small', x: 0, y: 0, width: 50, height: 50, label: 'small' })
    resize.setSelectedNode('small')
    // SW corner is at world (0, 50) → screen (0, 50)
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 0, clientY: 50, bubbles: true,
    }))
    // Drag SW corner far right — shrinks width (mousemove on canvas)
    canvas.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 500, clientY: 50, bubbles: true,
    }))
    const node = graph.getNode('small')!
    expect(node.width).toBeGreaterThanOrEqual(40)
  })

  it('resize enforces MIN_H=30 on NE drag up', () => {
    graph.addNode({ id: 'small', x: 0, y: 100, width: 100, height: 50, label: 's' })
    resize.setSelectedNode('small')
    // NE corner: world (100, 100) → screen (100, 100)
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 100, bubbles: true,
    }))
    // Drag NE handle far down — shrinks height (mousemove on canvas)
    canvas.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 100, clientY: 500, bubbles: true,
    }))
    const node = graph.getNode('small')!
    expect(node.height).toBeGreaterThanOrEqual(30)
  })

  it('mousemove without drag updates hoveredDir only', () => {
    resize.setSelectedNode('a')
    canvas.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 220, clientY: 160, bubbles: true,
    }))
    expect(onUpdate).toHaveBeenCalled()
    expect(resize.isCapturing()).toBe(false)
  })

  it('mousemove on non-handle area clears cursor', () => {
    resize.setSelectedNode('a')
    // First move to handle
    canvas.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 220, clientY: 160, bubbles: true,
    }))
    // Then move away
    canvas.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 400, clientY: 400, bubbles: true,
    }))
    expect(canvas.style.cursor).toBe('')
  })

  it('default onResizeEnd noop is called without throw when not provided', () => {
    // Create without onResizeEnd to exercise the default () => {} parameter
    const r2 = new NodeResize(container, canvas, viewport, graph, onBeforeMutation, onUpdate)
    r2.setSelectedNode('a')
    // mousedown on se handle (220, 160)
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 220, clientY: 160, bubbles: true }))
    expect(r2.isCapturing()).toBe(true)
    // mouseup fires handleMouseUp → calls onResizeEnd (the default () => {})
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }))
    expect(r2.isCapturing()).toBe(false)
    r2.dispose()
  })
})
