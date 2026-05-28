type ArrowDirection = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

export interface KeyboardOptions {
  onDelete:    () => void
  onEscape:    () => void
  onSelectAll: () => void
  onUndo:      () => void
  onRedo:      () => void
  onTabNext:   () => void
  onTabPrev:   () => void
  onArrowKey:  (direction: ArrowDirection) => void
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
        case 'Tab':
          e.preventDefault()
          if (e.shiftKey) opts.onTabPrev()
          else opts.onTabNext()
          break
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
      }
    }
    canvas.addEventListener('keydown', this.onKeyDown)
  }

  dispose(): void {
    this.canvas.removeEventListener('keydown', this.onKeyDown)
  }
}
