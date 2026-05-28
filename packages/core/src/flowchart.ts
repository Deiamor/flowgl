import { EventEmitter } from './events/emitter'
import { Graph } from './graph/graph'
import { Viewport } from './viewport/viewport'
import { WebGL2Renderer } from './renderer/webgl/index'
import { HitTester } from './interaction/hit-test'
import { PanZoom } from './interaction/pan-zoom'
import { NodeDrag } from './interaction/drag'
import { ConnectDrag } from './interaction/connect'
import { EdgeHitTester } from './interaction/edge-hit-test'
import { EdgeReroute } from './interaction/edge-reroute'
import { ContextMenu } from './interaction/context-menu'
import { KeyboardHandler } from './interaction/keyboard'
import { BoxSelect } from './interaction/box-select'
import { LabelEditor } from './interaction/label-edit'
import { History } from './history/history'
import { ContextPanels } from './ui/context-panels'
import { computeNodeBounds } from './renderer/webgl/cull'
import type { NodeData, NodeStyle } from './graph/node'
import type { EdgeData } from './graph/edge'
import type { ViewportState } from './viewport/viewport'
import type { RendererOptions } from './renderer/interface'
import type { ConnectState, HandleSide } from './interaction/connect'
import type { RerouteState } from './interaction/edge-reroute'
import type { GridConfig } from './types'
import { DEFAULT_GRID_CONFIG } from './types'

export interface FlowChartOptions {
  container: HTMLElement
  nodes?: NodeData[]
  edges?: EdgeData[]
  renderer?: RendererOptions
  /** Allow double-click to edit node labels inline. Default: true. */
  labelEditable?: boolean
  /** Canvas background color. Default: '#f7f7f7'. */
  background?: string
  /** Grid overlay config. */
  grid?: Partial<GridConfig>
  /** Accessible label for screen readers. Default: 'Flowchart'. */
  ariaLabel?: string
  /** Max undo history entries. Default: 100. */
  historyLimit?: number
  /**
   * Called when the renderer cannot initialize (e.g. WebGL2 unavailable).
   * If omitted, a console.error is emitted instead.
   */
  onError?: (err: Error) => void
}

interface FlowChartEvents extends Record<string, unknown> {
  nodeClick:       { node: NodeData }
  nodeDragEnd:     { id: string; x: number; y: number }
  paneClick:       { x: number; y: number }
  viewportChange:  ViewportState
  connect:         { sourceId: string; targetId: string; sourceHandle: HandleSide; targetHandle: HandleSide }
  selectionChange: { selectedIds: string[]; edgeIds: string[] }
}

export class FlowChart extends EventEmitter<FlowChartEvents> {
  private canvas: HTMLCanvasElement
  readonly graph: Graph
  readonly viewport: Viewport
  private renderer: WebGL2Renderer
  private hitTester: HitTester
  private edgeHitTester: EdgeHitTester
  private panZoom!: PanZoom
  private drag!: NodeDrag
  private connectDrag!: ConnectDrag
  private edgeReroute!: EdgeReroute
  private contextMenu: ContextMenu
  private keyboardHandler!: KeyboardHandler
  private boxSelect!: BoxSelect
  private labelEditor: LabelEditor
  private history: History
  private panels!: ContextPanels
  private resizeObserver!: ResizeObserver
  private rafId: number | null = null
  private failed = false

  private selectedIds      = new Set<string>()
  private selectedEdgeIds  = new Set<string>()
  private connectState: ConnectState | null = null
  private rerouteState: RerouteState | null = null
  private labelEditable: boolean
  private bgColor: string
  private gridConfig: GridConfig

