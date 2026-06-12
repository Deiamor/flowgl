type ArrowDirection = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

export interface KeyboardOptions {
  onDelete:          () => void
  onEscape:          () => void
  onSelectAll:       () => void
  onUndo:            () => void
  onRedo:            () => void
  /** Return true to consume the Tab event; false to let the browser advance focus out of the chart. */
  onTabNext:         () => boolean
  /** Return true to consume; false to let the browser go back out of the chart. */
  onTabPrev:         () => boolean
  onArrowKey:        (direction: ArrowDirection) => void
  onCopy:            () => void
  onPaste:           () => void
  onCut:             () => void
  onDuplicate:       () => void
  onFitView:         () => void
  onFitViewSelection:() => void
  onZoomIn:          () => void
  onZoomOut:         () => void
}

const EDITING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export class KeyboardHandler {
  private readonly canvas: HTMLElement
  private readonly onKeyDown: (e: KeyboardEvent) => void

  constructor(canvas: HTMLElement, opts: KeyboardOptions) {
    this.canvas = canvas
    this.onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as Element | null)?.tagName ?? ''
      if (EDITING_TAGS.has(tag)) return

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          opts.onDelete()
          break
        case 'Escape':
          opts.onEscape()
          break
        case 'Tab': {
          // WCAG 2.4.3 — focus must NEVER be trapped. The chart consumes
          // Tab while there is a cycle target (e.g. another selectable
          // node); when the cycle wraps past the last node, the chart
          // returns false from onTabNext / onTabPrev and the browser
          // moves focus out of the canvas.
          const consumed = e.shiftKey ? opts.onTabPrev() : opts.onTabNext()
          if (consumed) e.preventDefault()
          break
        }
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          e.preventDefault()
          opts.onArrowKey(e.key as ArrowDirection)
          break
        case 'z':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            if (e.shiftKey) opts.onRedo()
            else opts.onUndo()
          }
          break
        case 'y':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            opts.onRedo()
          }
          break
        case 'a':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            opts.onSelectAll()
          }
          break
        case 'c':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            opts.onCopy()
          }
          break
        case 'v':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            opts.onPaste()
          }
          break
        case 'x':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            opts.onCut()
          }
          break
        case 'd':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            opts.onDuplicate()
          }
          break
        case 'f':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            if (e.shiftKey) opts.onFitViewSelection()
            else opts.onFitView()
          }
          break
        case '=':
        case '+':
          // WCAG 2.1.1 — every functional UI action must have a keyboard
          // equivalent. Ctrl/Cmd + (=) zooms in to match common app idiom.
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            opts.onZoomIn()
          }
          break
        case '-':
        case '_':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            opts.onZoomOut()
          }
          break
      }
    }
    canvas.addEventListener('keydown', this.onKeyDown)
  }

  dispose(): void {
    this.canvas.removeEventListener('keydown', this.onKeyDown)
  }
}
