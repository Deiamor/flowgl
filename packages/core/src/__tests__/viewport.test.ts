import { describe, it, expect, beforeEach } from 'vitest'
import { Viewport, MIN_ZOOM, MAX_ZOOM } from '../viewport/viewport'

describe('Viewport', () => {
  let vp: Viewport

  beforeEach(() => {
    vp = new Viewport()
    vp.setSize(800, 600)
  })

  it('initial state is identity', () => {
    expect(vp.x).toBe(0)
    expect(vp.y).toBe(0)
    expect(vp.zoom).toBe(1)
  })

  it('screenToWorld is inverse of worldToScreen', () => {
    vp.x = 100; vp.y = 50; vp.zoom = 2
    const [wx, wy] = vp.screenToWorld(300, 250)
    const [sx, sy] = vp.worldToScreen(wx, wy)
    expect(sx).toBeCloseTo(300)
    expect(sy).toBeCloseTo(250)
  })

  it('pan shifts x and y', () => {
    vp.pan(10, -20)
    expect(vp.x).toBe(10)
    expect(vp.y).toBe(-20)
  })

  it('zoomAt clamps to MIN_ZOOM', () => {
    vp.zoom = MIN_ZOOM
    vp.zoomAt(400, 300, 0.1)
    expect(vp.zoom).toBe(MIN_ZOOM)
  })

  it('zoomAt clamps to MAX_ZOOM', () => {
    vp.zoom = MAX_ZOOM
    vp.zoomAt(400, 300, 10)
    expect(vp.zoom).toBe(MAX_ZOOM)
  })

  it('zoomAt keeps the focal point fixed in world space', () => {
    vp.x = 0; vp.y = 0; vp.zoom = 1
    const [wxBefore] = vp.screenToWorld(400, 300)
    vp.zoomAt(400, 300, 2)
    const [wxAfter] = vp.screenToWorld(400, 300)
    expect(wxAfter).toBeCloseTo(wxBefore)
  })

  it('getVisibleBounds covers the canvas', () => {
    const b = vp.getVisibleBounds()
    const [x0, y0] = vp.screenToWorld(0, 0)
    const [x1, y1] = vp.screenToWorld(800, 600)
    expect(b.minX).toBeCloseTo(x0)
    expect(b.minY).toBeCloseTo(y0)
    expect(b.maxX).toBeCloseTo(x1)
    expect(b.maxY).toBeCloseTo(y1)
  })

  it('getState / setState round-trips', () => {
    vp.x = 42; vp.y = -7; vp.zoom = 1.5
    const state = vp.getState()
    const vp2 = new Viewport()
    vp2.setState(state)
    expect(vp2.x).toBe(42)
    expect(vp2.y).toBe(-7)
    expect(vp2.zoom).toBe(1.5)
  })

  it('setState clamps zoom', () => {
    vp.setState({ x: 0, y: 0, zoom: 9999 })
    expect(vp.zoom).toBe(MAX_ZOOM)
    vp.setState({ x: 0, y: 0, zoom: -1 })
    expect(vp.zoom).toBe(MIN_ZOOM)
  })

  it('fit centers a bounding box', () => {
    vp.fit({ minX: 0, minY: 0, maxX: 400, maxY: 300 }, 0)
    // After fit, the world-space center should map to screen center
    const [cx, cy] = vp.worldToScreen(200, 150)
    expect(cx).toBeCloseTo(400)
    expect(cy).toBeCloseTo(300)
  })

  it('getMatrix returns a 16-element Float32Array', () => {
    const m = vp.getMatrix()
    expect(m).toBeInstanceOf(Float32Array)
    expect(m.length).toBe(16)
  })
})