  constructor(options: FlowChartOptions) {
    super()

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'display:block;touch-action:none;user-select:none;outline:none;'
    // Issue 2: Accessibility attributes
    this.canvas.setAttribute('role', 'application')
    this.canvas.setAttribute('aria-label', options.ariaLabel ?? 'Flowchart')
    this.canvas.setAttribute('tabindex', '0')
    options.container.appendChild(this.canvas)

    this.labelEditable = options.labelEditable ?? true
    this.bgColor       = options.background ?? '#f7f7f7'
    this.gridConfig    = { ...DEFAULT_GRID_CONFIG, ...options.grid }

    this.graph        = new Graph()
    this.viewport     = new Viewport()
    this.renderer     = new WebGL2Renderer()
    this.hitTester    = new HitTester()
    this.edgeHitTester = new EdgeHitTester()
    this.history      = new History(options.historyLimit ?? 100)
    this.contextMenu  = new ContextMenu()
    this.labelEditor  = new LabelEditor()

    const { width, height } = options.container.getBoundingClientRect()
    this.viewport.setSize(width, height)

    // Issue 1: WebGL2 error handling — graceful failure
    const ok = this.renderer.initialize(this.canvas, options.renderer)
    if (!ok) {
      this.failed = true
      const err = new Error('@flowchart/core: WebGL2 is not available in this environment')
      if (options.onError) options.onError(err)
      else console.error('[FlowChart]', err.message)
      return
    }
    this.renderer.resize(width, height)

    if (options.nodes) for (const n of options.nodes) this.graph.addNode(n)
    if (options.edges) for (const e of options.edges) this.graph.addEdge(e)

    // Issue 9: Context panels extracted to separate module
    this.panels = new ContextPanels({
      graph:          this.graph,
      contextMenu:    this.contextMenu,
      scheduleRender: () => this.scheduleRender(),
      beforeMutation: () => this.beforeMutation(),
      getBackground:  () => this.bgColor,
      setBackground:  c  => this.setBackground(c),
      getGridConfig:  () => this.gridConfig,
      setGrid:        c  => this.setGrid(c),
    })

    // Issue 3: EdgeReroute — capture-phase mousedown fires before ConnectDrag's bubble-phase
    this.edgeReroute = new EdgeReroute(
      this.canvas, this.viewport, this.graph, this.hitTester,
      () => this.selectedEdgeIds,
      (state) => { this.rerouteState = state; this.scheduleRender() },
      (edgeId, movingEnd, targetNodeId, targetHandle) => {
        this.beforeMutation()
        if (movingEnd === 'source') {
          this.graph.updateEdge(edgeId, { source: targetNodeId, sourceHandle: targetHandle })
        } else {
          this.graph.updateEdge(edgeId, { target: targetNodeId, targetHandle: targetHandle })
        }
        this.rerouteState = null
        this.scheduleRender()
      },
    )

    this.connectDrag = new ConnectDrag(
      this.canvas, this.viewport, this.graph, this.hitTester,
      (state) => { this.connectState = state; this.scheduleRender() },
      (sourceId, targetId, sourceHandle, targetHandle) => {
        this.emit('connect', { sourceId, targetId, sourceHandle, targetHandle })
      },
    )

    // Issue 3: onStart callback captures snapshot before any drag mutation
    this.drag = new NodeDrag(
      this.canvas, this.viewport, this.graph, this.hitTester,
      () => this.beforeMutation(),                    // onStart: capture before-state
      (_id, _x, _y) => this.scheduleRender(),         // onMove
      (id, x, y)    => this.emit('nodeDragEnd', { id, x, y }),  // onEnd
      (clientX, clientY) =>
        this.edgeReroute.isCapturing() ||
        this.connectDrag.isCapturing() ||
        this.connectDrag.isNearHandle(clientX, clientY),
    )

    this.panZoom = new PanZoom(
      this.canvas, this.viewport,
      () => { this.scheduleRender(); this.emit('viewportChange', this.viewport.getState()) },
      (sx, sy) => {
        if (this.edgeReroute.isCapturing()) return true
        if (this.connectDrag.isCapturing()) return true
        const [wx, wy] = this.viewport.screenToWorld(sx, sy)
        return this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy) !== null
      },
    )

