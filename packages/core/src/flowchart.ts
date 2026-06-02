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
import { EdgeWaypoint } from './interaction/edge-waypoint'
import { ContextMenu } from './interaction/context-menu'
import { KeyboardHandler } from './interaction/keyboard'
import { BoxSelect } from './interaction/box-select'
import { LabelEditor } from './interaction/label-edit'
import { NodeResize } from './interaction/node-resize'
import { History } from './history/history'
import { ContextPanels } from './ui/context-panels'
import { Minimap } from './ui/minimap'
import { HtmlOverlay } from './ui/html-overlay'
import { computeNodeBounds } from './renderer/webgl/cull'
import { handleXY } from './renderer/webgl/util/handle-xy'
import { edgeControlPoints } from './renderer/webgl/util/bezier'
import type { NodeData, NodeStyle, NodeShape, NodeStatus } from './graph/node'
import type { EdgeData, EdgeStyle } from './graph/edge'
import type { ViewportState, AABB } from './viewport/viewport'
import type { RendererOptions } from './renderer/interface'
import type { ConnectState, HandleSide } from './interaction/connect'
import type { RerouteState } from './interaction/edge-reroute'
import type { GridConfig, MinimapConfig } from './types'
import { DEFAULT_GRID_CONFIG } from './types'
import { generateId } from './utils/id'

export interface FlowChartOptions {
  container: HTMLElement
  nodes?: NodeData[]
  edges?: EdgeData[]
  renderer?: RendererOptions
  /** Allow double-click to edit node labels inline. Default: true. */
  labelEditable?: boolean
  /**
   * When true, all editing interactions are disabled: drag, connect, resize,
   * label edit, keyboard delete, and right-click mutation menu. Default: false.
   */
  readOnly?: boolean
  /** Canvas background color. Default: '#f7f7f7'. */
  background?: string
  /** Grid overlay config. */
  grid?: Partial<GridConfig>
  /** Minimap overlay config. Omit to disable. */
  minimap?: Partial<MinimapConfig>
  /** Accessible label for screen readers. Default: 'Flowchart'. */
  ariaLabel?: string
  /** Max undo history entries. Default: 100. */
  historyLimit?: number
  /** Snap node drag to a grid of this size (world units). 0 = off. Default: 0. */
  snapGrid?: number
  /**
   * Return false to reject a connection before it is created.
   * Called after the user finishes a ConnectDrag gesture.
   */
  onBeforeConnect?: (params: {
    sourceId: string; targetId: string
    sourceHandle: string; targetHandle: string
  }) => boolean
  /**
   * Return false to cancel deletion of the selected nodes/edges.
   * Called before any nodes or edges are removed.
   */
  onBeforeDelete?: (nodeIds: string[], edgeIds: string[]) => boolean
  /**
   * Called when the renderer cannot initialize (e.g. WebGL2 unavailable).
   * If omitted, a console.error is emitted instead.
   */
  onError?: (err: Error) => void
  /** When true, automatically fit the view to the initial nodes after construction. Default: false. */
  autoFit?: boolean
}

export interface FlowChartEvents extends Record<string, unknown> {
  nodeClick:        { node: NodeData }
  nodeDoubleClick:  { node: NodeData }
  nodeDragStart:    { id: string }
  nodeDragEnd:      { id: string; x: number; y: number }
  edgeClick:        { edge: EdgeData }
  edgeDoubleClick:  { edge: EdgeData }
  edgeUpdate:       { id: string; updates: Partial<Omit<EdgeData, 'id'>> }
  nodeResize:       { id: string; x: number; y: number; width: number; height: number }
  paneClick:        { x: number; y: number }
  viewportChange:   ViewportState
  connect:          { sourceId: string; targetId: string; sourceHandle: HandleSide; targetHandle: HandleSide }
  selectionChange:  { selectedIds: string[]; edgeIds: string[] }
  nodeAdd:          { node: NodeData }
  nodeRemove:       { id: string }
  nodeUpdate:       { id: string; updates: Partial<Omit<NodeData, 'id'>> }
  edgeAdd:          { edge: EdgeData }
  edgeRemove:       { id: string }
  historyChange:    { canUndo: boolean; canRedo: boolean }
  nodeHover:        { node: NodeData | null }
  edgeHover:        { edge: EdgeData | null }
}

export class FlowChart extends EventEmitter<FlowChartEvents> {
  private canvas!: HTMLCanvasElement
  readonly graph!: Graph
  readonly viewport!: Viewport
  private renderer!: WebGL2Renderer
  private hitTester!: HitTester
  private edgeHitTester!: EdgeHitTester
  private panZoom!: PanZoom
  private drag!: NodeDrag
  private connectDrag!: ConnectDrag
  private edgeReroute!: EdgeReroute
  private contextMenu!: ContextMenu
  private keyboardHandler!: KeyboardHandler
  private boxSelect!: BoxSelect
  private labelEditor!: LabelEditor
  private nodeResize!: NodeResize
  private edgeWaypoint!: EdgeWaypoint
  private waypointOverlay!: HTMLDivElement
  private history!: History
  private panels!: ContextPanels
  private resizeObserver!: ResizeObserver
  private ariaLive!: HTMLElement
  private arrowMoveTimer: ReturnType<typeof setTimeout> | null = null
  private rafId: number | null = null
  private animRafId: number | null = null
  private pendingResize: { w: number, h: number } | null = null
  private layoutAnim: {
    targets: Map<string, { fx: number; fy: number; tx: number; ty: number }>
    start: number
    dur: number
  } | null = null
  private failed = false

  private selectedIds      = new Set<string>()
  private selectedEdgeIds  = new Set<string>()
  private connectState: ConnectState | null = null
  private rerouteState: RerouteState | null = null
  private minimap: Minimap | null = null
  private htmlOverlay!: HtmlOverlay
  private labelEditable!: boolean
  private readOnly!: boolean
  private bgColor!: string
  private gridConfig!: GridConfig
  private snapGridSize = 0
  private onBeforeConnect: FlowChartOptions['onBeforeConnect'] = undefined
  private onBeforeDelete:  FlowChartOptions['onBeforeDelete']  = undefined
  private clipboard: { nodes: NodeData[]; edges: EdgeData[] } | null = null
  private highlightedNodeIds = new Set<string>()
  private highlightOverlay!: HTMLCanvasElement
  private highlightCtx!: CanvasRenderingContext2D
  private statusOverlay!: HTMLCanvasElement
  private statusCtx!: CanvasRenderingContext2D
  private hoveredNodeId: string | null = null
  private hoveredEdgeId: string | null = null
  private tooltipEl: HTMLDivElement | null = null
  private hoverMoveHandler: ((e: MouseEvent) => void) | null = null
  private hoverLeaveHandler: (() => void) | null = null
  private edgeDashOffset  = 0
  private batching        = false
  private batchMutSaved   = false

  // Canvas event handler references — stored so dispose() can removeEventListener
  private canvasDblClick!:      (e: MouseEvent) => void
  private canvasContextMenu!:   (e: MouseEvent) => void
  private canvasMouseDown!:     () => void
  private canvasClick!:         (e: MouseEvent) => void
  private ariaDesc!:            HTMLElement

  constructor(options: FlowChartOptions) {
    super()

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      this.failed = true
      const err = new Error('@flowchart/core: browser environment required')
      if (options.onError) options.onError(err)
      else console.error('[FlowChart]', err.message)
      return
    }

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'display:block;touch-action:none;user-select:none;outline:none;'
    this.canvas.setAttribute('role', 'application')
    this.canvas.setAttribute('aria-label', options.ariaLabel ?? 'Flowchart')
    this.canvas.setAttribute('tabindex', '0')
    options.container.appendChild(this.canvas)

    this.ariaLive = document.createElement('div')
    this.ariaLive.setAttribute('aria-live', 'polite')
    this.ariaLive.setAttribute('aria-atomic', 'true')
    this.ariaLive.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;'
    options.container.appendChild(this.ariaLive)

