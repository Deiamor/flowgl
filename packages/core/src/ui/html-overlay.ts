import type { NodeData } from '../graph/node'
import type { Viewport } from '../viewport/viewport'

interface OverlayEntry {
  div: HTMLElement
  content: string
}

export class HtmlOverlay {
  private container: HTMLElement
  private entries = new Map<string, OverlayEntry>()

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div')
    this.container.style.cssText =
      'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1;'
    parent.appendChild(this.container)
  }

  sync(nodes: NodeData[], viewport: Viewport): void {
    const active = new Set<string>()

    for (const node of nodes) {
      if (!node.htmlContent) continue
      active.add(node.id)

      let entry = this.entries.get(node.id)
      if (!entry) {
        const div = document.createElement('div')
        div.style.cssText = 'position:absolute;box-sizing:border-box;overflow:hidden;'
        this.container.appendChild(div)
        entry = { div, content: '' }
        this.entries.set(node.id, entry)
      }

      if (entry.content !== node.htmlContent) {
        entry.div.innerHTML = node.htmlContent
        entry.content = node.htmlContent
      }

      const [sx, sy] = viewport.worldToScreen(node.x, node.y)
      const w = node.width  * viewport.zoom
      const h = node.height * viewport.zoom
      entry.div.style.left   = `${sx}px`
      entry.div.style.top    = `${sy}px`
      entry.div.style.width  = `${w}px`
      entry.div.style.height = `${h}px`
    }

    // Remove stale entries
    for (const [id, entry] of this.entries) {
      if (!active.has(id)) {
        entry.div.remove()
        this.entries.delete(id)
      }
    }
  }

  dispose(): void {
    this.container.remove()
    this.entries.clear()
  }
}
