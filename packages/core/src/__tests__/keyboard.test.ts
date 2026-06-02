import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KeyboardHandler } from '../interaction/keyboard'

function makeCanvas(): HTMLElement {
  return document.createElement('div')
}

function makeOpts() {
  return {
    onDelete:    vi.fn(),
    onEscape:    vi.fn(),
    onSelectAll: vi.fn(),
    onUndo:      vi.fn(),
    onRedo:      vi.fn(),
    onTabNext:   vi.fn(),
    onTabPrev:   vi.fn(),
    onArrowKey:  vi.fn(),
    onCopy:             vi.fn(),
    onPaste:            vi.fn(),
    onCut:              vi.fn(),
    onDuplicate:        vi.fn(),
    onFitView:          vi.fn(),
    onFitViewSelection: vi.fn(),
  }
}

describe('KeyboardHandler', () => {
  let canvas: HTMLElement
  let opts: ReturnType<typeof makeOpts>
  let handler: KeyboardHandler

  beforeEach(() => {
    canvas  = makeCanvas()
    opts    = makeOpts()
    handler = new KeyboardHandler(canvas, opts)
  })

  it('calls onDelete on Delete key', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    expect(opts.onDelete).toHaveBeenCalledOnce()
  })

  it('calls onDelete on Backspace key', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))
    expect(opts.onDelete).toHaveBeenCalledOnce()
  })

  it('calls onEscape on Escape key', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(opts.onEscape).toHaveBeenCalledOnce()
  })

  it('calls onUndo on Ctrl+Z', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    expect(opts.onUndo).toHaveBeenCalledOnce()
    expect(opts.onRedo).not.toHaveBeenCalled()
  })

  it('calls onUndo on Meta+Z', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }))
    expect(opts.onUndo).toHaveBeenCalledOnce()
  })

  it('calls onRedo on Ctrl+Shift+Z', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }))
    expect(opts.onRedo).toHaveBeenCalledOnce()
    expect(opts.onUndo).not.toHaveBeenCalled()
  })

  it('calls onRedo on Ctrl+Y', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }))
    expect(opts.onRedo).toHaveBeenCalledOnce()
  })

  it('calls onRedo on Meta+Y', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', metaKey: true, bubbles: true }))
    expect(opts.onRedo).toHaveBeenCalledOnce()
  })

  it('calls onSelectAll on Ctrl+A', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }))
    expect(opts.onSelectAll).toHaveBeenCalledOnce()
  })

  it('calls onSelectAll on Meta+A', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true }))
    expect(opts.onSelectAll).toHaveBeenCalledOnce()
  })

  it('ignores z key without modifier', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }))
    expect(opts.onUndo).not.toHaveBeenCalled()
    expect(opts.onRedo).not.toHaveBeenCalled()
  })

  it('ignores events targeting INPUT elements', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    expect(opts.onDelete).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('ignores events targeting TEXTAREA elements', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    expect(opts.onDelete).not.toHaveBeenCalled()
    document.body.removeChild(textarea)
  })

  it('ignores events targeting SELECT elements', () => {
    const select = document.createElement('select')
    document.body.appendChild(select)
    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    expect(opts.onDelete).not.toHaveBeenCalled()
    document.body.removeChild(select)
  })

  it('dispose() removes the listener so callbacks no longer fire', () => {
    handler.dispose()
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    expect(opts.onDelete).not.toHaveBeenCalled()
  })

  // ── Tab / Arrow (new handlers) ─────────────────────────────────────────────

  it('calls onTabNext on Tab key', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(opts.onTabNext).toHaveBeenCalledOnce()
    expect(opts.onTabPrev).not.toHaveBeenCalled()
  })

  it('calls onTabPrev on Shift+Tab', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(opts.onTabPrev).toHaveBeenCalledOnce()
    expect(opts.onTabNext).not.toHaveBeenCalled()
  })

  it.each([
    ['ArrowUp'],
    ['ArrowDown'],
    ['ArrowLeft'],
    ['ArrowRight'],
  ] as const)('calls onArrowKey with direction %s', (key) => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    expect(opts.onArrowKey).toHaveBeenCalledWith(key)
  })

  it('calls onCopy on Ctrl+C', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }))
    expect(opts.onCopy).toHaveBeenCalledTimes(1)
  })

  it('calls onCopy on Meta+C', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', metaKey: true, bubbles: true }))
    expect(opts.onCopy).toHaveBeenCalledTimes(1)
  })

  it('calls onPaste on Ctrl+V', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }))
    expect(opts.onPaste).toHaveBeenCalledTimes(1)
  })

  it('calls onCut on Ctrl+X', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, bubbles: true }))
    expect(opts.onCut).toHaveBeenCalledTimes(1)
  })

  it('calls onDuplicate on Ctrl+D', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }))
    expect(opts.onDuplicate).toHaveBeenCalledTimes(1)
  })

  it('calls onFitView on F key', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }))
    expect(opts.onFitView).toHaveBeenCalledTimes(1)
    expect(opts.onFitViewSelection).not.toHaveBeenCalled()
  })

  it('calls onFitViewSelection on Shift+F', () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', shiftKey: true, bubbles: true }))
    expect(opts.onFitViewSelection).toHaveBeenCalledTimes(1)
    expect(opts.onFitView).not.toHaveBeenCalled()
  })

  it('ignores Tab when targeting an INPUT element', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(opts.onTabNext).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })
})
