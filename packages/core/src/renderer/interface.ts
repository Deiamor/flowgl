import type { Graph } from '../graph/graph'
import type { Viewport } from '../viewport/viewport'
import type { ConnectState } from '../interaction/connect'
import type { RerouteState, EndpointCircle } from '../interaction/edge-reroute'
import type { GridConfig } from '../types'

export interface RendererOptions {
  antialias?: boolean
  pixelRatio?: number
}

/**
 * Per-frame inputs to {@link Renderer.render}. Everything that varies per frame
 * but is not part of the graph or viewport flows through here, so the
 * `Renderer` interface stays stable across implementations.
 */
export interface RenderFrame {
  selectedIds?:     Set<string>
  selectedEdgeIds?: Set<string>
  connectState?:    ConnectState | null
  rerouteState?:    RerouteState | null
  endpointCircles?: EndpointCircle[]
  bgColor?:         string
  grid?:            GridConfig | null
  dashOffset?:      number
}

export interface Renderer {
  initialize(
    canvas: HTMLCanvasElement,
    options?: RendererOptions,
    onContextLost?: () => void,
    onContextRestored?: () => void,
  ): boolean
  render(graph: Graph, viewport: Viewport, frame?: RenderFrame): void
  resize(width: number, height: number): void
  /** True when at least one currently-visible edge has `animated: true`. */
  hasAnimatedEdges(): boolean
  dispose(): void
}
