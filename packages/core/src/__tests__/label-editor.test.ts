import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LabelEditor } from '../interaction/label-edit'
import { Viewport } from '../viewport/viewport'
import type { NodeData } from '../graph/node'

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas') as HTMLCanvasElement
  Object.defineProperty(c, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
  })
  c.setAttribute('tabindex', '0')
  return c
}

const nd = (id = 'a', x = 0, y = 0, w = 100, h = 50): NodeData => ({
  id, label: id, x, y, width: w, height: h,
})

describe('LabelEditor', () => {
  let canvas:   HTMLCanvasElement
  let viewport: Viewport
  let editor:   LabelEditor

  beforeEach(() => {
    canvas   = makeCanvas()
    document.body.appendChild(canvas)
    viewport = new Viewport()
    viewport.setSize(800, 600)
    editor   = new LabelEditor()
  })

  afterEach(() => {
    editor.dispose()
    canvas.remove()
    // Remove any leftover inputs from the DOM
    document.querySelectorAll('textarea').forEach(i => i.remove())
    document.querySelectorAll('input').forEach(i => i.remove())
  })

  it('constructs without throwing', () => {
    expect(editor).toBeDefined()
  })

  it('startEdit appends an input to the DOM', () => {
    const onDone = vi.fn()
    editor.startEdit(nd(), canvas, viewport, onDone)
    const input = document.querySelector('textarea')
    expect(input).not.toBeNull()
  })

  it('startEdit sets input value to node label', () => {
    const onDone = vi.fn()
    const node = nd('myLabel')
    node.label = 'myLabel'
    editor.startEdit(node, canvas, viewport, onDone)
    const input = document.querySelector('textarea') as HTMLTextAreaElement
    expect(input?.value).toBe('myLabel')
  })

  it('Enter key commits with trimmed value and calls onDone', () => {
    const onDone = vi.fn()
    editor.startEdit(nd(), canvas, viewport, onDone)
    const input = document.querySelector('textarea') as HTMLTextAreaElement
    input.value = '  hello  '
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onDone).toHaveBeenCalledOnce()
    expect(onDone.mock.calls[0]![0]).toBe('hello')
  })

  it('Enter with empty value falls back to original label', () => {
    const onDone = vi.fn()
    const node = nd('original')
    node.label = 'original'
    editor.startEdit(node, canvas, viewport, onDone)
    const input = document.querySelector('textarea') as HTMLTextAreaElement
    input.value = '   '
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onDone.mock.calls[0]![0]).toBe('original')
  })

  it('Escape key cancels without calling onDone', () => {
    const onDone = vi.fn()
    editor.startEdit(nd(), canvas, viewport, onDone)
    const input = document.querySelector('textarea') as HTMLTextAreaElement
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onDone).not.toHaveBeenCalled()
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('blur commits with current value', () => {
    const onDone = vi.fn()
    editor.startEdit(nd(), canvas, viewport, onDone)
    const input = document.querySelector('textarea') as HTMLTextAreaElement
    input.value = 'blurred'
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(onDone).toHaveBeenCalledOnce()
    expect(onDone.mock.calls[0]![0]).toBe('blurred')
  })

  it('Enter does not call onDone twice (committed guard)', () => {
    const onDone = vi.fn()
    editor.startEdit(nd(), canvas, viewport, onDone)
    const input = document.querySelector('textarea') as HTMLTextAreaElement
    input.value = 'test'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    // Blur fires after Enter in real browser — should not double-fire
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('stopEdit removes input from DOM', () => {
    editor.startEdit(nd(), canvas, viewport, vi.fn())
    expect(document.querySelector('textarea')).not.toBeNull()
    editor.stopEdit()
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('stopEdit is a no-op when no edit is active', () => {
    expect(() => editor.stopEdit()).not.toThrow()
  })

  it('dispose calls stopEdit', () => {
    editor.startEdit(nd(), canvas, viewport, vi.fn())
    editor.dispose()
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('startEdit while already editing stops previous edit first', () => {
    const first  = vi.fn()
    const second = vi.fn()
    editor.startEdit(nd('a'), canvas, viewport, first)
    editor.startEdit(nd('b'), canvas, viewport, second)
    // Only one input in DOM
    expect(document.querySelectorAll('textarea')).toHaveLength(1)
    const input = document.querySelector('textarea') as HTMLTextAreaElement
    expect(input.value).toBe('b')
  })

  it('input has position fixed in style', () => {
    editor.startEdit(nd(), canvas, viewport, vi.fn())
    const input = document.querySelector('textarea') as HTMLTextAreaElement
    expect(input.style.position).toBe('fixed')
  })

  it('non-Enter/Escape keys do not commit or cancel', () => {
    const onDone = vi.fn()
    editor.startEdit(nd(), canvas, viewport, onDone)
    const input = document.querySelector('textarea') as HTMLTextAreaElement
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))
    expect(onDone).not.toHaveBeenCalled()
    expect(document.querySelector('textarea')).not.toBeNull()
  })

  it('Enter during IME composition does not commit (isComposing)', () => {
    const onDone = vi.fn()
    editor.startEdit(nd(), canvas, viewport, onDone)
    const input = document.querySelector('textarea') as HTMLTextAreaElement
    input.value = '변경'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }))
    expect(onDone).not.toHaveBeenCalled()
    expect(document.querySelector('textarea')).not.toBeNull()
    // Second Enter after composition ends commits normally
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onDone).toHaveBeenCalledOnce()
    expect(onDone.mock.calls[0]![0]).toBe('변경')
  })

  it('Enter during IME composition (keyCode 229) does not commit', () => {
    const onDone = vi.fn()
    editor.startEdit(nd(), canvas, viewport, onDone)
    const input = document.querySelector('textarea') as HTMLTextAreaElement
    input.value = '편집'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', keyCode: 229, bubbles: true }))
    expect(onDone).not.toHaveBeenCalled()
  })

  // ── Multi-line label preservation (0.4.2 hotfix) ────────────────────────────
  //
  // Pre-0.4.2 the editor was a single-line `<input type="text">`, whose value
  // setter silently strips `\n`. A multi-line label like "여러줄\nテスト\n测试"
  // was destroyed the moment the user opened the editor — even Esc couldn't
  // recover, because blur committed the stripped value back to the node.
  // 0.4.2 switches to `<textarea>` and preserves interior newlines.

  it('preserves \\n in the value when opening on a multi-line label', () => {
    const onDone = vi.fn()
    const node = nd('multi')
    node.label = '여러줄\nテスト\n测试'
    editor.startEdit(node, canvas, viewport, onDone)
    const ta = document.querySelector('textarea') as HTMLTextAreaElement
    expect(ta.value).toBe('여러줄\nテスト\n测试')
  })

  it('blur commits a multi-line value verbatim (no \\n stripping)', () => {
    const onDone = vi.fn()
    const node = nd('multi')
    node.label = 'a\nb'
    editor.startEdit(node, canvas, viewport, onDone)
    const ta = document.querySelector('textarea') as HTMLTextAreaElement
    ta.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(onDone).toHaveBeenCalledOnce()
    expect(onDone.mock.calls[0]![0]).toBe('a\nb')
  })

  it('rows reflects the number of lines in the initial label', () => {
    editor.startEdit({ ...nd(), label: 'x\ny\nz' }, canvas, viewport, vi.fn())
    const ta = document.querySelector('textarea') as HTMLTextAreaElement
    expect(ta.getAttribute('rows')).toBe('3')
  })

  it('Shift+Enter does NOT commit (lets textarea insert a newline)', () => {
    const onDone = vi.fn()
    editor.startEdit(nd(), canvas, viewport, onDone)
    const ta = document.querySelector('textarea') as HTMLTextAreaElement
    ta.value = 'line1'
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }))
    expect(onDone).not.toHaveBeenCalled()
    expect(document.querySelector('textarea')).not.toBeNull()
  })

  it('plain Enter still commits (single-line UX preserved)', () => {
    const onDone = vi.fn()
    editor.startEdit(nd(), canvas, viewport, onDone)
    const ta = document.querySelector('textarea') as HTMLTextAreaElement
    ta.value = 'hello'
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onDone).toHaveBeenCalledOnce()
    expect(onDone.mock.calls[0]![0]).toBe('hello')
  })
})
