import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FlowChart } from '../flowchart'

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  Object.defineProperty(div, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
  })
  document.body.appendChild(div)
  return div
}

describe('Controls — 0.5.0', () => {
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

  it('hasControls() is false before show', () => {
    expect(chart.hasControls()).toBe(false)
  })

  it('showControls mounts a toolbar with default 4 buttons', () => {
    chart.showControls()
    expect(chart.hasControls()).toBe(true)
    const toolbar = container.querySelector('[role="toolbar"]') as HTMLElement
    expect(toolbar).not.toBeNull()
    expect(toolbar.getAttribute('aria-label')).toBe('Chart controls')
    // zoom-in, zoom-out, fit-view, lock
    expect(container.querySelectorAll('[data-flowgl-control]').length).toBe(4)
  })

  it('showZoom: false hides zoom buttons', () => {
    chart.showControls({ showZoom: false })
    expect(container.querySelector('[data-flowgl-control="zoom-in"]')).toBeNull()
    expect(container.querySelector('[data-flowgl-control="zoom-out"]')).toBeNull()
  })

  it('showFitView: false hides the fit button', () => {
    chart.showControls({ showFitView: false })
    expect(container.querySelector('[data-flowgl-control="fit-view"]')).toBeNull()
  })

  it('showInteractive: false hides the lock toggle', () => {
    chart.showControls({ showInteractive: false })
    expect(container.querySelector('[data-flowgl-control="lock"]')).toBeNull()
  })

  it('zoom-in button calls chart.zoomIn by default', () => {
    const spy = vi.spyOn(chart, 'zoomIn')
    chart.showControls()
    const btn = container.querySelector('[data-flowgl-control="zoom-in"]') as HTMLButtonElement
    btn.click()
    expect(spy).toHaveBeenCalledOnce()
  })

  it('zoom-out button calls chart.zoomOut by default', () => {
    const spy = vi.spyOn(chart, 'zoomOut')
    chart.showControls()
    const btn = container.querySelector('[data-flowgl-control="zoom-out"]') as HTMLButtonElement
    btn.click()
    expect(spy).toHaveBeenCalledOnce()
  })

  it('fit-view button calls chart.fitView by default', () => {
    const spy = vi.spyOn(chart, 'fitView')
    chart.showControls()
    const btn = container.querySelector('[data-flowgl-control="fit-view"]') as HTMLButtonElement
    btn.click()
    expect(spy).toHaveBeenCalledOnce()
  })

  it('custom handlers override the default behavior', () => {
    const onIn = vi.fn(), onOut = vi.fn(), onFit = vi.fn()
    chart.showControls({ onZoomIn: onIn, onZoomOut: onOut, onFitView: onFit })
    ;(container.querySelector('[data-flowgl-control="zoom-in"]') as HTMLButtonElement).click()
    ;(container.querySelector('[data-flowgl-control="zoom-out"]') as HTMLButtonElement).click()
    ;(container.querySelector('[data-flowgl-control="fit-view"]') as HTMLButtonElement).click()
    expect(onIn).toHaveBeenCalledOnce()
    expect(onOut).toHaveBeenCalledOnce()
    expect(onFit).toHaveBeenCalledOnce()
  })

  it('lock button toggles readOnly state and aria-pressed', () => {
    chart.showControls()
    const lock = container.querySelector('[data-flowgl-control="lock"]') as HTMLButtonElement
    expect(lock.getAttribute('aria-pressed')).toBe('false')
    lock.click()
    expect(chart.isReadOnly()).toBe(true)
    expect(lock.getAttribute('aria-pressed')).toBe('true')
    lock.click()
    expect(chart.isReadOnly()).toBe(false)
    expect(lock.getAttribute('aria-pressed')).toBe('false')
  })

  it('onInteractiveChange replaces the default lock behavior', () => {
    const cb = vi.fn()
    chart.showControls({ onInteractiveChange: cb })
    const lock = container.querySelector('[data-flowgl-control="lock"]') as HTMLButtonElement
    lock.click()
    expect(cb).toHaveBeenCalledWith(true)
    // setReadOnly NOT called when custom cb provided
    expect(chart.isReadOnly()).toBe(false)
  })

  it('orientation: horizontal sets the data attribute', () => {
    chart.showControls({ orientation: 'horizontal' })
    const tb = container.querySelector('[role="toolbar"]') as HTMLElement
    expect(tb.getAttribute('data-orient')).toBe('horizontal')
  })

  it('orientation default is vertical', () => {
    chart.showControls()
    const tb = container.querySelector('[role="toolbar"]') as HTMLElement
    expect(tb.getAttribute('data-orient')).toBe('vertical')
  })

  it('customButtons append after the built-ins', () => {
    const onExport = vi.fn()
    chart.showControls({
      customButtons: [{ id: 'export', icon: '⬇', title: 'Export', onClick: onExport }],
    })
    const btn = container.querySelector('[data-flowgl-control="export"]') as HTMLButtonElement
    expect(btn).not.toBeNull()
    expect(btn.getAttribute('title')).toBe('Export')
    btn.click()
    expect(onExport).toHaveBeenCalledOnce()
  })

  it('disabled custom button does not fire click', () => {
    const onClick = vi.fn()
    chart.showControls({
      customButtons: [{ id: 'x', icon: 'x', title: 't', onClick, disabled: true }],
    })
    const btn = container.querySelector('[data-flowgl-control="x"]') as HTMLButtonElement
    expect(btn.getAttribute('aria-disabled')).toBe('true')
    btn.click()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('hideControls removes the toolbar from DOM', () => {
    chart.showControls()
    expect(chart.hideControls()).toBe(true)
    expect(chart.hasControls()).toBe(false)
    expect(container.querySelector('[role="toolbar"]')).toBeNull()
  })

  it('hideControls returns false when nothing was visible', () => {
    expect(chart.hideControls()).toBe(false)
  })

  it('showControls called twice swaps the prior toolbar', () => {
    chart.showControls({ showZoom: true })
    chart.showControls({ showZoom: false })
    expect(container.querySelectorAll('[role="toolbar"]').length).toBe(1)
    expect(container.querySelector('[data-flowgl-control="zoom-in"]')).toBeNull()
  })

  it('dispose tears down the toolbar', () => {
    chart.showControls()
    chart.dispose()
    expect(container.querySelector('[role="toolbar"]')).toBeNull()
    // recreate so afterEach dispose doesn't double-dispose
    chart = new FlowChart({ container, onError: () => {} })
  })
})
