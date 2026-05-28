export interface KeyboardOptions {
  onDelete:    () => void
  onEscape:    () => void
  onSelectAll: () => void
  onUndo:      () => void
  onRedo:      () => void
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
    // Attach to canvas so only the focused instance handles events
    canvas.addEventListener('keydown', this.onKeyDown)
  }

  dispose(): void {
    this.canvas.removeEventListener('keydown', this.onKeyDown)
  }
}
