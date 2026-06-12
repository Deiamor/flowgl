import type { NodeData } from '../graph/node'
import type { Viewport } from '../viewport/viewport'
import { DEFAULT_NODE_STYLE } from '../graph/node'
import { safeColor, safeNumber, safeFontFamily } from '../services/safe-css'

export class LabelEditor {
  private input: HTMLTextAreaElement | null = null
  private boundBlur: (() => void) | null = null

  startEdit(
    node: NodeData,
    canvas: HTMLCanvasElement,
    viewport: Viewport,
    onDone: (newLabel: string) => void,
  ): void {
    this.stopEdit()

    const style  = { ...DEFAULT_NODE_STYLE, ...node.style }
    const [sx, sy] = viewport.worldToScreen(
      node.x + node.width  / 2,
      node.y + node.height / 2,
    )
    const canvasRect = canvas.getBoundingClientRect()

    // textarea instead of input: a single-line `<input>` silently strips
    // newlines when its value setter receives them, which destroyed
    // multi-line labels (e.g. "여러줄\nテスト\n测试") the moment the user
    // opened the editor — even Esc couldn't recover, because blur committed
    // the stripped value back to the node.
    const ta = document.createElement('textarea')
    ta.value = node.label
    const lineCount = (node.label.match(/\n/g) || []).length + 1
    // setAttribute over the DOM property — happy-dom doesn't reflect the
    // setter into the attribute, which our tests assert against.
    ta.setAttribute('rows', String(Math.max(1, lineCount)))
    // Set base style via cssText (no user input), then user-controlled fields
    // via setProperty to prevent CSS-injection breakouts.
    ta.style.cssText = [
      'position:fixed',
      'transform:translate(-50%,-50%)',
      'padding:4px 8px',
      'border-radius:4px',
      'text-align:center',
      'outline:none',
      'z-index:8500',
      'box-sizing:border-box',
      'border-style:solid',
      'border-width:2px',
      'resize:none',
      'overflow:hidden',
      'line-height:1.4',
    ].join(';')
    ta.style.setProperty('left',         `${canvasRect.left + sx}px`)
    ta.style.setProperty('top',          `${canvasRect.top  + sy}px`)
    ta.style.setProperty('width',        `${Math.max(80, node.width * viewport.zoom - 20)}px`)
    ta.style.setProperty('border-color', safeColor(style.borderColor,     '#1a73e8'))
    ta.style.setProperty('background',   safeColor(style.backgroundColor, '#fff'))
    ta.style.setProperty('color',        safeColor(style.textColor,       '#1a1a1a'))
    ta.style.setProperty('font-size',    `${safeNumber(style.fontSize, 14) * viewport.zoom}px`)
    ta.style.setProperty('font-family',  safeFontFamily(style.fontFamily, 'system-ui, sans-serif'))

    let committed = false
    const commit = (): void => {
      if (committed) return
      committed = true
      // `trim()` strips only leading/trailing whitespace and preserves
      // interior characters — newlines included — so multi-line labels
      // round-trip through the editor unchanged.
      const next = ta.value.trim()
      onDone(next || node.label)
      this.stopEdit()
      // Return focus to canvas so keyboard shortcuts keep working
      canvas.focus()
    }

    // Store a stable reference so removeEventListener works correctly
    this.boundBlur = commit
    ta.addEventListener('keydown', (e: KeyboardEvent) => {
      e.stopPropagation()
      // Ignore Enter/Escape while an IME composition is in progress —
      // pressing Enter to confirm Korean/Japanese/Chinese composition would
      // otherwise commit the edit prematurely with the pre-commit value.
      if (e.isComposing || e.keyCode === 229) return
      if (e.key === 'Enter' && !e.shiftKey) {
        // Plain Enter commits; Shift+Enter inserts a newline (textarea default).
        e.preventDefault()
        commit()
        return
      }
      if (e.key === 'Escape') { committed = true; this.stopEdit(); canvas.focus() }
    })
    ta.addEventListener('blur', commit)

    document.body.appendChild(ta)
    this.input = ta
    requestAnimationFrame(() => { ta.select() })
  }

  stopEdit(): void {
    if (!this.input) return
    if (this.boundBlur) {
      this.input.removeEventListener('blur', this.boundBlur)
      this.boundBlur = null
    }
    this.input.remove()
    this.input = null
  }

  dispose(): void { this.stopEdit() }
}