    this.ariaDesc = document.createElement('div')
    this.ariaDesc.id = `fc-desc-${generateId()}`
    this.ariaDesc.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;'
    this.ariaDesc.textContent = 'Tab / Shift+Tab: navigate nodes. Arrow keys: move selected node. Delete: remove. Ctrl+A: select all. Ctrl+C/X/V: copy/cut/paste. Double-click group: collapse/expand. Drag node edges to connect. Click edge to select, then drag midpoint to add waypoint, right-click waypoint to remove.'
    options.container.appendChild(this.ariaDesc)
    this.canvas.setAttribute('aria-describedby', this.ariaDesc.id)

    this.labelEditable = options.labelEditable ?? true
    this.readOnly      = options.readOnly ?? false
    this.bgColor       = options.background ?? '#f7f7f7'
    this.gridConfig    = { ...DEFAULT_GRID_CONFIG, ...options.grid }
    this.snapGridSize    = options.snapGrid ?? 0
    this.onBeforeConnect = options.onBeforeConnect
    this.onBeforeDelete  = options.onBeforeDelete

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

    if (options.nodes) for (const n of options.nodes) this.graph.addNode(n)
    if (options.edges) for (const e of options.edges) this.graph.addEdge(e)
    if (options.autoFit && this.graph.getNodes().length > 0) {
      this.viewport.fit(computeNodeBounds(this.graph.getNodes()), 40)
    }

    const ok = this.renderer.initialize(
      this.canvas,
      options.renderer,
      () => {
        console.warn('[FlowChart] WebGL context lost — rendering suspended')
        options.onError?.(new Error('@flowchart/core: WebGL context lost'))
      },
      () => {
        console.info('[FlowChart] WebGL context restored — resuming')
        this.scheduleRender()
      },
    )
    if (!ok) {
      this.failed = true
      const err = new Error('@flowchart/core: WebGL2 is not available in this environment')
      if (options.onError) options.onError(err)
      else console.error('[FlowChart]', err.message)
      return
    }
    this.renderer.resize(width, height)
    this.htmlOverlay = new HtmlOverlay(options.container)

    // Waypoint handle overlay
    this.waypointOverlay = document.createElement('div')
    Object.assign(this.waypointOverlay.style, {
      position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '15',
    })
    options.container.appendChild(this.waypointOverlay)

    this.nodeResize  = new NodeResize(
      options.container, this.canvas, this.viewport, this.graph,
      () => this.beforeMutation(),
      () => this.scheduleRender(),
      (id, x, y, width, height) => this.emit('nodeResize', { id, x, y, width, height }),
    )

    this.highlightOverlay = document.createElement('canvas')
    this.highlightOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;'
    options.container.appendChild(this.highlightOverlay)
    const hCtx = this.highlightOverlay.getContext('2d')
    if (!hCtx) throw new Error('FlowChart: highlight context unavailable')
    this.highlightCtx = hCtx

    this.statusOverlay = document.createElement('canvas')
    this.statusOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;'
    options.container.appendChild(this.statusOverlay)
    const sCtx = this.statusOverlay.getContext('2d')
    if (!sCtx) throw new Error('FlowChart: status context unavailable')
    this.statusCtx = sCtx

    // Tooltip DOM element (shared, repositioned on hover)
    const tip = document.createElement('div')
    tip.style.cssText = [
      'position:fixed;z-index:9999;pointer-events:none;',
      'max-width:240px;padding:5px 10px;border-radius:6px;',
      'background:rgba(15,23,42,0.92);color:#e2e8f0;',
      'font:12px/1.4 system-ui,sans-serif;',
      'box-shadow:0 2px 8px rgba(0,0,0,0.3);',
      'display:none;white-space:pre-wrap;',
    ].join('')
    document.body.appendChild(tip)
    this.tooltipEl = tip

