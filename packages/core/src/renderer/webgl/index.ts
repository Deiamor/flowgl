import type { Renderer, RendererOptions } from '../interface'
import type { Graph } from '../../graph/graph'
import type { Viewport } from '../../viewport/viewport'
import type { ConnectState } from '../../interaction/connect'
import type { RerouteState, EndpointCircle } from '../../interaction/edge-reroute'
import type { GridConfig } from '../../types'
import { createWebGL2Context } from './context'
import { NodeProgram } from './programs/node-program'
import { EdgeProgram } from './programs/edge-program'
import { CapProgram }  from './programs/cap-program'
import { TextProgram } from './programs/text-program'
import { HandleProgram } from './programs/handle-program'
import { GridProgram } from './programs/grid-program'
import { TextAtlas } from './atlas/text-atlas'
import { parseColor } from './util/color'
import { cullNodes, cullEdges } from './cull'
import type { NodeData } from '../../graph/node'
import type { EdgeData } from '../../graph/edge'

export class WebGL2Renderer implements Renderer {
  private gl!: WebGL2RenderingContext
  private nodeProgram!:   NodeProgram
  private edgeProgram!:   EdgeProgram
  private capProgram!:    CapProgram
  private textProgram!:   TextProgram
  private handleProgram!: HandleProgram
  private gridProgram!:   GridProgram
  private atlas!: TextAtlas
  private dpr = 1
  private contextLost = false

  // Per-frame data cache — invalidated by graph.version or viewport change
  private cachedGraphVersion = -1
  private cachedVpX = NaN
  private cachedVpY = NaN
  private cachedVpZoom = NaN
  private cachedVpWidth = NaN
  private cachedVpHeight = NaN
  private cachedAllNodes: NodeData[] = []
  private cachedNodeMap:  Map<string, NodeData> = new Map()
  private cachedAllEdges: EdgeData[] = []
  private cachedVisNodes: NodeData[] = []
  private cachedVisSortedNodes: NodeData[] = []
  private cachedVisEdges: EdgeData[] = []
  private cachedTextNodes: NodeData[] = []
  private cachedHasAnimated = false

