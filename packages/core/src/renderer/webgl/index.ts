import type { Renderer, RendererOptions } from '../interface'
import type { Graph } from '../../graph/graph'
import type { Viewport } from '../../viewport/viewport'
import type { ConnectState } from '../../interaction/connect'
import type { RerouteState, EndpointCircle } from '../../interaction/edge-reroute'
import type { GridConfig } from '../../types'
import { createWebGL2Context } from './context'
import { NodeProgram } from './programs/node-program'
import { EdgeProgram } from './programs/edge-program'
import { TextProgram } from './programs/text-program'
import { HandleProgram } from './programs/handle-program'
import { GridProgram } from './programs/grid-program'
import { TextAtlas } from './atlas/text-atlas'
import { parseColor } from './util/color'
import { cullNodes, cullEdges } from './cull'

export class WebGL2Renderer implements Renderer {
  private gl!: WebGL2RenderingContext
  private nodeProgram!:   NodeProgram
  private edgeProgram!:   EdgeProgram
  private textProgram!:   TextProgram
  private handleProgram!: HandleProgram
  private gridProgram!:   GridProgram
  private atlas!: TextAtlas
  private dpr = 1

  initialize(canvas: HTMLCanvasElement, options: RendererOptions = {}): boolean {
    this.dpr = options.pixelRatio ?? window.devicePixelRatio ?? 1
    const gl = createWebGL2Context(canvas, options.antialias ?? true)
    if (!gl) return false
    this.gl            = gl
    this.atlas         = new TextAtlas()
    this.nodeProgram   = new NodeProgram(gl)
    this.edgeProgram   = new EdgeProgram(gl)
    this.textProgram   = new TextProgram(gl, this.atlas)
    this.handleProgram = new HandleProgram(gl)
    this.gridProgram   = new GridProgram(gl)
    return true
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
  ): void {
    const gl = this.gl
    const [br, bg, bb] = parseColor(bgColor)
    gl.clearColor(br, bg, bb, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (grid?.visible) {
      this.gridProgram.render(viewport, grid.size, grid.type, grid.color)
    }

    const matrix   = viewport.getMatrix()
    const bounds   = viewport.getVisibleBounds()
    const allNodes = graph.getNodes()
    const nodeMap  = new Map(allNodes.map(n => [n.id, n]))
    const allEdges = graph.getEdges()

    const visNodes = cullNodes(allNodes, bounds)
    const visEdges = cullEdges(allEdges, nodeMap, bounds)

    // Merge connect-drag target and reroute target for node highlight
    const connectTargetId = connectState?.targetNodeId ?? null
    const rerouteTargetId = rerouteState?.targetNodeId ?? null
    const targetNodeId    = connectTargetId ?? rerouteTargetId

    // Draw order:
    //   1. edges (behind everything)
    //   2. handles (before nodes — nodes will cover the inner half of each circle)
    //   3. nodes (their opaque fill covers the inner half of handle circles)
    //   4. text (on top of nodes)
    this.edgeProgram.render(visEdges, nodeMap, matrix, selectedEdgeIds)

    if (connectState || endpointCircles.length > 0 || rerouteState) {
      this.handleProgram.render(
        connectState, nodeMap, matrix, viewport.zoom,
        rerouteState, endpointCircles,
      )
    }

    this.nodeProgram.render(visNodes, matrix, selectedIds, targetNodeId)
    this.textProgram.render(visNodes, matrix)
  }

  dispose(): void {
    this.nodeProgram.dispose()
    this.edgeProgram.dispose()
    this.textProgram.dispose()
    this.handleProgram.dispose()
    this.gridProgram.dispose()
    this.atlas.dispose(this.gl)
  }
}
