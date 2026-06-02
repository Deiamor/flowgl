import type { Graph } from '../graph/graph'
import type { Viewport } from '../viewport/viewport'

export interface RendererOptions {
  antialias?: boolean
  pixelRatio?: number
}

export interface Renderer {
  initialize(
    canvas: HTMLCanvasElement,
    options?: RendererOptions,
    onContextLost?: () => void,
    onContextRestored?: () => void,
  ): boolean
  render(graph: Graph, viewport: Viewport): void
  resize(width: number, height: number): void
  dispose(): void
}