  initialize(
    canvas: HTMLCanvasElement,
    options: RendererOptions = {},
    onContextLost?: () => void,
    onContextRestored?: () => void,
  ): boolean {
    this.dpr = options.pixelRatio ?? window.devicePixelRatio ?? 1
    const gl = createWebGL2Context(canvas, options.antialias ?? true)
    if (!gl) return false
    this.gl            = gl
    this.atlas         = new TextAtlas(this.dpr)
    this.nodeProgram   = new NodeProgram(gl)
    this.edgeProgram   = new EdgeProgram(gl)
    this.capProgram    = new CapProgram(gl)
    this.textProgram   = new TextProgram(gl, this.atlas)
    this.handleProgram = new HandleProgram(gl)
    this.gridProgram   = new GridProgram(gl)

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.contextLost = true
      onContextLost?.()
    })

    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false
      this.reinitializePrograms()
      onContextRestored?.()
    })

    return true
  }

  private reinitializePrograms(): void {
    const gl = this.gl
    this.atlas         = new TextAtlas(this.dpr)
    this.nodeProgram   = new NodeProgram(gl)
    this.edgeProgram   = new EdgeProgram(gl)
    this.capProgram    = new CapProgram(gl)
    this.textProgram   = new TextProgram(gl, this.atlas)
    this.handleProgram = new HandleProgram(gl)
    this.gridProgram   = new GridProgram(gl)
    // Force full cache rebuild on next render
    this.cachedGraphVersion = -1
    this.cachedVpX = NaN
  }

  resize(width: number, height: number): void {
    const gl = this.gl
    const canvas = gl.canvas as HTMLCanvasElement
    canvas.width  = Math.round(width  * this.dpr)
    canvas.height = Math.round(height * this.dpr)
    canvas.style.width  = `${width}px`
    canvas.style.height = `${height}px`
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  render(
    graph: Graph,
    viewport: Viewport,
    selectedIds: Set<string> = new Set(),
    connectState: ConnectState | null = null,
    selectedEdgeIds: Set<string> = new Set(),
    bgColor = '#f7f7f7',
    grid: GridConfig | null = null,
    rerouteState: RerouteState | null = null,
    endpointCircles: EndpointCircle[] = [],
    dashOffset = 0,
  ): void {
    if (this.contextLost) return
    const gl = this.gl
    const [br, bg, bb] = parseColor(bgColor)
    gl.clearColor(br, bg, bb, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (grid?.visible) {
      this.gridProgram.render(viewport, grid.size, grid.type, grid.color)
    }

    const matrix = viewport.getMatrix()

    // ── Rebuild cached data only when graph or viewport changed ───────────
    const graphChanged   = graph.version !== this.cachedGraphVersion
    const vpW = viewport.canvasWidth
    const vpH = viewport.canvasHeight
    const viewportChanged = (
      viewport.x    !== this.cachedVpX    ||
      viewport.y    !== this.cachedVpY    ||
      viewport.zoom !== this.cachedVpZoom ||
      vpW           !== this.cachedVpWidth ||
      vpH           !== this.cachedVpHeight
    )

    if (graphChanged) {
      this.cachedHasAnimated = false   // will be set below after edges are known
      // Compute the set of hidden node IDs: children of collapsed groups
      const collapsedParentIds = new Set<string>()
      for (const n of graph.getNodes()) {
        if (n.type === 'group' && n.collapsed) collapsedParentIds.add(n.id)
      }
      const hiddenNodeIds = new Set<string>()
      if (collapsedParentIds.size > 0) {
        for (const n of graph.getNodes()) {
          if (n.parentId && collapsedParentIds.has(n.parentId)) hiddenNodeIds.add(n.id)
        }
      }
      this.cachedAllNodes = hiddenNodeIds.size > 0
        ? graph.getNodes().filter(n => !hiddenNodeIds.has(n.id))
        : graph.getNodes()
      this.cachedNodeMap  = new Map(this.cachedAllNodes.map(n => [n.id, n]))
      this.cachedAllEdges = hiddenNodeIds.size > 0
        ? graph.getEdges().filter(e => !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target))
        : graph.getEdges()
      this.cachedHasAnimated  = this.cachedAllEdges.some(e => e.animated)
      this.cachedGraphVersion = graph.version
    }

    if (graphChanged || viewportChanged) {
      const bounds = viewport.getVisibleBounds()
      this.cachedVisNodes = cullNodes(this.cachedAllNodes, bounds)
      const hasGroups = this.cachedVisNodes.some(n => n.type === 'group')
      this.cachedVisSortedNodes = hasGroups
        ? [...this.cachedVisNodes].sort((a, b) => (a.type === 'group' ? -1 : 1) - (b.type === 'group' ? -1 : 1))
        : this.cachedVisNodes
      this.cachedVisEdges  = cullEdges(this.cachedAllEdges, this.cachedNodeMap, bounds)
      this.cachedTextNodes = this.cachedVisNodes.filter(n => !n.htmlContent)
      this.cachedVpX       = viewport.x
      this.cachedVpY      = viewport.y
      this.cachedVpZoom   = viewport.zoom
      this.cachedVpWidth  = vpW
      this.cachedVpHeight = vpH
    }

    const visNodes = this.cachedVisNodes
    const visEdges = this.cachedVisEdges
    const nodeMap  = this.cachedNodeMap

    // Merge connect-drag target and reroute target for node highlight
    const connectTargetId = connectState?.targetNodeId ?? null
    const rerouteTargetId = rerouteState?.targetNodeId ?? null
    const targetNodeId    = connectTargetId ?? rerouteTargetId

    // Draw order:
    //   1. edges (behind everything)
    //   2. handles (before nodes — nodes will cover the inner half of each circle)
    //   3. nodes (their opaque fill covers the inner half of handle circles)
    //   4. text (on top of nodes)
    this.edgeProgram.render(visEdges, nodeMap, matrix, selectedEdgeIds, dashOffset)
    this.capProgram.render(visEdges, nodeMap, matrix, selectedEdgeIds, viewport.zoom * this.dpr)

    if (connectState || endpointCircles.length > 0 || rerouteState) {
      this.handleProgram.render(
        connectState, nodeMap, matrix, viewport.zoom,
        rerouteState, endpointCircles,
      )
    }

    this.nodeProgram.render(this.cachedVisSortedNodes, matrix, selectedIds, targetNodeId)
    this.textProgram.render(this.cachedTextNodes, matrix, viewport.zoom)
    this.textProgram.renderEdgeLabels(visEdges, nodeMap, matrix, viewport.zoom)
  }

  hasAnimatedEdges(): boolean { return this.cachedHasAnimated }

  dispose(): void {
    this.nodeProgram.dispose()
    this.edgeProgram.dispose()
    this.capProgram.dispose()
    this.textProgram.dispose()
    this.handleProgram.dispose()
    this.gridProgram.dispose()
    this.atlas.dispose(this.gl)
  }
}
