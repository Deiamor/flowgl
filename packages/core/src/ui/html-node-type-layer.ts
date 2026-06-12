import type { Graph } from '../graph/graph'
import type { Viewport } from '../viewport/viewport'
import type { NodeData } from '../graph/node'
import type { NodeTypeRegistry } from '../graph/node-type-registry'

/**
 * Per-frame layer that maintains a `<div>` for every node whose
 * `NodeData.type` resolves to a registered `'html'` node-type. The div
 * is positioned over the node's world-space rect via
 * `viewport.worldToScreen` and scaled to match the current zoom — so
 * its content sees the same pixel density as the canvas.
 *
 * Design choices:
 *   - One container `<div>` (`data-flowgl-html-node-root`) hosts every
 *     mounted node. Per-node `<div>`s sit inside it. Adding the
 *     container at z-index 5 puts custom nodes between the WebGL
 *     canvas (z-index 0) and the highlight overlay (z-index 1).
 *     Built-in shapes still render on the canvas; their handles /
 *     labels / status badges render on top of the HTML layer.
 *   - Pointer events route to `<div>` first when the user clicks
 *     inside one. Standard DOM event flow + the chart's mousedown
 *     listener on the canvas means drag / connect / select still work
 *     as long as the HTML node doesn't `stopPropagation`. The render
 *     callback contract documents this.
 *   - Position updates run inside the existing render loop (cheap —
 *     just transform string updates).
 *
 * Per-node `<div>` attributes:
 *   - `data-flowgl-html-node="<nodeId>"`
 *   - `data-flowgl-html-type="<typeName>"`
 *   - `data-flowgl-selected="true|false"`
 */
export class HtmlNodeTypeLayer {
  private readonly container: HTMLElement
  private readonly root: HTMLDivElement
  private readonly viewport: Viewport
  private readonly graph: Graph
  private readonly registry: NodeTypeRegistry
  private readonly getSelectedIds: () => Set<string>
  private readonly getReadOnly: () => boolean
  private mounted = new Map<string, { el: HTMLDivElement; typeName: string }>()

  constructor(
    container: HTMLElement,
    viewport: Viewport,
    graph: Graph,
    registry: NodeTypeRegistry,
    getSelectedIds: () => Set<string>,
    getReadOnly: () => boolean,
  ) {
    this.container = container
    this.viewport = viewport
    this.graph = graph
    this.registry = registry
    this.getSelectedIds = getSelectedIds
    this.getReadOnly = getReadOnly

    this.root = document.createElement('div')
    this.root.setAttribute('data-flowgl-html-node-root', '')
    this.root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;'
    this.container.appendChild(this.root)
  }

  /** Recomputes positions + content for every mounted custom node. Idempotent. */
  reposition(): void {
    const liveIds = new Set<string>()
    const selectedIds = this.getSelectedIds()
    const readOnly = this.getReadOnly()
    const zoom = this.viewport.zoom

    for (const node of this.graph.getNodes()) {
      if (!node.type) continue
      const def = this.registry.get(node.type)
      if (!def || def.category !== 'html') continue
      liveIds.add(node.id)

      let entry = this.mounted.get(node.id)
      if (!entry) {
        const el = document.createElement('div')
        el.setAttribute('data-flowgl-html-node', node.id)
        el.setAttribute('data-flowgl-html-type', node.type)
        el.style.cssText = 'position:absolute;box-sizing:border-box;pointer-events:auto;will-change:transform,width,height;transform-origin:0 0;'
        if (def.className) {
          el.className = def.className.replace(/[^A-Za-z0-9_\- ]/g, '')
        }
        this.root.appendChild(el)
        entry = { el, typeName: node.type }
        this.mounted.set(node.id, entry)
      } else if (entry.typeName !== node.type) {
        // Node type changed at runtime — replace the div so the previous
        // type's `destroy` hook fires cleanly and the new render starts
        // from a blank slate.
        const oldDef = this.registry.get(entry.typeName)
        oldDef?.destroy?.(entry.el, node)
        entry.el.remove()
        const el = document.createElement('div')
        el.setAttribute('data-flowgl-html-node', node.id)
        el.setAttribute('data-flowgl-html-type', node.type)
        el.style.cssText = 'position:absolute;box-sizing:border-box;pointer-events:auto;will-change:transform,width,height;transform-origin:0 0;'
        if (def.className) {
          el.className = def.className.replace(/[^A-Za-z0-9_\- ]/g, '')
        }
        this.root.appendChild(el)
        entry = { el, typeName: node.type }
        this.mounted.set(node.id, entry)
      }

      const [sx, sy] = this.viewport.worldToScreen(node.x, node.y)
      const selected = selectedIds.has(node.id)
      entry.el.style.transform = `translate(${sx}px, ${sy}px) scale(${zoom})`
      entry.el.style.width  = `${node.width}px`
      entry.el.style.height = `${node.height}px`
      entry.el.setAttribute('data-flowgl-selected', selected ? 'true' : 'false')

      def.render!(entry.el, node, { zoom, selected, readOnly })
    }

    // Unmount nodes that disappeared from the graph.
    for (const [id, entry] of this.mounted) {
      if (!liveIds.has(id)) {
        const def = this.registry.get(entry.typeName)
        const node = this.graph.getNode(id) ?? ({ id } as NodeData)
        def?.destroy?.(entry.el, node)
        entry.el.remove()
        this.mounted.delete(id)
      }
    }
  }

  /** Per-node element accessor. Useful for tests / instrumentation. */
  getElement(nodeId: string): HTMLDivElement | undefined {
    return this.mounted.get(nodeId)?.el
  }

  dispose(): void {
    for (const [id, entry] of this.mounted) {
      const def = this.registry.get(entry.typeName)
      const node = this.graph.getNode(id) ?? ({ id } as NodeData)
      def?.destroy?.(entry.el, node)
      entry.el.remove()
    }
    this.mounted.clear()
    this.root.remove()
  }
}
