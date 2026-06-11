import type { NodeData } from '../graph/node'
import type { Viewport } from '../viewport/viewport'
import { DEFAULT_NODE_STYLE } from '../graph/node'
import { safeColor, safeNumber, safeFontFamily } from '../services/safe-css'

export class LabelEditor {
  private input: HTMLInputElement | null = null
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

    const input = document.createElement('input')
    input.type  = 'text'
    input.value = node.label
    // Set base style via cssText (no user input), then user-controlled fields
    // via setProperty to prevent CSS-injection breakouts.
    input.style.cssText = [
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
    ].join(';')
    input.style.setProperty('left',         `${canvasRect.left + sx}px`)
    input.style.setProperty('top',          `${canvasRect.top  + sy}px`)
    input.style.setProperty('width',        `${Math.max(80, node.width * viewport.zoom - 20)}px`)
    input.style.setProperty('border-color', safeColor(style.borderColor,     '#1a73e8'))
    input.style.setProperty('background',   safeColor(style.backgroundColor, '#fff'))
    input.style.setProperty('color',        safeColor(style.textColor,       '#1a1a1a'))
    input.style.setProperty('font-size',    `${safeNumber(style.fontSize, 14) * viewport.zoom}px`)
    input.style.setProperty('font-family',  safeFontFamily(style.fontFamily, 'system-ui, sans-serif'))

    let committed = false
    const commit = (): void => {
      if (committed) return
      committed = true
      onDone(input.value.trim() || node.label)
      this.stopEdit()
      // Return focus to canvas so keyboard shortcuts keep working
      canvas.focus()
    }

    // Store a stable reference so removeEventListener works correctly
    this.boundBlur = commit
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      e.stopPropagation()
      // Ignore Enter/Escape while an IME composition is in progress —
      // pressing Enter to confirm Korean/Japanese/Chinese composition would
      // otherwise commit the edit prematurely with the pre-commit value.
      if (e.isComposing || e.keyCode === 229) return
      if (e.key === 'Enter') commit()
      if (e.key === 'Escape') { committed = true; this.stopEdit(); canvas.focus() }
    })
    input.addEventListener('blur', commit)

    document.body.appendChild(input)
    this.input = input
    requestAnimationFrame(() => { input.select() })
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

// Validators are now in services/safe-css.ts — single source of truth.