    this.boxSelect = new BoxSelect(this.canvas, this.viewport, {
      shouldBlock: (clientX, clientY) => {
        if (this.edgeReroute.isCapturing()) return true
        const r = this.canvas.getBoundingClientRect()
        const [wx, wy] = this.viewport.screenToWorld(clientX - r.left, clientY - r.top)
        const nodes = this.graph.getNodes()
        if (this.hitTester.findNodeAt(nodes, wx, wy)) return true
        const nodeMap = new Map(nodes.map(n => [n.id, n]))
        return this.edgeHitTester.findEdgeAt(
          this.graph.getEdges(), nodeMap, wx, wy, this.viewport.zoom,
        ) !== null
      },
      onSelect: (minX, minY, maxX, maxY) => {
        const inBox = this.hitTester.findNodesInBox(
          this.graph.getNodes(), minX, minY, maxX, maxY,
        )
        this.selectedIds     = new Set(inBox.map(n => n.id))
        this.selectedEdgeIds.clear()
        this.emit('selectionChange', { selectedIds: [...this.selectedIds], edgeIds: [] })
        this.scheduleRender()
      },
    })

    // Issue 6: LabelEditor — canvas refocused after edit
    this.canvas.addEventListener('dblclick', (e: MouseEvent) => {
      if (!this.labelEditable) return
      const r = this.canvas.getBoundingClientRect()
      const [wx, wy] = this.viewport.screenToWorld(e.clientX - r.left, e.clientY - r.top)
      const node = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy)
      if (!node) return
      this.labelEditor.startEdit(node, this.canvas, this.viewport, (newLabel) => {
        this.beforeMutation()
        this.graph.updateNode(node.id, { label: newLabel })
        this.scheduleRender()
      })
    })

    this.canvas.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault()
      const r = this.canvas.getBoundingClientRect()
      const [wx, wy] = this.viewport.screenToWorld(e.clientX - r.left, e.clientY - r.top)
      const nodes = this.graph.getNodes()
      const node  = this.hitTester.findNodeAt(nodes, wx, wy)

      if (node) {
        if (!this.selectedIds.has(node.id)) {
          this.selectedIds.clear()
          this.selectedIds.add(node.id)
          this.selectedEdgeIds.clear()
          this.emit('selectionChange', { selectedIds: [node.id], edgeIds: [] })
          this.scheduleRender()
        }
        this.contextMenu.show(e.clientX, e.clientY, [
          {
            label: 'Edit Label',
            action: () => {
              this.labelEditor.startEdit(node, this.canvas, this.viewport, (newLabel) => {
                this.beforeMutation()
                this.graph.updateNode(node.id, { label: newLabel })
                this.scheduleRender()
              })
            },
          },
          { separator: true },
          { label: 'Delete Node', destructive: true, action: () => this.deleteSelected() },
        ])
        return
      }

      const nodeMap = new Map(nodes.map(n => [n.id, n]))
      const edge = this.edgeHitTester.findEdgeAt(
        this.graph.getEdges(), nodeMap, wx, wy, this.viewport.zoom,
      )
      if (edge) {
        if (!this.selectedEdgeIds.has(edge.id)) {
          this.selectedIds.clear()
          this.selectedEdgeIds.clear()
          this.selectedEdgeIds.add(edge.id)
          this.emit('selectionChange', { selectedIds: [], edgeIds: [edge.id] })
          this.scheduleRender()
        }
        this.contextMenu.show(e.clientX, e.clientY, [
          { label: 'Style', panel: () => this.panels.edgeStyle(edge) },
          { separator: true },
          { label: 'Delete Edge', destructive: true, action: () => this.deleteSelected() },
        ])
        return
      }

      // Pane right-click
      this.contextMenu.show(e.clientX, e.clientY, [
        { label: 'Background',  panel: () => this.panels.background() },
        { label: 'Grid',        panel: () => this.panels.grid() },
        { separator: true },
        { label: 'Auto Layout', panel: () => this.panels.autoLayout() },
      ])
    })

    // Issue 6 + 3: KeyboardHandler — canvas-scoped + undo/redo
    this.keyboardHandler = new KeyboardHandler(this.canvas, {
      onDelete:    () => this.deleteSelected(),
      onEscape:    () => {
        this.connectDrag.cancel()
        this.connectState = null
        if (this.selectedIds.size > 0 || this.selectedEdgeIds.size > 0) {
          this.selectedIds.clear()
          this.selectedEdgeIds.clear()
          this.emit('selectionChange', { selectedIds: [], edgeIds: [] })
        }
        this.scheduleRender()
      },
      onSelectAll: () => {
        this.selectedIds     = new Set(this.graph.getNodes().map(n => n.id))
        this.selectedEdgeIds = new Set(this.graph.getEdges().map(e => e.id))
        this.emit('selectionChange', {
          selectedIds: [...this.selectedIds],
          edgeIds: [...this.selectedEdgeIds],
        })
        this.scheduleRender()
      },
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
    })

    // Issue 2: Focus canvas on click so keyboard events are received
    this.canvas.addEventListener('mousedown', () => { this.canvas.focus() })

    this.canvas.addEventListener('click', (e: MouseEvent) => {
      if (e.shiftKey) return
      if (this.edgeReroute.isOnEndpoint(e.clientX, e.clientY)) return

      const r = this.canvas.getBoundingClientRect()
      const [wx, wy] = this.viewport.screenToWorld(e.clientX - r.left, e.clientY - r.top)
      const node = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy)

      if (node) {
        if (e.metaKey || e.ctrlKey) {
          if (this.selectedIds.has(node.id)) this.selectedIds.delete(node.id)
          else this.selectedIds.add(node.id)
        } else {
          this.selectedIds.clear()
          this.selectedIds.add(node.id)
          this.selectedEdgeIds.clear()
        }
        this.emit('nodeClick', { node })
        this.emit('selectionChange', {
          selectedIds: [...this.selectedIds],
          edgeIds: [...this.selectedEdgeIds],
        })
        this.scheduleRender()
        return
      }

      const nodes   = this.graph.getNodes()
      const nodeMap = new Map(nodes.map(n => [n.id, n]))
      const edge = this.edgeHitTester.findEdgeAt(
        this.graph.getEdges(), nodeMap, wx, wy, this.viewport.zoom,
      )

      if (edge) {
        if (e.metaKey || e.ctrlKey) {
          if (this.selectedEdgeIds.has(edge.id)) this.selectedEdgeIds.delete(edge.id)
          else this.selectedEdgeIds.add(edge.id)
        } else {
          this.selectedIds.clear()
          this.selectedEdgeIds.clear()
          this.selectedEdgeIds.add(edge.id)
        }
        this.emit('selectionChange', {
          selectedIds: [...this.selectedIds],
          edgeIds: [...this.selectedEdgeIds],
        })
        this.scheduleRender()
        return
      }

      if (this.selectedIds.size > 0 || this.selectedEdgeIds.size > 0) {
        this.selectedIds.clear()
        this.selectedEdgeIds.clear()
        this.emit('selectionChange', { selectedIds: [], edgeIds: [] })
        this.scheduleRender()
      }
      this.emit('paneClick', { x: wx, y: wy })
    })

    this.resizeObserver = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      this.viewport.setSize(rect.width, rect.height)
      this.renderer.resize(rect.width, rect.height)
      this.scheduleRender()
    })
    this.resizeObserver.observe(options.container)

    this.scheduleRender()
  }

  // ── Undo / Redo ───────────────────────────────────────────────────────────────

  /** Capture current graph state for undo. Called before any mutation. */
  private beforeMutation(): void {
    this.history.save({
      nodes: this.graph.getNodes().map(n => {
        const { style, ...rest } = n
        return style ? { ...rest, style: { ...style } } : rest
      }),
      edges: this.graph.getEdges().map(e => {
        const { style, ...rest } = e
        return style ? { ...rest, style: { ...style } } : rest
      }),
    })
  }

  private applySnapshot(snap: { nodes: NodeData[]; edges: EdgeData[] }): void {
    this.graph.clear()
    this.selectedIds.clear()
    this.selectedEdgeIds.clear()
    for (const n of snap.nodes) this.graph.addNode(n)
    for (const e of snap.edges) this.graph.addEdge(e)
    this.emit('selectionChange', { selectedIds: [], edgeIds: [] })
    this.scheduleRender()
  }

  /** Undo the last action. Returns true if successful. */
  undo(): boolean {
    if (this.failed) return false
    const current = {
      nodes: this.graph.getNodes().map(n => { const { style, ...rest } = n; return style ? { ...rest, style: { ...style } } : rest }),
      edges: this.graph.getEdges().map(e => { const { style, ...rest } = e; return style ? { ...rest, style: { ...style } } : rest }),
    }
    const prev = this.history.undo(current)
    if (!prev) return false
    this.applySnapshot(prev)
    return true
  }

  /** Redo a previously undone action. Returns true if successful. */
  redo(): boolean {
    if (this.failed) return false
    const current = {
      nodes: this.graph.getNodes().map(n => { const { style, ...rest } = n; return style ? { ...rest, style: { ...style } } : rest }),
      edges: this.graph.getEdges().map(e => { const { style, ...rest } = e; return style ? { ...rest, style: { ...style } } : rest }),
    }
    const next = this.history.redo(current)
    if (!next) return false
    this.applySnapshot(next)
    return true
  }

  canUndo(): boolean { return this.history.canUndo() }
  canRedo(): boolean { return this.history.canRedo() }

  // ── Serialization ─────────────────────────────────────────────────────────────

  /** Serialize the full chart state (nodes, edges, viewport). */
  toJSON(): { version: number; nodes: NodeData[]; edges: EdgeData[]; viewport: ViewportState } {
    return {
      version:  1,
      nodes:    this.graph.getNodes().map(n => ({ ...n })),
      edges:    this.graph.getEdges().map(e => ({ ...e })),
      viewport: this.viewport.getState(),
    }
  }

  /** Load a previously serialized chart state. Replaces current content. */
  fromJSON(data: { version?: number; nodes: NodeData[]; edges: EdgeData[]; viewport?: ViewportState }): void {
    if (this.failed) return
    this.history.clear()
    this.graph.clear()
    this.selectedIds.clear()
    this.selectedEdgeIds.clear()
    for (const n of data.nodes) this.graph.addNode(n)
    for (const e of data.edges) this.graph.addEdge(e)
    if (data.viewport) this.viewport.setState(data.viewport)
    this.emit('selectionChange', { selectedIds: [], edgeIds: [] })
    this.scheduleRender()
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  private scheduleRender(): void {
    if (this.failed || this.rafId !== null) return
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null
      this.renderer.render(
        this.graph, this.viewport,
        this.selectedIds, this.connectState,
        this.selectedEdgeIds,
        this.bgColor,
        this.gridConfig.visible ? this.gridConfig : null,
        this.rerouteState,
        this.edgeReroute.getEndpointCircles(),
      )
    })
  }

  private deleteSelected(): void {
    this.beforeMutation()
    for (const id of this.selectedEdgeIds) this.graph.removeEdge(id)
    this.selectedEdgeIds.clear()
    for (const id of this.selectedIds) this.graph.removeNode(id)
    this.selectedIds.clear()
    this.emit('selectionChange', { selectedIds: [], edgeIds: [] })
    this.scheduleRender()
  }

  // ── Node style API ────────────────────────────────────────────────────────────

  setNodeStyle(id: string, style: Partial<NodeStyle>): void {
    const node = this.graph.getNode(id)
    if (!node) return
    this.graph.updateNode(id, { style: { ...node.style, ...style } })
    this.scheduleRender()
  }

  setNodeBorderColor(id: string, color: string): void { this.setNodeStyle(id, { borderColor: color }) }
  setNodeBackgroundColor(id: string, color: string): void { this.setNodeStyle(id, { backgroundColor: color }) }

  setNodeSize(id: string, width: number, height: number): void {
    this.graph.updateNode(id, { width, height })
    this.scheduleRender()
  }

  // ── Canvas appearance API ─────────────────────────────────────────────────────

  setBackground(color: string): void {
    this.bgColor = color
    this.scheduleRender()
  }

  setGrid(config: Partial<GridConfig>): void {
    this.gridConfig = { ...this.gridConfig, ...config }
    this.scheduleRender()
  }

  // ── Selection API ─────────────────────────────────────────────────────────────

  setLabelEditable(enabled: boolean): void { this.labelEditable = enabled }

  getSelectedIds(): string[] { return [...this.selectedIds] }
  getSelectedEdgeIds(): string[] { return [...this.selectedEdgeIds] }

  setSelectedIds(ids: string[]): void {
    this.selectedIds = new Set(ids)
    this.scheduleRender()
  }

  clearSelection(): void {
    this.selectedIds.clear()
    this.selectedEdgeIds.clear()
    this.scheduleRender()
  }

  // ── Graph mutation API ────────────────────────────────────────────────────────

  addNode(node: NodeData): void {
    this.beforeMutation()
    this.graph.addNode(node)
    this.scheduleRender()
  }

  removeNode(id: string): void {
    this.beforeMutation()
    this.graph.removeNode(id)
    this.selectedIds.delete(id)
    const remaining = new Set(this.graph.getEdges().map(e => e.id))
    for (const eid of this.selectedEdgeIds) {
      if (!remaining.has(eid)) this.selectedEdgeIds.delete(eid)
    }
    this.scheduleRender()
  }

  updateNode(id: string, updates: Partial<Omit<NodeData, 'id'>>): void {
    this.graph.updateNode(id, updates)
    this.scheduleRender()
  }

  addEdge(edge: EdgeData): void {
    this.beforeMutation()
    this.graph.addEdge(edge)
    this.scheduleRender()
  }

  removeEdge(id: string): void {
    this.beforeMutation()
    this.graph.removeEdge(id)
    this.selectedEdgeIds.delete(id)
    this.scheduleRender()
  }

  setNodes(nodes: NodeData[]): void {
    this.graph.clear()
    this.selectedIds.clear()
    this.selectedEdgeIds.clear()
    this.history.clear()
    for (const n of nodes) this.graph.addNode(n)
    this.scheduleRender()
  }

  setEdges(edges: EdgeData[]): void {
    for (const e of this.graph.getEdges()) this.graph.removeEdge(e.id)
    this.selectedEdgeIds.clear()
    for (const e of edges) this.graph.addEdge(e)
    this.scheduleRender()
  }

  // ── Viewport API ──────────────────────────────────────────────────────────────

  getViewport(): ViewportState  { return this.viewport.getState() }

  setViewport(state: ViewportState): void {
    this.viewport.setState(state)
    this.scheduleRender()
  }

  fitView(padding = 40): void {
    const nodes = this.graph.getNodes()
    if (nodes.length === 0) return
    this.viewport.fit(computeNodeBounds(nodes), padding)
    this.scheduleRender()
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    if (!this.failed) {
      this.panZoom.dispose()
      this.drag.dispose()
      this.connectDrag.dispose()
      this.edgeReroute.dispose()
      this.boxSelect.dispose()
      this.keyboardHandler.dispose()
      this.renderer.dispose()
    }
    this.resizeObserver.disconnect()
    this.labelEditor.dispose()
    this.contextMenu.dispose()
    this.canvas.remove()
    super.dispose()
  }
}
