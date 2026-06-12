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

describe('Panel overlay — 0.5.0', () => {
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

  it('container becomes a positioning context (relative) if not already', () => {
    expect(container.style.position).toBe('relative')
  })

  it('addPanel mounts a div with default styling', () => {
    const id = chart.addPanel({ content: 'hello' })
    expect(id).toMatch(/^flowgl-panel-/)
    const el = container.querySelector(`[data-flowgl-panel-id="${id}"]`) as HTMLDivElement
    expect(el).not.toBeNull()
    expect(el.textContent).toBe('hello')
    expect(el.style.position).toBe('absolute')
    expect(el.style.top).toBe('12px')
    expect(el.style.left).toBe('12px')
  })

  it('addPanel honors a custom id', () => {
    const id = chart.addPanel({ id: 'my-toolbar', content: '<button>x</button>' })
    expect(id).toBe('my-toolbar')
    expect(container.querySelector('[data-flowgl-panel-id="my-toolbar"]')).not.toBeNull()
  })

  it('addPanel applies the requested position', () => {
    const id = chart.addPanel({ position: 'bottom-right', content: 'br', offset: 20 })
    const el = container.querySelector(`[data-flowgl-panel-id="${id}"]`) as HTMLDivElement
    expect(el.style.bottom).toBe('20px')
    expect(el.style.right).toBe('20px')
  })

  it('addPanel center positions use transform', () => {
    const id = chart.addPanel({ position: 'center', content: 'mid' })
    const el = container.querySelector(`[data-flowgl-panel-id="${id}"]`) as HTMLDivElement
    expect(el.style.transform).toMatch(/translate\(-50%, ?-50%\)/)
  })

  it('addPanel accepts an HTMLElement as content', () => {
    const node = document.createElement('span')
    node.textContent = 'inner'
    const id = chart.addPanel({ content: node })
    const el = container.querySelector(`[data-flowgl-panel-id="${id}"]`) as HTMLDivElement
    expect(el.querySelector('span')?.textContent).toBe('inner')
  })

  it('addPanel onClick is invoked on click', () => {
    const fn = vi.fn()
    const id = chart.addPanel({ content: 'x', onClick: fn })
    const el = container.querySelector(`[data-flowgl-panel-id="${id}"]`) as HTMLDivElement
    el.click()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('updatePanel mutates content + position + offset', () => {
    const id = chart.addPanel({ content: 'a', position: 'top-left', offset: 5 })
    expect(chart.updatePanel(id, { content: 'b', position: 'bottom-center', offset: 30 })).toBe(true)
    const el = container.querySelector(`[data-flowgl-panel-id="${id}"]`) as HTMLDivElement
    expect(el.textContent).toBe('b')
    expect(el.style.bottom).toBe('30px')
    expect(el.style.top).toBe('')
  })

  it('updatePanel returns false on unknown id', () => {
    expect(chart.updatePanel('nope', { content: 'x' })).toBe(false)
  })

  it('removePanel removes the element from DOM', () => {
    const id = chart.addPanel({ content: 'x' })
    expect(container.querySelectorAll('[data-flowgl-panel-id]').length).toBe(1)
    expect(chart.removePanel(id)).toBe(true)
    expect(container.querySelectorAll('[data-flowgl-panel-id]').length).toBe(0)
  })

  it('listPanels returns the mounted ids', () => {
    chart.addPanel({ id: 'a', content: 'A' })
    chart.addPanel({ id: 'b', content: 'B' })
    expect(chart.listPanels().sort()).toEqual(['a', 'b'])
  })

  it('dispose tears down every panel', () => {
    chart.addPanel({ content: 'a' })
    chart.addPanel({ content: 'b' })
    chart.addPanel({ content: 'c' })
    expect(container.querySelectorAll('[data-flowgl-panel-id]').length).toBe(3)
    chart.dispose()
    expect(container.querySelectorAll('[data-flowgl-panel-id]').length).toBe(0)
    // Re-construct so afterEach dispose() doesn't double-dispose
    chart = new FlowChart({ container, onError: () => {} })
  })

  it('readding the same id replaces the previous panel cleanly', () => {
    chart.addPanel({ id: 'duped', content: 'first' })
    chart.addPanel({ id: 'duped', content: 'second' })
    const els = container.querySelectorAll('[data-flowgl-panel-id="duped"]')
    expect(els.length).toBe(1)
    expect(els[0]!.textContent).toBe('second')
  })

  it('className strips characters that could break out of the attribute', () => {
    const id = chart.addPanel({ content: 'x', className: 'safe-class" onclick="alert(1)' })
    const el = container.querySelector(`[data-flowgl-panel-id="${id}"]`) as HTMLDivElement
    // No quotes, equals signs, or parens survive — the only allowed characters are
    // A-Za-z0-9_-` `. Exact spacing is normalised by the DOM.
    expect(el.className).not.toMatch(/[="()]/)
    expect(el.className).toContain('safe-class')
  })
})