    // Hover tracking: node + edge hover events + tooltip
    this.hoverMoveHandler = (e: MouseEvent): void => {
      if (this.connectDrag.isCapturing()) return
      const r = this.canvas.getBoundingClientRect()
      const [wx, wy] = this.viewport.screenToWorld(e.clientX - r.left, e.clientY - r.top)
      const nodes = this.graph.getNodes()

      const hitNode = this.hitTester.findNodeAt(nodes, wx, wy)
      const newNodeId = hitNode?.id ?? null
      if (newNodeId !== this.hoveredNodeId) {
        this.hoveredNodeId = newNodeId
        this.emit('nodeHover', { node: hitNode ?? null })
      }

      if (!hitNode) {
        const nodeMap = new Map(nodes.map(n => [n.id, n]))
        const hitEdge = this.edgeHitTester.findEdgeAt(
          this.graph.getEdges(), nodeMap, wx, wy, this.viewport.zoom,
        )
        const newEdgeId = hitEdge?.id ?? null
        if (newEdgeId !== this.hoveredEdgeId) {
          this.hoveredEdgeId = newEdgeId
          this.emit('edgeHover', { edge: hitEdge ?? null })
        }
      } else if (this.hoveredEdgeId !== null) {
        this.hoveredEdgeId = null
        this.emit('edgeHover', { edge: null })
      }

      // Tooltip
      if (tip && hitNode?.tooltip) {
        tip.textContent = hitNode.tooltip
        tip.style.display = 'block'
        tip.style.left = `${e.clientX + 14}px`
        tip.style.top  = `${e.clientY + 14}px`
      } else if (tip) {
        tip.style.display = 'none'
      }
    }
    this.hoverLeaveHandler = (): void => {
      if (tip) tip.style.display = 'none'
      if (this.hoveredNodeId !== null) { this.hoveredNodeId = null; this.emit('nodeHover', { node: null }) }
      if (this.hoveredEdgeId !== null) { this.hoveredEdgeId = null; this.emit('edgeHover', { edge: null }) }
    }
    this.canvas.addEventListener('mousemove', this.hoverMoveHandler)
    this.canvas.addEventListener('mouseleave', this.hoverLeaveHandler)

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
        if (this.onBeforeConnect) {
          const allow = this.onBeforeConnect({ sourceId, targetId, sourceHandle, targetHandle })
          if (!allow) return
        }
        // Port connection limit check
        const edges = this.graph.getEdges()
        const srcNode = this.graph.getNode(sourceId)
        const tgtNode = this.graph.getNode(targetId)
        if (srcNode && sourceHandle) {
          const port = srcNode.ports?.find(p => p.id === sourceHandle)
          if (port?.maxConnections !== undefined) {
            const count = edges.filter(e => e.source === sourceId && e.sourceHandle === sourceHandle).length
            if (count >= port.maxConnections) return
          }
        }
        if (tgtNode && targetHandle) {
          const port = tgtNode.ports?.find(p => p.id === targetHandle)
          if (port?.maxConnections !== undefined) {
            const count = edges.filter(e => e.target === targetId && e.targetHandle === targetHandle).length
            if (count >= port.maxConnections) return
          }
        }
        this.emit('connect', { sourceId, targetId, sourceHandle, targetHandle })
        const src = this.graph.getNode(sourceId)
        const tgt = this.graph.getNode(targetId)
        if (src && tgt) this.announce(`Connected ${src.label || sourceId} to ${tgt.label || targetId}`)
      },
    )

    // Issue 3: onStart callback captures snapshot before any drag mutation
    this.drag = new NodeDrag(
      this.canvas, this.viewport, this.graph, this.hitTester,
      (id) => { this.beforeMutation(); this.emit('nodeDragStart', { id }) },
      (_id, _x, _y) => this.scheduleRender(),
      (id, x, y)    => this.emit('nodeDragEnd', { id, x, y }),
      (clientX, clientY) =>
        this.readOnly ||
        this.edgeWaypoint.isCapturing() ||
        this.edgeReroute.isCapturing() ||
        this.connectDrag.isCapturing() ||
        this.connectDrag.isNearHandle(clientX, clientY) ||
        this.nodeResize.isCapturing() ||
        this.nodeResize.isNearHandle(clientX, clientY),
      () => this.snapGridSize,
      (nodeId) => this.graph.getNodes().filter(n => n.parentId === nodeId).map(n => n.id),
      (nodeId) => [...this.selectedIds].filter(id => id !== nodeId),
    )

    this.panZoom = new PanZoom(
      this.canvas, this.viewport,
      () => { this.scheduleRender(); this.emit('viewportChange', this.viewport.getState()) },
      (sx, sy) => {
        if (this.edgeReroute.isCapturing()) return true
        if (this.connectDrag.isCapturing()) return true
        if (this.nodeResize.isCapturing()) return true
        const [wx, wy] = this.viewport.screenToWorld(sx, sy)
        return this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy) !== null
      },
    )

    this.edgeWaypoint = new EdgeWaypoint(
      this.canvas, this.viewport, this.graph,
      () => this.selectedEdgeIds,
      () => this.scheduleRender(),
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
        this.selectedIds = new Set(inBox.map(n => n.id))
        const edgesInBox = new Set<string>()
        for (const edge of this.graph.getEdges()) {
          if (this.selectedIds.has(edge.source) && this.selectedIds.has(edge.target)) {
            edgesInBox.add(edge.id)
          }
        }
        this.selectedEdgeIds = edgesInBox
        this.emit('selectionChange', {
          selectedIds: [...this.selectedIds],
          edgeIds: [...this.selectedEdgeIds],
        })
        this.scheduleRender()
      },
    })

    // Issue 6: LabelEditor — canvas refocused after edit
    this.canvasDblClick = (e: MouseEvent) => {
      const r = this.canvas.getBoundingClientRect()
      const [wx, wy] = this.viewport.screenToWorld(e.clientX - r.left, e.clientY - r.top)
      const node = this.hitTester.findNodeAt(this.graph.getNodes(), wx, wy)
      if (node) {
        this.emit('nodeDoubleClick', { node })
        if (this.readOnly) return
        if (node.type === 'group') {
          this.toggleCollapse(node.id)
          this.announce(node.collapsed ? `Expanded ${node.label || node.id}` : `Collapsed ${node.label || node.id}`)
          return
        }
        if (!this.labelEditable) return
        this.labelEditor.startEdit(node, this.canvas, this.viewport, (newLabel) => {
          this.beforeMutation()
          this.graph.updateNode(node.id, { label: newLabel })
          this.scheduleRender()
        })
        return
      }
      // No node hit — check edge for label editing
      const nodes = this.graph.getNodes()
      const nodeMap = new Map(nodes.map(n => [n.id, n]))
      const edge = this.edgeHitTester.findEdgeAt(this.graph.getEdges(), nodeMap, wx, wy, this.viewport.zoom)
      if (edge) {
        this.emit('edgeDoubleClick', { edge })
        if (!this.readOnly && this.labelEditable) this.startEdgeLabelEdit(edge, e.clientX, e.clientY)
      }
    }
    this.canvas.addEventListener('dblclick', this.canvasDblClick)

    this.canvasContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      if (this.readOnly) return
      const r = this.canvas.getBoundingClientRect()
      const [wx, wy] = this.viewport.screenToWorld(e.clientX - r.left, e.clientY - r.top)

      // Right-click on waypoint handle → remove it
      for (const edgeId of this.selectedEdgeIds) {
        if (this.edgeWaypoint.removeWaypointAt(edgeId, wx, wy)) return
      }

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
    }
    this.canvas.addEventListener('contextmenu', this.canvasContextMenu)

    // Issue 6 + 3: KeyboardHandler — canvas-scoped + undo/redo
    this.keyboardHandler = new KeyboardHandler(this.canvas, {
      onDelete:    () => { if (!this.readOnly) this.deleteSelected() },
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
      onUndo:     () => this.undo(),
      onRedo:     () => this.redo(),
      onTabNext:  () => this.tabSelectNode(1),
      onTabPrev:  () => this.tabSelectNode(-1),
      onArrowKey: (dir) => { if (!this.readOnly) this.moveSelectedByArrow(dir) },
      onCopy:             () => this.copySelection(),
      onCut:              () => { if (!this.readOnly) { this.copySelection(); this.deleteSelected() } },
      onPaste:            () => { if (!this.readOnly) this.pasteClipboard() },
      onDuplicate:        () => { if (!this.readOnly) this.duplicateSelected() },
      onFitView:          () => this.fitView(),
      onFitViewSelection: () => this.fitViewToSelection(),
    })

    // Issue 2: Focus canvas on click so keyboard events are received
    this.canvasMouseDown = () => { this.canvas.focus() }
    this.canvas.addEventListener('mousedown', this.canvasMouseDown)

    this.canvasClick = (e: MouseEvent) => {
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
        this.announceNode(node)
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
        this.emit('edgeClick', { edge })
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
    }
    this.canvas.addEventListener('click', this.canvasClick)

    this.resizeObserver = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      this.pendingResize = { w: rect.width, h: rect.height }
      this.scheduleRender()
    })
    this.resizeObserver.observe(options.container)

    if (options.minimap) {
      this.minimap = new Minimap(
        options.container,
        options.minimap,
        (wx, wy) => {
          this.viewport.x = this.viewport.canvasWidth  / 2 - wx * this.viewport.zoom
          this.viewport.y = this.viewport.canvasHeight / 2 - wy * this.viewport.zoom
          this.scheduleRender()
          this.emit('viewportChange', this.viewport.getState())
        },
      )
    }

    // Apply initial readOnly state to interaction subsystems
    if (this.readOnly) this.applyReadOnly(true)

    this.scheduleRender()
  }

  // ── ReadOnly API ──────────────────────────────────────────────────────────────

  /** Toggle read-only mode at runtime. When true, all editing is disabled. */
  setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly
    this.applyReadOnly(readOnly)
  }

  private applyReadOnly(readOnly: boolean): void {
    this.connectDrag.setDisabled(readOnly)
    this.edgeReroute.setDisabled(readOnly)
    this.nodeResize.setDisabled(readOnly)
  }

  // ── Undo / Redo ───────────────────────────────────────────────────────────────

  /** Capture current graph state for undo. Called before any mutation. */
  private beforeMutation(): void {
    if (this.batching) {
      if (this.batchMutSaved) return
      this.batchMutSaved = true
    }
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
    this.emit('historyChange', { canUndo: this.history.canUndo(), canRedo: this.history.canRedo() })
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
    const current = {
      nodes: this.graph.getNodes().map(n => { const { style, ...rest } = n; return style ? { ...rest, style: { ...style } } : rest }),
      edges: this.graph.getEdges().map(e => { const { style, ...rest } = e; return style ? { ...rest, style: { ...style } } : rest }),
    }
    const prev = this.history.undo(current)
    if (!prev) return false
    this.applySnapshot(prev)
    this.emit('historyChange', { canUndo: this.history.canUndo(), canRedo: this.history.canRedo() })
    return true
  }

  /** Redo a previously undone action. Returns true if successful. */
  redo(): boolean {
    const current = {
      nodes: this.graph.getNodes().map(n => { const { style, ...rest } = n; return style ? { ...rest, style: { ...style } } : rest }),
      edges: this.graph.getEdges().map(e => { const { style, ...rest } = e; return style ? { ...rest, style: { ...style } } : rest }),
    }
    const next = this.history.redo(current)
    if (!next) return false
    this.applySnapshot(next)
    this.emit('historyChange', { canUndo: this.history.canUndo(), canRedo: this.history.canRedo() })
    return true
  }

  canUndo(): boolean { return this.history.canUndo() }
  canRedo(): boolean { return this.history.canRedo() }

  /** Clear the undo/redo history stack. */
  clearHistory(): void {
    this.history.clear()
    this.emit('historyChange', { canUndo: false, canRedo: false })
  }

  /**
   * Run `fn` as a single atomic operation: one history entry and one render
   * regardless of how many mutations `fn` performs.
   */
  batchUpdate(fn: () => void): void {
    this.batching      = true
    this.batchMutSaved = false
    try {
      fn()
    } finally {
      this.batching      = false
      this.batchMutSaved = false
      this.scheduleRender()
    }
  }

  // ── Serialization ─────────────────────────────────────────────────────────────

  /**
   * Export the current canvas as a PNG data URL.
   * @param scale  Output pixel ratio (default: devicePixelRatio or 2 for retina quality).
   * Returns null if the renderer is not initialized.
   */
  exportPNG(scale?: number): string | null {
    if (this.failed) return null
    // Force a synchronous render into the canvas before reading pixels
    try {
      this.renderer.render(
        this.graph, this.viewport,
        this.selectedIds, this.connectState,
        this.selectedEdgeIds,
        this.bgColor,
        this.gridConfig.visible ? this.gridConfig : null,
        this.rerouteState,
        this.edgeReroute.getEndpointCircles(),
        this.edgeDashOffset,
      )
    } catch { return null }
    const ratio = scale ?? this.canvas.width / this.canvas.offsetWidth
    if (ratio === 1) return this.canvas.toDataURL('image/png')
    // Upscale to requested ratio via offscreen canvas
    const offscreen = document.createElement('canvas')
    offscreen.width  = Math.round(this.canvas.offsetWidth  * ratio)
    offscreen.height = Math.round(this.canvas.offsetHeight * ratio)
    const ctx = offscreen.getContext('2d')
    if (!ctx) return this.canvas.toDataURL('image/png')
    ctx.drawImage(this.canvas, 0, 0, offscreen.width, offscreen.height)
    return offscreen.toDataURL('image/png')
  }

  exportSVG(padding = 40): string {
    const nodes = this.graph.getNodes()
    const edges = this.graph.getEdges()
    if (nodes.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg"></svg>'

    const nodeMap = new Map(nodes.map(n => [n.id, n]))

    // Compute bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + n.width); maxY = Math.max(maxY, n.y + n.height)
    }
    const vx = minX - padding, vy = minY - padding
    const vw = (maxX - minX) + padding * 2, vh = (maxY - minY) + padding * 2

    const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">`]
    parts.push('<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#555"/></marker></defs>')

    // Draw group nodes first (behind others)
    const sorted = [...nodes].sort((a, b) => (a.type === 'group' ? -1 : 1) - (b.type === 'group' ? -1 : 1))

    for (const n of sorted) {
      const s = { backgroundColor: '#fff', borderColor: '#1a73e8', borderWidth: 2, borderRadius: 8, textColor: '#1a1a1a', fontSize: 14, ...n.style }
      const cx = n.x + n.width / 2, cy = n.y + n.height / 2
      const shape = s.shape ?? 'rectangle'
      if (shape === 'circle') {
        const r = Math.min(n.width, n.height) / 2
        parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${n.width/2}" ry="${n.height/2}" fill="${s.backgroundColor}" stroke="${s.borderColor}" stroke-width="${s.borderWidth}"/>`)
      } else if (shape === 'diamond') {
        const pts = `${cx},${n.y} ${n.x+n.width},${cy} ${cx},${n.y+n.height} ${n.x},${cy}`
        parts.push(`<polygon points="${pts}" fill="${s.backgroundColor}" stroke="${s.borderColor}" stroke-width="${s.borderWidth}"/>`)
      } else {
        parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${s.borderRadius}" fill="${s.backgroundColor}" stroke="${s.borderColor}" stroke-width="${s.borderWidth}"/>`)
      }
      if (n.label) {
        parts.push(`<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="${s.textColor}" font-size="${s.fontSize}" font-family="system-ui,sans-serif">${this.svgEscape(n.label)}</text>`)
      }
    }

    // Draw edges
    for (const edge of edges) {
      const src = nodeMap.get(edge.source); const tgt = nodeMap.get(edge.target)
      if (!src || !tgt) continue
      const [sx, sy] = handleXY(src, edge.sourceHandle)
      const [ex, ey] = handleXY(tgt, edge.targetHandle)
      const st = { color: '#555555', width: 2, ...edge.style }
      let d: string
      if (edge.waypoints && edge.waypoints.length > 0) {
        const pts = [[sx, sy], ...edge.waypoints.map(w => [w.x, w.y]), [ex, ey]]
        d = `M${pts.map(p => `${p[0]},${p[1]}`).join(' L')}`
      } else if (edge.type === 'straight') {
        d = `M${sx},${sy} L${ex},${ey}`
      } else {
        const [c1x, c1y, c2x, c2y] = edgeControlPoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle)
        d = `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${ex},${ey}`
      }
      const dash = st.dashArray ? `stroke-dasharray="${st.dashArray.join(' ')}"` : ''
      parts.push(`<path d="${d}" fill="none" stroke="${st.color}" stroke-width="${st.width}" marker-end="url(#arrow)" ${dash}/>`)
      if (edge.label) {
        const mx = (sx + ex) / 2, my = (sy + ey) / 2
        parts.push(`<rect x="${mx-24}" y="${my-9}" width="48" height="18" rx="3" fill="rgba(255,255,255,0.92)"/>`)
        parts.push(`<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-family="system-ui,sans-serif" fill="#374151">${this.svgEscape(edge.label)}</text>`)
      }
    }
    parts.push('</svg>')
    return parts.join('\n')
  }

  private svgEscape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

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

  /**
   * Import nodes and edges.
   * `'replace'` (default) clears the chart first (same as `fromJSON`).
   * `'merge'` adds to the existing graph without clearing.
   */
  importJSON(
    data: { nodes: NodeData[]; edges: EdgeData[]; viewport?: ViewportState },
    mode: 'replace' | 'merge' = 'replace',
  ): void {
    if (mode === 'replace') { this.fromJSON(data); return }
    this.beforeMutation()
    for (const n of data.nodes) this.graph.addNode(n)
    for (const e of data.edges) this.graph.addEdge(e)
    this.scheduleRender()
  }

  // ── Graph analysis ───────────────────────────────────────────────────────────

  getIncomers(nodeId: string): NodeData[] {
    const result: NodeData[] = []
    for (const edge of this.graph.getEdgesForNode(nodeId)) {
      if (edge.target === nodeId) {
        const node = this.graph.getNode(edge.source)
        if (node) result.push(node)
      }
    }
    return result
  }

  getOutgoers(nodeId: string): NodeData[] {
    const result: NodeData[] = []
    for (const edge of this.graph.getEdgesForNode(nodeId)) {
      if (edge.source === nodeId) {
        const node = this.graph.getNode(edge.target)
        if (node) result.push(node)
      }
    }
    return result
  }

  getConnectedNodes(nodeId: string): NodeData[] {
    const seen = new Set<string>()
    const result: NodeData[] = []
    for (const edge of this.graph.getEdgesForNode(nodeId)) {
      const otherId = edge.source === nodeId ? edge.target : edge.source
      if (!seen.has(otherId)) {
        seen.add(otherId)
        const node = this.graph.getNode(otherId)
        if (node) result.push(node)
      }
    }
    return result
  }

  hasCycle(): boolean {
    const nodes = this.graph.getNodes()
    const adj = new Map<string, string[]>()
    for (const n of nodes) adj.set(n.id, [])
    for (const e of this.graph.getEdges()) adj.get(e.source)?.push(e.target)

    const WHITE = 0, GREY = 1, BLACK = 2
    const color = new Map<string, number>()
    for (const n of nodes) color.set(n.id, WHITE)

    const dfs = (id: string): boolean => {
      color.set(id, GREY)
      for (const neighbor of adj.get(id) ?? []) {
        const c = color.get(neighbor) ?? WHITE
        if (c === GREY) return true
        if (c === WHITE && dfs(neighbor)) return true
      }
      color.set(id, BLACK)
      return false
    }

    for (const n of nodes) {
      if ((color.get(n.id) ?? WHITE) === WHITE && dfs(n.id)) return true
    }
    return false
  }

  findPaths(sourceId: string, targetId: string): string[][] {
    if (sourceId === targetId) return []
    const adj = new Map<string, string[]>()
    for (const n of this.graph.getNodes()) adj.set(n.id, [])
    for (const e of this.graph.getEdges()) adj.get(e.source)?.push(e.target)

    const results: string[][] = []
    const visited = new Set<string>()

    const dfs = (current: string, path: string[]): void => {
      if (current === targetId) { results.push([...path]); return }
      if (results.length >= 100) return   // safety cap
      for (const neighbor of adj.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          path.push(neighbor)
          dfs(neighbor, path)
          path.pop()
          visited.delete(neighbor)
        }
      }
    }

    visited.add(sourceId)
    dfs(sourceId, [sourceId])
    return results
  }

  // ── Search / highlight ───────────────────────────────────────────────────────

  searchNodes(query: string): NodeData[] {
    if (!query.trim()) {
      this.highlightedNodeIds.clear()
      this.scheduleRender()
      return []
    }
    const q = query.toLowerCase()
    const matches = this.graph.getNodes().filter(n => n.label.toLowerCase().includes(q))
    this.setHighlightedNodes(matches.map(n => n.id))
    return matches
  }

  setHighlightedNodes(ids: string[]): void {
    this.highlightedNodeIds = new Set(ids)
    this.scheduleRender()
  }

  clearHighlights(): void {
    this.highlightedNodeIds.clear()
    this.scheduleRender()
  }

  private renderHighlights(): void {
    const { highlightOverlay, highlightCtx, viewport } = this
    const w = this.canvas.offsetWidth
    const h = this.canvas.offsetHeight
    if (highlightOverlay.width !== w || highlightOverlay.height !== h) {
      highlightOverlay.width  = w
      highlightOverlay.height = h
    }
    highlightCtx.clearRect(0, 0, w, h)
    if (this.highlightedNodeIds.size === 0) return

    highlightCtx.strokeStyle = '#facc15'
    highlightCtx.lineWidth   = 2.5
    highlightCtx.setLineDash([6, 3])

    for (const id of this.highlightedNodeIds) {
      const node = this.graph.getNode(id)
      if (!node) continue
      const [sx, sy] = viewport.worldToScreen(node.x, node.y)
      const sw = node.width  * viewport.zoom
      const sh = node.height * viewport.zoom
      highlightCtx.strokeRect(sx - 4, sy - 4, sw + 8, sh + 8)
    }
    highlightCtx.setLineDash([])
  }

  private static readonly STATUS_COLORS: Record<string, string> = {
    error:   '#ef4444',
    warning: '#f59e0b',
    success: '#22c55e',
    info:    '#3b82f6',
  }

  private renderStatusBadges(): void {
    const { statusOverlay, statusCtx, viewport } = this
    const w = this.canvas.offsetWidth
    const h = this.canvas.offsetHeight
    if (statusOverlay.width !== w || statusOverlay.height !== h) {
      statusOverlay.width  = w
      statusOverlay.height = h
    }
    statusCtx.clearRect(0, 0, w, h)
    const nodes = this.graph.getNodes()
    if (!nodes.some(n => n.status)) return

    const r = 7
    for (const node of nodes) {
      if (!node.status) continue
      const color = FlowChart.STATUS_COLORS[node.status]
      if (!color) continue
      const [sx, sy] = viewport.worldToScreen(node.x + node.width, node.y)
      statusCtx.beginPath()
      statusCtx.arc(sx, sy, r, 0, Math.PI * 2)
      statusCtx.fillStyle = color
      statusCtx.fill()
      statusCtx.strokeStyle = '#ffffff'
      statusCtx.lineWidth   = 2
      statusCtx.stroke()
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  /**
   * Animate nodes from their current positions to `targets` over `duration` ms.
   * Accepts the same shape as `hierarchicalLayout` / `forceLayout` result items.
   */
  animateLayout(
    targets: { id: string; x: number; y: number }[] | Map<string, { x: number; y: number }>,
    duration = 400,
  ): void {
    if (this.animRafId !== null) {
      cancelAnimationFrame(this.animRafId)
      this.animRafId = null
    }
    const entries: [string, { x: number; y: number }][] = targets instanceof Map
      ? [...targets.entries()]
      : targets.map(({ id, x, y }) => [id, { x, y }])
    const map = new Map<string, { fx: number; fy: number; tx: number; ty: number }>()
    for (const [id, { x, y }] of entries) {
      const node = this.graph.getNode(id)
      if (!node) continue
      map.set(id, { fx: node.x, fy: node.y, tx: x, ty: y })
    }
    if (map.size === 0) return
    this.layoutAnim = { targets: map, start: performance.now(), dur: duration }
    this.tickLayoutAnim()
  }

  private tickLayoutAnim(): void {
    if (!this.layoutAnim) return
    const { targets, start, dur } = this.layoutAnim
    const elapsed = performance.now() - start
    const raw = Math.min(elapsed / dur, 1)
    const t = raw * raw * (3 - 2 * raw)   // smoothstep

    for (const [id, { fx, fy, tx, ty }] of targets) {
      this.graph.updateNode(id, {
        x: fx + (tx - fx) * t,
        y: fy + (ty - fy) * t,
      })
    }
    this.scheduleRender()

    if (raw < 1) {
      this.animRafId = requestAnimationFrame(() => {
        this.animRafId = null
        this.tickLayoutAnim()
      })
    } else {
      this.layoutAnim = null
    }
  }

  private scheduleRender(): void {
    if (this.failed || this.batching || this.rafId !== null) return
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null
      if (this.pendingResize) {
        const { w, h } = this.pendingResize
        this.pendingResize = null
        this.viewport.setSize(w, h)
        this.renderer.resize(w, h)
      }
      try {
        // Merge explicitly-selected edges with edges connected to selected nodes.
        // Connected-node edges are highlighted for context but not added to the
        // user-visible selection (delete/copy don't act on them).
        let renderedEdgeIds = this.selectedEdgeIds
        if (this.selectedIds.size > 0) {
          const extra = new Set(this.selectedEdgeIds)
          for (const edge of this.graph.getEdges()) {
            if (this.selectedIds.has(edge.source) || this.selectedIds.has(edge.target)) {
              extra.add(edge.id)
            }
          }
          renderedEdgeIds = extra
        }
        this.renderer.render(
          this.graph, this.viewport,
          this.selectedIds, this.connectState,
          renderedEdgeIds,
          this.bgColor,
          this.gridConfig.visible ? this.gridConfig : null,
          this.rerouteState,
          this.edgeReroute.getEndpointCircles(),
          this.edgeDashOffset,
        )
        this.htmlOverlay.sync(this.graph.getNodes(), this.viewport)
        const selArr = [...this.selectedIds]
        this.nodeResize.setSelectedNode(selArr.length === 1 ? selArr[0]! : null)
        this.nodeResize.render()
        this.minimap?.render(this.graph.getNodes(), this.graph.getEdges(), this.viewport)
        this.renderHighlights()
        this.renderStatusBadges()
        this.renderWaypointHandles()

        // Keep animating when any edge has animated:true
        if (this.renderer.hasAnimatedEdges()) {
          this.edgeDashOffset = (this.edgeDashOffset + 1.5) % 10000
          this.scheduleRender()
        }
      } catch (err) {
        console.error('[FlowChart] render error:', err)
      }
    })
  }

  private startEdgeLabelEdit(edge: EdgeData, clientX: number, clientY: number): void {
    const input = document.createElement('input')
    input.type  = 'text'
    input.value = edge.label ?? ''
    input.placeholder = 'Edge label'
    input.style.cssText = `
      position: fixed;
      left: ${clientX}px; top: ${clientY}px;
      transform: translate(-50%, -50%);
      min-width: 80px; max-width: 200px;
      padding: 3px 8px; border: 2px solid #1a73e8; border-radius: 4px;
      background: #fff; color: #1a1a1a;
      font-size: ${13 * this.viewport.zoom}px;
      font-family: system-ui, sans-serif; text-align: center;
      outline: none; z-index: 8500; box-sizing: border-box;
    `
    let committed = false
    const commit = (): void => {
      if (committed) return
      committed = true
      const newLabel = input.value.trim()
      this.beforeMutation()
      if (newLabel) this.graph.updateEdge(edge.id, { label: newLabel })
      else this.graph.updateEdge(edge.id, { label: '' })
      this.scheduleRender()
      input.remove()
      this.canvas.focus()
    }
    input.addEventListener('keydown', (ev: KeyboardEvent) => {
      ev.stopPropagation()
      if (ev.key === 'Enter') commit()
      if (ev.key === 'Escape') { committed = true; input.remove(); this.canvas.focus() }
    })
    input.addEventListener('blur', commit)
    document.body.appendChild(input)
    requestAnimationFrame(() => { input.select() })
  }

  private renderWaypointHandles(): void {
    const handles = this.edgeWaypoint.getWaypointHandles()
    const r = this.canvas.getBoundingClientRect()
    const container = this.canvas.parentElement
    if (!container) return

    // Reuse existing DOM nodes, create/remove as needed
    const existing = Array.from(this.waypointOverlay.children) as HTMLElement[]
    let i = 0
    for (const h of handles) {
      const [sx, sy] = this.viewport.worldToScreen(h.wx, h.wy)
      let el = existing[i] as HTMLElement | undefined
      if (!el) {
        el = document.createElement('div')
        el.style.position = 'absolute'
        el.style.borderRadius = '50%'
        el.style.transform = 'translate(-50%,-50%)'
        el.style.pointerEvents = 'none'
        this.waypointOverlay.appendChild(el)
      }
      el.style.left   = `${sx}px`
      el.style.top    = `${sy}px`
      el.style.width  = h.isMid ? '8px' : '10px'
      el.style.height = h.isMid ? '8px' : '10px'
      el.style.background = h.isMid ? 'rgba(99,130,235,0.4)' : '#1a6ee8'
      el.style.border = h.isMid ? '1px dashed #6382eb' : '2px solid #fff'
      el.style.boxShadow = h.isMid ? 'none' : '0 1px 4px rgba(0,0,0,0.3)'
      i++
    }
    // Remove extra
    while (this.waypointOverlay.children.length > i) {
      this.waypointOverlay.removeChild(this.waypointOverlay.lastChild!)
    }
  }

  private announce(msg: string): void {
    this.ariaLive.textContent = ''
    // Force re-read by clearing then setting
    requestAnimationFrame(() => { this.ariaLive.textContent = msg })
  }

  private announceNode(node: { id: string; label: string }): void {
    const edges = this.graph.getEdges()
    const inCount  = edges.filter(e => e.target === node.id).length
    const outCount = edges.filter(e => e.source === node.id).length
    const parts = [`Selected: ${node.label || node.id}`]
    if (inCount > 0)  parts.push(`${inCount} incoming`)
    if (outCount > 0) parts.push(`${outCount} outgoing`)
    this.announce(parts.join(', '))
  }

  private tabSelectNode(direction: 1 | -1): void {
    const nodes = this.graph.getNodes()
    if (nodes.length === 0) return
    const currentId = this.selectedIds.size === 1 ? [...this.selectedIds][0]! : null
    const currentIdx = currentId ? nodes.findIndex(n => n.id === currentId) : -1
    const nextIdx = ((currentIdx + direction) + nodes.length) % nodes.length
    const next = nodes[nextIdx]
    if (!next) return
    this.selectedIds.clear()
    this.selectedIds.add(next.id)
    this.selectedEdgeIds.clear()
    this.emit('selectionChange', { selectedIds: [next.id], edgeIds: [] })
    this.announceNode(next)
    this.scheduleRender()
  }

  private moveSelectedByArrow(direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): void {
    if (this.selectedIds.size === 0) return
    const STEP = 10
    const dx = direction === 'ArrowLeft' ? -STEP : direction === 'ArrowRight' ? STEP : 0
    const dy = direction === 'ArrowUp'   ? -STEP : direction === 'ArrowDown'  ? STEP : 0
    // Save history only on first keydown in a burst — subsequent rapid presses are coalesced
    if (this.arrowMoveTimer === null) {
      this.beforeMutation()
    } else {
      clearTimeout(this.arrowMoveTimer)
    }
    this.arrowMoveTimer = setTimeout(() => {
      this.arrowMoveTimer = null
      // Announce final position after arrow-key move stops
      if (this.selectedIds.size === 1) {
        const n = this.graph.getNode([...this.selectedIds][0]!)
        if (n) this.announce(`${n.label || n.id} at ${Math.round(n.x)}, ${Math.round(n.y)}`)
      }
    }, 400)
    for (const id of this.selectedIds) {
      const node = this.graph.getNode(id)
      if (node) this.graph.updateNode(id, { x: node.x + dx, y: node.y + dy })
    }
    this.scheduleRender()
  }

  deleteSelected(): void {
    const nodeIds = [...this.selectedIds].filter(id => {
      const n = this.graph.getNode(id); return !!n && !n.locked
    })
    const edgeIds = [...this.selectedEdgeIds]
    if (this.onBeforeDelete && !this.onBeforeDelete(nodeIds, edgeIds)) return
    this.beforeMutation()
    const edgeCount = this.selectedEdgeIds.size
    for (const id of this.selectedEdgeIds) this.graph.removeEdge(id)
    this.selectedEdgeIds.clear()
    let nodeCount = 0
    for (const id of this.selectedIds) {
      const n = this.graph.getNode(id)
      if (n && !n.locked) { this.graph.removeNode(id); nodeCount++ }
    }
    // Keep locked nodes in selection so user can see what couldn't be deleted
    this.selectedIds = new Set([...this.selectedIds].filter(id => this.graph.getNode(id) !== undefined))
    this.selectedIds.clear()
    this.emit('selectionChange', { selectedIds: [], edgeIds: [] })
    const parts: string[] = []
    if (nodeCount > 0) parts.push(`${nodeCount} node${nodeCount > 1 ? 's' : ''}`)
    if (edgeCount > 0) parts.push(`${edgeCount} edge${edgeCount > 1 ? 's' : ''}`)
    if (parts.length > 0) this.announce(`Deleted ${parts.join(' and ')}`)
    this.scheduleRender()
  }

  private copySelection(): void {
    if (this.selectedIds.size === 0) return
    const nodes = [...this.selectedIds]
      .map(id => this.graph.getNode(id))
      .filter(Boolean) as NodeData[]
    const nodeSet = new Set(this.selectedIds)
    const edges = this.graph.getEdges().filter(
      e => nodeSet.has(e.source) && nodeSet.has(e.target),
    )
    this.clipboard = {
      nodes: nodes.map(n => ({ ...n, ...(n.style ? { style: { ...n.style } } : {}) })),
      edges: edges.map(e => ({ ...e, ...(e.style ? { style: { ...e.style } } : {}) })),
    }
  }

  duplicateSelected(): void {
    if (this.selectedIds.size === 0) return
    this.beforeMutation()
    const idMap = new Map<string, string>()
    const OFFSET = 24
    const newNodeIds: string[] = []
    const nodeSet = new Set(this.selectedIds)

    for (const id of this.selectedIds) {
      const node = this.graph.getNode(id)
      if (!node) continue
      const newId = generateId()
      idMap.set(id, newId)
      this.graph.addNode({ ...node, id: newId, x: node.x + OFFSET, y: node.y + OFFSET })
      newNodeIds.push(newId)
    }
    const newEdgeIds: string[] = []
    for (const edge of this.graph.getEdges()) {
      if (!nodeSet.has(edge.source) || !nodeSet.has(edge.target)) continue
      const src = idMap.get(edge.source)
      const tgt = idMap.get(edge.target)
      if (!src || !tgt) continue
      const newId = generateId('e')
      this.graph.addEdge({ ...edge, id: newId, source: src, target: tgt })
      newEdgeIds.push(newId)
    }
    this.selectedIds     = new Set(newNodeIds)
    this.selectedEdgeIds = new Set(newEdgeIds)
    this.emit('selectionChange', { selectedIds: newNodeIds, edgeIds: newEdgeIds })
    this.scheduleRender()
  }

  private pasteClipboard(): void {
    if (!this.clipboard) return
    this.beforeMutation()
    const idMap = new Map<string, string>()
    const OFFSET = 20
    this.selectedIds.clear()
    this.selectedEdgeIds.clear()
    for (const node of this.clipboard.nodes) {
      const newId = generateId()
      idMap.set(node.id, newId)
      this.graph.addNode({ ...node, id: newId, x: node.x + OFFSET, y: node.y + OFFSET })
      this.selectedIds.add(newId)
    }
    for (const edge of this.clipboard.edges) {
      const newId = generateId('e')
      const src = idMap.get(edge.source)
      const tgt = idMap.get(edge.target)
      if (!src || !tgt) continue
      this.graph.addEdge({ ...edge, id: newId, source: src, target: tgt })
    }
    this.emit('selectionChange', { selectedIds: [...this.selectedIds], edgeIds: [] })
    this.scheduleRender()
  }

  // ── Node style API ────────────────────────────────────────────────────────────

  setNodeStyle(id: string, style: Partial<NodeStyle>): void {
    const node = this.graph.getNode(id)
    if (!node) return
    this.beforeMutation()
    this.graph.updateNode(id, { style: { ...node.style, ...style } })
    this.scheduleRender()
  }

  setNodeBorderColor(id: string, color: string): void { this.setNodeStyle(id, { borderColor: color }) }
  setNodeBackgroundColor(id: string, color: string): void { this.setNodeStyle(id, { backgroundColor: color }) }
  setNodeShape(id: string, shape: NodeShape): void { this.setNodeStyle(id, { shape }) }

  setEdgeStyle(id: string, style: Partial<EdgeStyle>): void {
    const edge = this.graph.getEdge(id)
    if (!edge) return
    this.updateEdge(id, { style: { ...edge.style, ...style } })
  }

  lockNode(id: string): void {
    if (!this.graph.getNode(id)) return
    this.beforeMutation()
    this.graph.updateNode(id, { locked: true })
    this.scheduleRender()
  }

  unlockNode(id: string): void {
    if (!this.graph.getNode(id)) return
    this.beforeMutation()
    this.graph.updateNode(id, { locked: false })
    this.scheduleRender()
  }

  setNodeSize(id: string, width: number, height: number): void {
    if (!this.graph.getNode(id)) return
    this.beforeMutation()
    this.graph.updateNode(id, { width, height })
    this.scheduleRender()
  }

  // ── Alignment & distribution API ─────────────────────────────────────────────

  alignNodes(axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void {
    if (this.selectedIds.size < 2) return
    const nodes = [...this.selectedIds].map(id => this.graph.getNode(id)).filter(Boolean) as NodeData[]
    this.beforeMutation()
    switch (axis) {
      case 'left': {
        const min = Math.min(...nodes.map(n => n.x))
        for (const n of nodes) this.graph.updateNode(n.id, { x: min })
        break
      }
      case 'right': {
        const max = Math.max(...nodes.map(n => n.x + n.width))
        for (const n of nodes) this.graph.updateNode(n.id, { x: max - n.width })
        break
      }
      case 'center': {
        const mid = nodes.reduce((s, n) => s + n.x + n.width / 2, 0) / nodes.length
        for (const n of nodes) this.graph.updateNode(n.id, { x: mid - n.width / 2 })
        break
      }
      case 'top': {
        const min = Math.min(...nodes.map(n => n.y))
        for (const n of nodes) this.graph.updateNode(n.id, { y: min })
        break
      }
      case 'bottom': {
        const max = Math.max(...nodes.map(n => n.y + n.height))
        for (const n of nodes) this.graph.updateNode(n.id, { y: max - n.height })
        break
      }
      case 'middle': {
        const mid = nodes.reduce((s, n) => s + n.y + n.height / 2, 0) / nodes.length
        for (const n of nodes) this.graph.updateNode(n.id, { y: mid - n.height / 2 })
        break
      }
    }
    this.scheduleRender()
  }

  distributeNodes(axis: 'horizontal' | 'vertical'): void {
    if (this.selectedIds.size < 3) return
    const nodes = [...this.selectedIds].map(id => this.graph.getNode(id)).filter(Boolean) as NodeData[]
    this.beforeMutation()
    if (axis === 'horizontal') {
      const sorted = [...nodes].sort((a, b) => a.x - b.x)
      const first = sorted[0]!
      const last  = sorted[sorted.length - 1]!
      const totalSpan = (last.x + last.width) - first.x
      const totalNodeWidth = sorted.reduce((s, n) => s + n.width, 0)
      const gap = (totalSpan - totalNodeWidth) / (sorted.length - 1)
      let cursor = first.x + first.width
      for (let i = 1; i < sorted.length - 1; i++) {
        cursor += gap
        this.graph.updateNode(sorted[i]!.id, { x: cursor })
        cursor += sorted[i]!.width
      }
    } else {
      const sorted = [...nodes].sort((a, b) => a.y - b.y)
      const first = sorted[0]!
      const last  = sorted[sorted.length - 1]!
      const totalSpan = (last.y + last.height) - first.y
      const totalNodeHeight = sorted.reduce((s, n) => s + n.height, 0)
      const gap = (totalSpan - totalNodeHeight) / (sorted.length - 1)
      let cursor = first.y + first.height
      for (let i = 1; i < sorted.length - 1; i++) {
        cursor += gap
        this.graph.updateNode(sorted[i]!.id, { y: cursor })
        cursor += sorted[i]!.height
      }
    }
    this.scheduleRender()
  }

  // ── Group / container API ─────────────────────────────────────────────────────

  collapseNode(id: string): void {
    const node = this.graph.getNode(id)
    if (!node || node.type !== 'group') return
    this.beforeMutation()
    this.graph.updateNode(id, { collapsed: true })
    this.scheduleRender()
  }

  expandNode(id: string): void {
    const node = this.graph.getNode(id)
    if (!node || node.type !== 'group') return
    this.beforeMutation()
    this.graph.updateNode(id, { collapsed: false })
    this.scheduleRender()
  }

  toggleCollapse(id: string): void {
    const node = this.graph.getNode(id)
    if (!node || node.type !== 'group') return
    if (node.collapsed) this.expandNode(id)
    else this.collapseNode(id)
  }

  groupNodes(parentId: string, childIds: string[]): void {
    if (childIds.length === 0) return
    this.beforeMutation()
    for (const id of childIds) {
      const node = this.graph.getNode(id)
      if (node) this.graph.updateNode(id, { parentId })
    }
    this.scheduleRender()
  }

  ungroupNodes(childIds: string[]): void {
    if (childIds.length === 0) return
    this.beforeMutation()
    for (const id of childIds) {
      const node = this.graph.getNode(id)
      if (!node) continue
      const { parentId: _removed, ...rest } = node
      this.graph.replaceNode(rest as NodeData)
    }
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

  setSnapGrid(size: number): void {
    this.snapGridSize = Math.max(0, size)
  }

  // ── Selection API ─────────────────────────────────────────────────────────────

  setLabelEditable(enabled: boolean): void { this.labelEditable = enabled }

  getSelectedIds(): string[] { return [...this.selectedIds] }
  getSelectedEdgeIds(): string[] { return [...this.selectedEdgeIds] }

  setSelectedIds(ids: string[]): void {
    this.selectedIds = new Set(ids)
    this.scheduleRender()
  }

  setSelectedEdgeIds(ids: string[]): void {
    this.selectedEdgeIds = new Set(ids)
    this.scheduleRender()
  }

  selectAll(): void {
    this.selectedIds     = new Set(this.graph.getNodes().map(n => n.id))
    this.selectedEdgeIds = new Set(this.graph.getEdges().map(e => e.id))
    this.emit('selectionChange', {
      selectedIds: [...this.selectedIds],
      edgeIds:     [...this.selectedEdgeIds],
    })
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
    this.emit('nodeAdd', { node })
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
    this.emit('nodeRemove', { id })
    this.scheduleRender()
  }

  updateNode(id: string, updates: Partial<Omit<NodeData, 'id'>>): void {
    if (!this.graph.getNode(id)) return
    this.beforeMutation()
    this.graph.updateNode(id, updates)
    this.emit('nodeUpdate', { id, updates })
    this.scheduleRender()
  }

  addEdge(edge: EdgeData): void {
    this.beforeMutation()
    this.graph.addEdge(edge)
    this.emit('edgeAdd', { edge })
    this.scheduleRender()
  }

  removeEdge(id: string): void {
    this.beforeMutation()
    this.graph.removeEdge(id)
    this.selectedEdgeIds.delete(id)
    this.emit('edgeRemove', { id })
    this.scheduleRender()
  }

  updateEdge(id: string, updates: Partial<Omit<EdgeData, 'id'>>): void {
    if (!this.graph.getEdge(id)) return
    this.beforeMutation()
    this.graph.updateEdge(id, updates)
    this.emit('edgeUpdate', { id, updates })
    this.scheduleRender()
  }

  /** Reverse the source and target of an edge. Records an undo entry. */
  swapEdgeDirection(id: string): void {
    const edge = this.graph.getEdge(id)
    if (!edge) return
    this.beforeMutation()
    const updates = { source: edge.target, target: edge.source }
    this.graph.updateEdge(id, updates)
    this.emit('edgeUpdate', { id, updates })
    this.scheduleRender()
  }

  /** Override the onBeforeDelete callback at runtime. Pass null to remove it. */
  setOnBeforeDelete(fn: ((nodeIds: string[], edgeIds: string[]) => boolean) | null): void {
    this.onBeforeDelete = fn ?? undefined
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
    this.beforeMutation()
    for (const e of this.graph.getEdges()) this.graph.removeEdge(e.id)
    this.selectedEdgeIds.clear()
    for (const e of edges) this.graph.addEdge(e)
    this.scheduleRender()
  }

  // ── Graph query API ───────────────────────────────────────────────────────────

  getNode(id: string): NodeData | undefined  { return this.graph.getNode(id) }
  getEdge(id: string): EdgeData | undefined  { return this.graph.getEdge(id) }
  getNodes(): NodeData[] { return this.graph.getNodes() }
  getEdges(): EdgeData[] { return this.graph.getEdges() }

  getEdgesForNode(nodeId: string): EdgeData[] {
    return this.graph.getEdgesForNode(nodeId)
  }

  /** Return all edges that connect sourceId and targetId (in either direction). */
  getEdgesBetween(sourceId: string, targetId: string): EdgeData[] {
    return this.graph.getEdges().filter(
      e => (e.source === sourceId && e.target === targetId)
        || (e.source === targetId && e.target === sourceId),
    )
  }

  /** Return full NodeData objects for every currently selected node. */
  getSelectedNodes(): NodeData[] {
    return [...this.selectedIds].map(id => this.graph.getNode(id)).filter(Boolean) as NodeData[]
  }

  /** Return full EdgeData objects for every currently selected edge. */
  getSelectedEdges(): EdgeData[] {
    return [...this.selectedEdgeIds].map(id => this.graph.getEdge(id)).filter(Boolean) as EdgeData[]
  }

  /** Set or clear the status badge on a node. Pass null to remove the badge. */
  setNodeStatus(id: string, status: NodeStatus | null): void {
    const node = this.graph.getNode(id)
    if (!node) return
    if (status === null) {
      const { status: _removed, ...rest } = node
      this.graph.replaceNode(rest as NodeData)
    } else {
      this.graph.updateNode(id, { status })
    }
    this.scheduleRender()
  }

  /** Pan viewport so the given node is centered in the canvas. */
  scrollToNode(id: string, padding = 60): void {
    const node = this.graph.getNode(id)
    if (!node) return
    this.viewport.fit(computeNodeBounds([node]), padding)
    this.scheduleRender()
  }

  /** Apply a built-in light or dark theme preset. */
  setTheme(theme: 'light' | 'dark'): void {
    if (theme === 'dark') {
      this.setBackground('#1a1a2e')
      this.setGrid({ ...this.gridConfig, color: 'rgba(255,255,255,0.06)' })
    } else {
      this.setBackground('#f7f7f7')
      this.setGrid({ ...this.gridConfig, color: 'rgba(0,0,0,0.15)' })
    }
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

  fitViewToSelection(padding = 40): void {
    if (this.selectedIds.size === 0) { this.fitView(padding); return }
    const nodes = this.graph.getNodes().filter(n => this.selectedIds.has(n.id))
    if (nodes.length === 0) return
    this.viewport.fit(computeNodeBounds(nodes), padding)
    this.scheduleRender()
  }

  /** Center the viewport on the given world coordinates. */
  panTo(worldX: number, worldY: number): void {
    this.viewport.x = this.viewport.canvasWidth  / 2 - worldX * this.viewport.zoom
    this.viewport.y = this.viewport.canvasHeight / 2 - worldY * this.viewport.zoom
    this.scheduleRender()
    this.emit('viewportChange', this.viewport.getState())
  }

  /** Return the AABB of the given nodes, or all nodes when no ids are provided. Returns null when there are no nodes. */
  getNodesBounds(ids?: string[]): AABB | null {
    const nodes = ids
      ? ids.map(id => this.graph.getNode(id)).filter(Boolean) as NodeData[]
      : this.graph.getNodes()
    if (nodes.length === 0) return null
    return computeNodeBounds(nodes)
  }

  private static readonly ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

  zoomIn(): void {
    const cur  = this.viewport.zoom
    const next = FlowChart.ZOOM_STEPS.find(s => s > cur + 0.001)
              ?? FlowChart.ZOOM_STEPS[FlowChart.ZOOM_STEPS.length - 1]!
    this.zoomTo(next)
  }

  zoomOut(): void {
    const cur  = this.viewport.zoom
    const prev = [...FlowChart.ZOOM_STEPS].reverse().find(s => s < cur - 0.001)
              ?? FlowChart.ZOOM_STEPS[0]!
    this.zoomTo(prev)
  }

  zoomTo(factor: number): void {
    const cx = this.viewport.canvasWidth  / 2
    const cy = this.viewport.canvasHeight / 2
    this.viewport.zoomAt(cx, cy, factor / this.viewport.zoom)
    this.scheduleRender()
    this.emit('viewportChange', this.viewport.getState())
  }

  /** Request a render on the next animation frame. Useful for continuous rendering in benchmarks. */
  requestRender(): void { this.scheduleRender() }

  // ── Minimap API ───────────────────────────────────────────────────────────────

  /** Enable the minimap (or reconfigure it). Pass null to disable. */
  setMinimap(config: Partial<MinimapConfig> | null): void {
    if (config === null) {
      this.minimap?.dispose()
      this.minimap = null
      return
    }
    if (this.minimap) {
      this.minimap.setConfig(config)
    } else {
      const container = this.canvas.parentElement
      if (!container) return
      this.minimap = new Minimap(container, config, (wx, wy) => {
        this.viewport.x = this.viewport.canvasWidth  / 2 - wx * this.viewport.zoom
        this.viewport.y = this.viewport.canvasHeight / 2 - wy * this.viewport.zoom
        this.scheduleRender()
        this.emit('viewportChange', this.viewport.getState())
      })
    }
    this.scheduleRender()
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    if (this.animRafId !== null) cancelAnimationFrame(this.animRafId)
    if (this.arrowMoveTimer !== null) clearTimeout(this.arrowMoveTimer)
    if (!this.failed) {
      this.panZoom.dispose()
      this.drag.dispose()
      this.connectDrag.dispose()
      this.edgeReroute.dispose()
      this.edgeWaypoint.dispose()
      this.boxSelect.dispose()
      this.keyboardHandler.dispose()
      this.nodeResize.dispose()
      this.renderer.dispose()
    }
    this.resizeObserver?.disconnect()
    this.panels?.dispose()
    this.htmlOverlay?.dispose()
    this.minimap?.dispose()
    this.labelEditor?.dispose()
    this.contextMenu?.dispose()
    if (this.hoverMoveHandler)  this.canvas?.removeEventListener('mousemove',    this.hoverMoveHandler)
    if (this.hoverLeaveHandler) this.canvas?.removeEventListener('mouseleave',   this.hoverLeaveHandler)
    if (this.canvasDblClick)      this.canvas?.removeEventListener('dblclick',     this.canvasDblClick)
    if (this.canvasContextMenu)   this.canvas?.removeEventListener('contextmenu',  this.canvasContextMenu)
    if (this.canvasMouseDown)     this.canvas?.removeEventListener('mousedown',    this.canvasMouseDown)
    if (this.canvasClick)         this.canvas?.removeEventListener('click',        this.canvasClick)
    this.tooltipEl?.remove()
    this.ariaLive?.remove()
    this.ariaDesc?.remove()
    this.highlightOverlay?.remove()
    this.statusOverlay?.remove()
    this.canvas?.remove()
    super.dispose()
  }
}
