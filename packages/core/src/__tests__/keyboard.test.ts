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
})
