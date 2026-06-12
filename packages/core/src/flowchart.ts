import { EventEmitter } from './events/emitter'
import { Graph } from './graph/graph'
import { Viewport } from './viewport/viewport'
import { WebGL2Renderer } from './renderer/webgl/index'
import { Canvas2DRenderer } from './renderer/canvas2d/index'
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
import { PanelOverlay, type PanelOptions } from './ui/panel-overlay'
import { Controls, type ControlsOptions } from './ui/controls'
import { NodeToolbarLayer, type NodeToolbarSpec } from './ui/node-toolbar'
import { PerfOverlay, type PerfOverlayOptions } from './ui/perf-overlay'
import { ViewportPortalLayer, type ViewportPortalSpec } from './ui/viewport-portal'
import { EdgeLabelOverlay, type EdgeLabelSpec } from './ui/edge-label-overlay'
import { EdgeToolbarLayer, type EdgeToolbarSpec } from './ui/edge-toolbar'
import { Minimap } from './ui/minimap'
import { HtmlOverlay } from './ui/html-overlay'
import { computeNodeBounds } from './renderer/webgl/cull'
import { exportGraphAsSvg } from './services/svg-export'
import { validateChartJson } from './services/json-validate'
import { getIncomers as analysisGetIncomers, getOutgoers as analysisGetOutgoers, getConnectedNodes as analysisGetConnectedNodes, hasCycle as analysisHasCycle, findPaths as analysisFindPaths } from './services/graph-analysis'
import { alignNodes as alignmentAlignNodes, distributeNodes as alignmentDistributeNodes, type AlignAxis, type DistributeAxis } from './services/alignment'
import { LayoutAnimator } from './services/layout-animator'
import type { NodeData, NodeStyle, NodeShape, NodeStatus } from './graph/node'
import type { EdgeData, EdgeStyle } from './graph/edge'
import type { ViewportState, AABB } from './viewport/viewport'
import type { RendererOptions, Renderer } from './renderer/interface'
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
  /**
   * Which renderer to use. Defaults to `'webgl2'` — instanced GPU rendering,
   * tested to 10k nodes at 60+ fps on real GPUs. Opt into `'canvas2d'` for
   * environments without WebGL2 or for workloads whose labels contain CJK
   * characters (the WebGL2 atlas has a known rendering issue with non-ASCII
   * glyphs, tracked separately). Pass a custom {@link Renderer} instance to
   * plug in your own.
   */
  rendererKind?: 'webgl2' | 'canvas2d' | Renderer
  /** Allow double-click to edit node labels inline. Default: true. */
  labelEditable?: boolean
  /**
   * When true, double-clicking a `type: 'group'` node toggles its collapse
   * state. Default: false — collapse is reserved for explicit `toggleCollapse`
   * / `collapseNode` / `expandNode` API calls (or a host-app chevron / context
   * menu) so a single double-click can't accidentally hide an entire subtree.
   * When false, group nodes get the same double-click behavior as any other
   * node (label edit, or just a `nodeDoubleClick` event if `labelEditable`
   * is false).
   */
  groupDoubleClickCollapses?: boolean
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
   * Alias for `onBeforeConnect` — same shape, same behavior. Provided so
   * apps migrating from React Flow (which calls this `isValidConnection`)
   * can keep their existing handler name. If both are provided,
   * `onBeforeConnect` takes precedence.
   */
  isValidConnection?: (params: {
    sourceId: string; targetId: string
    sourceHandle: string; targetHandle: string
  }) => boolean
  /**
   * NodeResize tuning — min/max bounds, aspect ratio, predicate, lifecycle
   * callbacks. Holding Shift during a resize gesture also toggles
   * keep-aspect-ratio for the duration of that gesture, irrespective of the
   * configured default.
   */
  nodeResize?: import('./interaction/node-resize').NodeResizeOptions
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
  /** Called when the WebGL context is lost (e.g. GPU reset, tab backgrounded on mobile). */
  onContextLost?: () => void
  /** Called when the WebGL context is restored after a loss event. */
  onContextRestored?: () => void
  /** When true, automatically fit the view to the initial nodes after construction. Default: false. */
  autoFit?: boolean
  /**
   * Sanitize `NodeData.htmlContent` before it is written to `innerHTML`.
   * Required when htmlContent may contain untrusted input — otherwise a
   * console warning is emitted on first use. Use a vetted sanitizer such as
   * DOMPurify: `sanitizeHtml: (s) => DOMPurify.sanitize(s)`.
   */
  sanitizeHtml?: (html: string) => string
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
  /**
   * @deprecated since 0.2.0 — direct access bypasses history/events. Use the public
   * `getNodes()` / `getEdges()` / `addNode()` / `updateNode()` etc. methods instead.
   * Will become private in 1.0.
   */
  readonly graph!: Graph
  /**
   * @deprecated since 0.2.0 — use `getViewport()` / `setViewport()` / `panTo()` / `zoomIn()` etc.
   * Will become private in 1.0.
   */
  readonly viewport!: Viewport
  private renderer!: Renderer
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
  private panelOverlay!: PanelOverlay
  private controls: Controls | null = null
  private nodeToolbarLayer: NodeToolbarLayer | null = null
  private perfOverlay: PerfOverlay | null = null
  private viewportPortalLayer: ViewportPortalLayer | null = null
  private edgeLabelOverlay: EdgeLabelOverlay | null = null
  private edgeToolbarLayer: EdgeToolbarLayer | null = null
  private nodeResizeOptions: import('./interaction/node-resize').NodeResizeOptions = {}
  private resizeObserver!: ResizeObserver
  private ariaLive!: HTMLElement
  private arrowMoveTimer: ReturnType<typeof setTimeout> | null = null
  private rafId: number | null = null
  private pendingResize: { w: number, h: number } | null = null
  private layoutAnimator!: LayoutAnimator
  private failed = false

  private selectedIds      = new Set<string>()
  private selectedEdgeIds  = new Set<string>()
  private connectState: ConnectState | null = null
  private rerouteState: RerouteState | null = null
  private minimap: Minimap | null = null
  private htmlOverlay!: HtmlOverlay
  private labelEditable!: boolean
  private readOnly!: boolean
  private groupDoubleClickCollapses!: boolean
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
  private lastDragEndTime = 0

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
      const err = new Error('@flowgl/core: browser environment required')
      if (options.onError) options.onError(err)
      else console.error('[FlowChart]', err.message)
      return
    }

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'display:block;touch-action:none;user-select:none;outline:none;'
    this.canvas.setAttribute('role', 'application')
    this.canvas.setAttribute('aria-label', options.ariaLabel ?? 'Flowchart')
    this.canvas.setAttribute('aria-roledescription', 'Flowchart editor')
    this.canvas.setAttribute('aria-keyshortcuts', 'Tab ArrowUp ArrowDown ArrowLeft ArrowRight Delete Backspace F Shift+F Control+Z Control+Y Control+A Control+C Control+X Control+V Control+D Escape')
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
    this.groupDoubleClickCollapses = options.groupDoubleClickCollapses ?? false
    // Store NodeResize options before the WebGL gate so a WebGL-failed chart
    // still reports a consistent options state. The interaction layer picks
    // them up after a successful init via setOptions.
    if (options.nodeResize) this.nodeResizeOptions = { ...options.nodeResize }
    this.bgColor       = options.background ?? '#f7f7f7'
    this.gridConfig    = { ...DEFAULT_GRID_CONFIG, ...options.grid }
    this.snapGridSize    = options.snapGrid ?? 0
    // `onBeforeConnect` takes precedence over its `isValidConnection` alias
    // when both are supplied. Apps migrating from React Flow can pass either.
    this.onBeforeConnect = options.onBeforeConnect ?? options.isValidConnection
    this.onBeforeDelete  = options.onBeforeDelete

    this.graph        = new Graph()
    this.layoutAnimator = new LayoutAnimator(this.graph, () => this.scheduleRender())
    this.viewport     = new Viewport()
    this.renderer = makeRenderer(options.rendererKind)
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
        options.onContextLost?.()
      },
      () => {
        console.info('[FlowChart] WebGL context restored — resuming')
        options.onContextRestored?.()
        this.scheduleRender()
      },
    )
    // PanelOverlay is DOM-only (no renderer dependency) and stays usable even
    // when WebGL2 init fails, so we mount it before the WebGL gate. A failed
    // chart can still host toolbars, error panels, and status messages.
    this.panelOverlay = new PanelOverlay(options.container, options.sanitizeHtml)

    if (!ok) {
      this.failed = true
      const err = new Error('@flowgl/core: WebGL2 is not available in this environment')
      if (options.onError) options.onError(err)
      else console.error('[FlowChart]', err.message)
      return
    }
    this.renderer.resize(width, height)
    this.htmlOverlay = new HtmlOverlay(options.container, options.sanitizeHtml)

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
    if (options.nodeResize) {
      this.nodeResizeOptions = { ...options.nodeResize }
      this.nodeResize.setOptions(options.nodeResize)
    }

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
      (id, x, y)    => {
        this.lastDragEndTime = Date.now()
        // Apply `NodeData.extent` clamp at drag end (positional snap).
        // Clamping during the drag itself would jitter the gesture; snapping
        // at end keeps the interaction smooth while still enforcing the
        // constraint.
        const node = this.graph.getNode(id)
        if (node && node.extent != null) {
          const r = this.clampToExtent(node)
          if (r && (r.x !== node.x || r.y !== node.y)) {
            this.graph.updateNode(id, { x: r.x, y: r.y })
            x = r.x; y = r.y
            this.scheduleRender()
          }
        }
        this.emit('nodeDragEnd', { id, x, y })
      },
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
      (nodeId) => this.selectedIds.has(nodeId) ? [...this.selectedIds].filter(id => id !== nodeId) : [],
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
        if (node.type === 'group' && this.groupDoubleClickCollapses) {
          // Drag end fires a click event; a rapid follow-up click creates a spurious
          // dblclick. Suppress collapse if a drag just ended.
          if (Date.now() - this.lastDragEndTime < 300) return
          this.toggleCollapse(node.id)
          this.announce(node.collapsed ? `Expanded ${node.label || node.id}` : `Collapsed ${node.label || node.id}`)
          return
        }
        if (!this.labelEditable) return
        // Skip the inline label editor for nodes whose visual is rendered via
        // `htmlContent`. Editing `label` on such a node has no visible effect
        // (HtmlOverlay owns the pixels), which is a silent UX dead-end — the
        // host application should handle these via the `nodeDoubleClick`
        // event instead.
        if (node.htmlContent) return
        this.labelEditor.startEdit(node, this.canvas, this.viewport, (newLabel) => {
          if (newLabel === node.label) return
          this.updateNode(node.id, { label: newLabel })
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
        const items: import('./interaction/context-menu').MenuEntry[] = []
        // Hide "Edit Label" on htmlContent-driven nodes — editing label there
        // is a no-op since HtmlOverlay paints the pixels.
        if (!node.htmlContent) {
          items.push({
            label: 'Edit Label',
            action: () => {
              this.labelEditor.startEdit(node, this.canvas, this.viewport, (newLabel) => {
                if (newLabel === node.label) return
                this.updateNode(node.id, { label: newLabel })
              })
            },
          })
          items.push({ separator: true })
        }
        items.push({ label: 'Delete Node', destructive: true, action: () => this.deleteSelected() })
        this.contextMenu.show(e.clientX, e.clientY, items)
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

  /** Returns the current readOnly state — used by Controls and external host code. */
  isReadOnly(): boolean { return this.readOnly }

  /** The DOM container the chart was constructed against. */
  getContainer(): HTMLElement { return this.canvas?.parentElement ?? this.canvas?.ownerDocument?.body ?? document.body }

  /** The panel overlay layer — used by Controls / NodeToolbar / PerfOverlay. */
  getPanelOverlay() { return this.panelOverlay }

  private applyReadOnly(readOnly: boolean): void {
    // Interactions are only constructed when the renderer initialised
    // successfully. In a WebGL-failed environment we still want setReadOnly
    // to flip the public flag so consumer UI (e.g. the Controls lock button)
    // reads back consistent state.
    this.connectDrag?.setDisabled(readOnly)
    this.edgeReroute?.setDisabled(readOnly)
    this.nodeResize?.setDisabled(readOnly)
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
      this.renderer.render(this.graph, this.viewport, {
        selectedIds:     this.selectedIds,
        selectedEdgeIds: this.selectedEdgeIds,
        connectState:    this.connectState,
        rerouteState:    this.rerouteState,
        endpointCircles: this.edgeReroute.getEndpointCircles(),
        bgColor:         this.bgColor,
        grid:            this.gridConfig.visible ? this.gridConfig : null,
        dashOffset:      this.edgeDashOffset,
      })
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

  /**
   * Render the current chart as a standalone SVG string. Style fields go
   * through `services/svg-export.ts` validators so the export cannot be used
   * as an attribute-injection vector.
   */
  exportSVG(padding = 40): string {
    return exportGraphAsSvg(this.graph, padding)
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

  /**
   * Load a previously serialized chart state. Replaces current content.
   *
   * The input is validated against a strict schema by default — invalid
   * fields (missing id, non-finite x/y, over-length htmlContent, prototype
   * pollution keys, etc.) throw `TypeError` before any state is mutated.
   * Pass `{ skipValidation: true }` to opt out when loading data you produced
   * yourself with `toJSON()`.
   */
  fromJSON(
    data: { version?: number; nodes: NodeData[]; edges: EdgeData[]; viewport?: ViewportState },
    options: { skipValidation?: boolean } = {},
  ): void {
    // Validate BEFORE the failed-state check so invalid input throws even when
    // the renderer is unavailable — the caller's untrusted JSON is still a
    // trust boundary worth enforcing.
    const safe = options.skipValidation ? data : validateChartJson(data) as typeof data
    if (this.failed) return
    this.history.clear()
    this.graph.clear()
    this.selectedIds.clear()
    this.selectedEdgeIds.clear()
    for (const n of safe.nodes) this.graph.addNode(n)
    for (const e of safe.edges) this.graph.addEdge(e)
    if (safe.viewport) this.viewport.setState(safe.viewport)
    this.emit('selectionChange', { selectedIds: [], edgeIds: [] })
    this.scheduleRender()
  }

  /**
   * Import nodes and edges. Both modes run the same schema validation as
   * `fromJSON` against untrusted input. Pass `{ skipValidation: true }` to
   * opt out (e.g. when re-loading data you produced with `toJSON()`).
   *
   * `'replace'` (default) clears the chart first (same as `fromJSON`).
   * `'merge'` adds to the existing graph without clearing.
   */
  importJSON(
    data: { nodes: NodeData[]; edges: EdgeData[]; viewport?: ViewportState },
    mode: 'replace' | 'merge' = 'replace',
    options: { skipValidation?: boolean } = {},
  ): void {
    if (mode === 'replace') { this.fromJSON(data, options); return }
    const safe = options.skipValidation ? data : validateChartJson(data) as typeof data
    this.beforeMutation()
    for (const n of safe.nodes) this.graph.addNode(n)
    for (const e of safe.edges) this.graph.addEdge(e)
    this.scheduleRender()
  }

  // ── Graph analysis ─ delegates to services/graph-analysis ────────────────────

  getIncomers(nodeId: string): NodeData[] { return analysisGetIncomers(this.graph, nodeId) }
  getOutgoers(nodeId: string): NodeData[] { return analysisGetOutgoers(this.graph, nodeId) }
  getConnectedNodes(nodeId: string): NodeData[] { return analysisGetConnectedNodes(this.graph, nodeId) }
  hasCycle(): boolean { return analysisHasCycle(this.graph) }
  findPaths(sourceId: string, targetId: string): string[][] { return analysisFindPaths(this.graph, sourceId, targetId) }

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
    this.layoutAnimator.animate(targets, duration)
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
        this.renderer.render(this.graph, this.viewport, {
          selectedIds:     this.selectedIds,
          selectedEdgeIds: renderedEdgeIds,
          connectState:    this.connectState,
          rerouteState:    this.rerouteState,
          endpointCircles: this.edgeReroute.getEndpointCircles(),
          bgColor:         this.bgColor,
          grid:            this.gridConfig.visible ? this.gridConfig : null,
          dashOffset:      this.edgeDashOffset,
        })
        this.htmlOverlay.sync(this.graph.getNodes(), this.viewport)
        const selArr = [...this.selectedIds]
        this.nodeResize.setSelectedNode(selArr.length === 1 ? selArr[0]! : null)
        this.nodeResize.render()
        this.minimap?.render(this.graph.getNodes(), this.graph.getEdges(), this.viewport)
        this.renderHighlights()
        this.renderStatusBadges()
        this.renderWaypointHandles()
        if (this.nodeToolbarLayer) {
          this.nodeToolbarLayer.setSelection(this.selectedIds)
        }
        if (this.viewportPortalLayer) {
          this.viewportPortalLayer.reposition()
        }
        if (this.edgeLabelOverlay) {
          this.edgeLabelOverlay.reposition()
        }
        if (this.edgeToolbarLayer) {
          this.edgeToolbarLayer.setSelection(this.selectedEdgeIds)
        }

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
      if (newLabel !== (edge.label ?? '')) {
        this.updateEdge(edge.id, { label: newLabel })
      }
      input.remove()
      this.canvas.focus()
    }
    input.addEventListener('keydown', (ev: KeyboardEvent) => {
      ev.stopPropagation()
      if (ev.isComposing || ev.keyCode === 229) return
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
    const movedIds = new Set<string>()
    for (const id of this.selectedIds) {
      if (movedIds.has(id)) continue
      const node = this.graph.getNode(id)
      if (!node) continue
      this.graph.updateNode(id, { x: node.x + dx, y: node.y + dy })
      movedIds.add(id)
      if (node.type === 'group') {
        for (const child of this.graph.getNodes().filter(n => n.parentId === id)) {
          if (!movedIds.has(child.id)) {
            this.graph.updateNode(child.id, { x: child.x + dx, y: child.y + dy })
            movedIds.add(child.id)
          }
        }
      }
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

  /** @deprecated since 0.2.0 — use `setNodeStyle(id, { borderColor })`. Removed in 1.0. */
  setNodeBorderColor(id: string, color: string): void { this.setNodeStyle(id, { borderColor: color }) }
  /** @deprecated since 0.2.0 — use `setNodeStyle(id, { backgroundColor })`. Removed in 1.0. */
  setNodeBackgroundColor(id: string, color: string): void { this.setNodeStyle(id, { backgroundColor: color }) }
  /** @deprecated since 0.2.0 — use `setNodeStyle(id, { shape })`. Removed in 1.0. */
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

  alignNodes(axis: AlignAxis): void {
    if (this.selectedIds.size < 2) return
    const nodes = [...this.selectedIds].map(id => this.graph.getNode(id)).filter(Boolean) as NodeData[]
    this.beforeMutation()
    alignmentAlignNodes(this.graph, nodes, axis)
    this.scheduleRender()
  }

  distributeNodes(axis: DistributeAxis): void {
    if (this.selectedIds.size < 3) return
    const nodes = [...this.selectedIds].map(id => this.graph.getNode(id)).filter(Boolean) as NodeData[]
    this.beforeMutation()
    alignmentDistributeNodes(this.graph, nodes, axis)
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

  /**
   * Dissolve a group: remove the group container node itself and detach every
   * child so the children survive as top-level nodes. Edges between children
   * are preserved; edges connected directly to the group node are removed
   * along with it (same as `removeNode`). No-op when `groupId` is not a
   * `type: 'group'` node. Single undo entry.
   *
   * Use `ungroupNodes(childIds)` instead when the group container should
   * remain (just detach selected children). Use `dissolveGroup(groupId)`
   * when the group itself should disappear from the graph.
   */
  dissolveGroup(groupId: string): void {
    const group = this.graph.getNode(groupId)
    if (!group || group.type !== 'group') return
    const children = this.graph.getNodes().filter(n => n.parentId === groupId)
    this.beforeMutation()
    for (const child of children) {
      const { parentId: _removed, ...rest } = child
      this.graph.replaceNode(rest as NodeData)
    }
    this.graph.removeNode(groupId)
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

  /** @deprecated since 0.2.0 — use `setSelection({ nodes })`. Removed in 1.0. */
  setSelectedIds(ids: string[]): void {
    this.selectedIds = new Set(ids)
    // Toolbar visibility derives from selection — sync immediately so that
    // tests + headless callers don't need to await a render frame to see the
    // visibility change. The render loop also calls setSelection but it's a
    // cheap idempotent map write.
    this.nodeToolbarLayer?.setSelection(this.selectedIds)
    // Subscribers (e.g. React's useSelection) need to know.
    this.emit('selectionChange', {
      selectedIds: [...this.selectedIds],
      edgeIds:     [...this.selectedEdgeIds],
    })
    this.scheduleRender()
  }

  /** @deprecated since 0.2.0 — use `setSelection({ edges })`. Removed in 1.0. */
  setSelectedEdgeIds(ids: string[]): void {
    this.selectedEdgeIds = new Set(ids)
    this.edgeToolbarLayer?.setSelection(this.selectedEdgeIds)
    this.emit('selectionChange', {
      selectedIds: [...this.selectedIds],
      edgeIds:     [...this.selectedEdgeIds],
    })
    this.scheduleRender()
  }

  /**
   * Replace the current selection. Pass undefined for a dimension to leave it untouched.
   * Emits `selectionChange` once at the end.
   */
  setSelection(selection: { nodes?: string[]; edges?: string[] }): void {
    if (selection.nodes !== undefined) this.selectedIds     = new Set(selection.nodes)
    if (selection.edges !== undefined) this.selectedEdgeIds = new Set(selection.edges)
    this.nodeToolbarLayer?.setSelection(this.selectedIds)
    this.edgeToolbarLayer?.setSelection(this.selectedEdgeIds)
    this.emit('selectionChange', { selectedIds: [...this.selectedIds], edgeIds: [...this.selectedEdgeIds] })
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

  private themeMql: MediaQueryList | null = null
  private themeMqlHandler: ((e: MediaQueryListEvent) => void) | null = null

  /**
   * Apply a built-in theme preset.
   *
   * - `'light'` / `'dark'` — explicit choice, immediate.
   * - `'system'` — follows `prefers-color-scheme` and updates live when the
   *   OS theme changes (SSR-safe: in non-DOM environments this falls back to
   *   `'light'`). Re-calling with another mode tears down the listener.
   */
  setTheme(theme: 'light' | 'dark' | 'system'): void {
    // Tear down any prior 'system' listener before applying the new mode.
    if (this.themeMql && this.themeMqlHandler) {
      this.themeMql.removeEventListener('change', this.themeMqlHandler)
      this.themeMql = null
      this.themeMqlHandler = null
    }

    if (theme === 'system') {
      if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
        // SSR / no-matchMedia fallback
        this.applyThemePalette('light')
        return
      }
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      this.themeMql = mql
      this.themeMqlHandler = (e) => this.applyThemePalette(e.matches ? 'dark' : 'light')
      mql.addEventListener('change', this.themeMqlHandler)
      this.applyThemePalette(mql.matches ? 'dark' : 'light')
      return
    }
    this.applyThemePalette(theme)
  }

  private applyThemePalette(theme: 'light' | 'dark'): void {
    if (theme === 'dark') {
      this.setBackground('#1a1a2e')
      this.setGrid({ ...this.gridConfig, color: 'rgba(255,255,255,0.06)' })
    } else {
      this.setBackground('#f7f7f7')
      this.setGrid({ ...this.gridConfig, color: 'rgba(0,0,0,0.15)' })
    }
  }

  // ── Panel overlay API ────────────────────────────────────────────────────────
  //
  // Lightweight DOM widgets positioned over the chart in 9-position layout
  // (top-left … bottom-right). Panels are absolutely-positioned `<div>` siblings
  // of the canvas — they participate in CSS, not WebGL, and have zero per-frame
  // render cost. Use for toolbars, legends, status pills, controls etc.

  /** Mount a panel above the viewport. Returns the panel id. */
  addPanel(options: PanelOptions): string {
    return this.panelOverlay.add(options)
  }

  /** Update an existing panel's position / content / styling. Returns false on unknown id. */
  updatePanel(id: string, options: Partial<Omit<PanelOptions, 'id'>>): boolean {
    return this.panelOverlay.update(id, options)
  }

  /** Remove a panel by id. Returns false on unknown id. */
  removePanel(id: string): boolean {
    return this.panelOverlay.remove(id)
  }

  /** Currently mounted panel ids. */
  listPanels(): string[] {
    return this.panelOverlay.list()
  }

  // ── Controls panel ────────────────────────────────────────────────────────────
  //
  // Built on top of the Panel overlay: zoom in/out, fit view, lock/interactive
  // toggle, plus optional custom buttons. Idempotent — calling `showControls`
  // twice swaps the prior mount for the new one.

  /** Show the chart controls panel. Returns the underlying panel id. */
  showControls(options: ControlsOptions = {}): string {
    if (!this.controls) this.controls = new Controls(this)
    return this.controls.show(options)
  }

  /** Hide the chart controls panel. Returns false if it wasn't visible. */
  hideControls(): boolean {
    return this.controls?.hide() ?? false
  }

  /** Whether the controls panel is currently mounted. */
  hasControls(): boolean {
    return this.controls?.isVisible() ?? false
  }

  // ── NodeToolbar API ──────────────────────────────────────────────────────────
  //
  // Floating, constant-screen-size toolbars anchored to a node (or a set of
  // nodes). Position/visibility recomputed every render frame via the layer's
  // `reposition()` call. By default a toolbar shows only when its node(s)
  // exactly match the current selection (matches React Flow's auto behaviour).

  private ensureNodeToolbarLayer(): NodeToolbarLayer {
    if (!this.nodeToolbarLayer) {
      const container = this.getContainer()
      this.nodeToolbarLayer = new NodeToolbarLayer(
        container,
        this.viewport,
        this.graph,
        (this as unknown as { sanitizeHtml?: (s: string) => string }).sanitizeHtml,
      )
    }
    return this.nodeToolbarLayer
  }

  /** Add a node toolbar. Returns its id. */
  addNodeToolbar(spec: NodeToolbarSpec): string {
    return this.ensureNodeToolbarLayer().add(spec)
  }

  /** Update content / position / align / offset / visibility of an existing toolbar. */
  updateNodeToolbar(id: string, partial: Partial<Omit<NodeToolbarSpec, 'nodeId'>>): boolean {
    return this.nodeToolbarLayer?.update(id, partial) ?? false
  }

  /** Remove a node toolbar. */
  removeNodeToolbar(id: string): boolean {
    return this.nodeToolbarLayer?.remove(id) ?? false
  }

  /** Currently-mounted node toolbar ids. */
  listNodeToolbars(): string[] {
    return this.nodeToolbarLayer?.list() ?? []
  }

  // ── PerfOverlay — differentiation API ────────────────────────────────────────
  //
  // Real-time fps / frame-time / node-edge counts / atlas-generation overlay.
  // No equivalent ships in React Flow — this surface is flowgl-specific and
  // turns the WebGL2 advantage into something visible to a user evaluating
  // the library.

  /** Show the perf overlay. Idempotent — calling twice replaces the prior mount. */
  showPerfOverlay(options: PerfOverlayOptions = {}): void {
    if (this.perfOverlay) this.perfOverlay.hide()
    const container = this.getContainer()
    this.perfOverlay = new PerfOverlay(
      container,
      this.viewport,
      this.graph,
      () => {
        const r = this.renderer as unknown as { getAtlasGeneration?: () => number }
        return r?.getAtlasGeneration ? { generation: r.getAtlasGeneration() } : null
      },
      options,
    )
    this.perfOverlay.show()
  }

  /** Hide the perf overlay. Returns false if it wasn't visible. */
  hidePerfOverlay(): boolean {
    if (!this.perfOverlay) return false
    this.perfOverlay.hide()
    this.perfOverlay = null
    return true
  }

  /** Whether the perf overlay is currently visible. */
  hasPerfOverlay(): boolean { return this.perfOverlay?.isVisible() ?? false }

  // ── ViewportPortal API ───────────────────────────────────────────────────────
  //
  // World-coordinate DOM portals. Each portal's children scale + translate
  // with the viewport — opposite contract from NodeToolbar (constant size).
  // Use for in-canvas annotations, embedded media, sticky notes.

  private ensureViewportPortalLayer(): ViewportPortalLayer {
    if (!this.viewportPortalLayer) {
      this.viewportPortalLayer = new ViewportPortalLayer(
        this.getContainer(),
        this.viewport,
        (this as unknown as { sanitizeHtml?: (s: string) => string }).sanitizeHtml,
      )
    }
    return this.viewportPortalLayer
  }

  /** Mount a viewport portal. Returns its id. */
  addViewportPortal(spec: ViewportPortalSpec): string {
    return this.ensureViewportPortalLayer().add(spec)
  }

  /** Update an existing portal's position / content / sizing / zIndex. */
  updateViewportPortal(id: string, partial: Partial<Omit<ViewportPortalSpec, 'id'>>): boolean {
    return this.viewportPortalLayer?.update(id, partial) ?? false
  }

  /** Remove a viewport portal. */
  removeViewportPortal(id: string): boolean {
    return this.viewportPortalLayer?.remove(id) ?? false
  }

  /** Currently-mounted viewport portal ids. */
  listViewportPortals(): string[] {
    return this.viewportPortalLayer?.list() ?? []
  }

  // ── EdgeLabel HTML overlay API ───────────────────────────────────────────────
  //
  // HTML edge labels — an alternative to the atlas SDF labels (EdgeData.label)
  // for cases that need arbitrary HTML (badges, mini-graphs, buttons). Practical
  // budget is on the order of tens — use atlas labels for the bulk of the graph.

  private ensureEdgeLabelOverlay(): EdgeLabelOverlay {
    if (!this.edgeLabelOverlay) {
      this.edgeLabelOverlay = new EdgeLabelOverlay(
        this.getContainer(),
        this.viewport,
        this.graph,
        (this as unknown as { sanitizeHtml?: (s: string) => string }).sanitizeHtml,
      )
    }
    return this.edgeLabelOverlay
  }

  /** Mount an HTML label anchored at an edge's midpoint. Returns its id. */
  addEdgeLabel(spec: EdgeLabelSpec): string {
    return this.ensureEdgeLabelOverlay().add(spec)
  }

  /** Update an existing edge label. */
  updateEdgeLabel(id: string, partial: Partial<Omit<EdgeLabelSpec, 'edgeId'>>): boolean {
    return this.edgeLabelOverlay?.update(id, partial) ?? false
  }

  /** Remove an edge label. */
  removeEdgeLabel(id: string): boolean {
    return this.edgeLabelOverlay?.remove(id) ?? false
  }

  /** Currently-mounted edge label ids. */
  listEdgeLabels(): string[] {
    return this.edgeLabelOverlay?.list() ?? []
  }

  private ensureEdgeToolbarLayer(): EdgeToolbarLayer {
    if (!this.edgeToolbarLayer) {
      this.edgeToolbarLayer = new EdgeToolbarLayer(
        this.getContainer(),
        this.viewport,
        this.graph,
        (this as unknown as { sanitizeHtml?: (s: string) => string }).sanitizeHtml,
      )
      this.edgeToolbarLayer.setSelection(this.selectedEdgeIds)
    }
    return this.edgeToolbarLayer
  }

  /** Mount a floating toolbar anchored to an edge's midpoint. Returns its id. */
  addEdgeToolbar(spec: EdgeToolbarSpec): string {
    return this.ensureEdgeToolbarLayer().add(spec)
  }

  /** Update an existing edge toolbar. */
  updateEdgeToolbar(id: string, partial: Partial<Omit<EdgeToolbarSpec, 'edgeId'>>): boolean {
    return this.edgeToolbarLayer?.update(id, partial) ?? false
  }

  /** Remove an edge toolbar. */
  removeEdgeToolbar(id: string): boolean {
    return this.edgeToolbarLayer?.remove(id) ?? false
  }

  /** Currently-mounted edge toolbar ids. */
  listEdgeToolbars(): string[] {
    return this.edgeToolbarLayer?.list() ?? []
  }

  /**
   * Clamp a node's bbox into its `extent` constraint and return the new top-left
   * position. Returns null when the node has no extent. The clamp respects the
   * node's current width/height — the node's box stays the same size and is
   * translated to fit. Width that exceeds the bound is clamped to the bound's
   * top-left corner (no resize).
   */
  private clampToExtent(node: NodeData): { x: number; y: number } | null {
    if (node.extent == null) return null
    let bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null
    if (node.extent === 'parent') {
      if (!node.parentId) return null
      const parent = this.graph.getNode(node.parentId)
      if (!parent) return null
      bounds = { minX: parent.x, minY: parent.y, maxX: parent.x + parent.width, maxY: parent.y + parent.height }
    } else {
      bounds = node.extent
    }
    const maxAllowedX = bounds.maxX - node.width
    const maxAllowedY = bounds.maxY - node.height
    const x = Math.min(maxAllowedX, Math.max(bounds.minX, node.x))
    const y = Math.min(maxAllowedY, Math.max(bounds.minY, node.y))
    return { x, y }
  }

  /**
   * Update NodeResize tuning at runtime. Merges with existing options. The
   * interaction layer may be null on a WebGL-failed chart, in which case the
   * options are still stored — consumer UI reads back consistent state and
   * the next chart instance picks them up.
   */
  setNodeResizeOptions(options: import('./interaction/node-resize').NodeResizeOptions): void {
    this.nodeResizeOptions = { ...this.nodeResizeOptions, ...options }
    this.nodeResize?.setOptions(this.nodeResizeOptions)
  }

  /** Current NodeResize tuning. */
  getNodeResizeOptions(): import('./interaction/node-resize').NodeResizeOptions {
    return { ...this.nodeResizeOptions }
  }

  // ── Viewport API ──────────────────────────────────────────────────────────────

  getViewport(): ViewportState  { return this.viewport.getState() }

  setViewport(state: ViewportState): void {
    this.viewport.setState(state)
    // Subscribers (e.g. React's useViewport) need to know.
    this.emit('viewportChange', this.viewport.getState())
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

  /**
   * Request a render on the next animation frame.
   * @deprecated since 0.2.0 — internal `scheduleRender` already handles all mutations; this wrapper exists only for benchmarks. Removed in 1.0.
   */
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
    this.layoutAnimator?.dispose()
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
    this.perfOverlay?.dispose()
    this.edgeLabelOverlay?.dispose()
    this.edgeToolbarLayer?.dispose()
    this.viewportPortalLayer?.dispose()
    this.nodeToolbarLayer?.dispose()
    this.controls?.dispose()
    this.panels?.dispose()
    this.panelOverlay?.dispose()
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
    if (this.themeMql && this.themeMqlHandler) {
      this.themeMql.removeEventListener('change', this.themeMqlHandler)
      this.themeMql = null
      this.themeMqlHandler = null
    }
    this.tooltipEl?.remove()
    this.ariaLive?.remove()
    this.ariaDesc?.remove()
    this.highlightOverlay?.remove()
    this.statusOverlay?.remove()
    this.canvas?.remove()
    super.dispose()
  }
}

function makeRenderer(kind: FlowChartOptions['rendererKind']): Renderer {
  if (kind === 'canvas2d') return new Canvas2DRenderer()
  if (kind && typeof kind === 'object') return kind
  // Default: WebGL2. The project's core value proposition is GPU-accelerated
  // rendering — instanced draws, geometry batching, parallel rasterization
  // at sizes SVG / Canvas2D libraries can't reach. Opt into Canvas2D via
  // `rendererKind: 'canvas2d'` for environments without WebGL2 or workloads
  // with non-ASCII labels that hit the atlas CJK issue.
  return new WebGL2Renderer()
}
