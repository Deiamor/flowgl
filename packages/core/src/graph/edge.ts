export type EdgeType = 'bezier' | 'straight' | 'step' | 'smoothstep'

export interface EdgeStyle {
  color: string
  width: number
  dashArray?: [number, number]
}

/**
 * Type-specific routing tuning.
 *
 *   - `borderRadius` applies to `'smoothstep'`. Sets the corner radius in
 *     world units (default 8). Capped at half the shorter incident segment
 *     so the arc never crosses the previous/next segment.
 *   - `arcSegments` controls how many polyline samples the rounded corner
 *     is subdivided into (default 8). Higher → smoother curve, more vertices.
 *     Identical sampling on WebGL2 and Canvas2D — keeps the two renderers
 *     pixel-equivalent (T5 parity).
 */
export interface EdgePathOptions {
  borderRadius?: number
  arcSegments?: number
}

export interface EdgeData {
  id: string
  source: string
  target: string
  sourceHandle?: 'top' | 'right' | 'bottom' | 'left' | (string & {})
  targetHandle?: 'top' | 'right' | 'bottom' | 'left' | (string & {})
  type?: EdgeType
  label?: string
  style?: Partial<EdgeStyle>
  data?: Record<string, unknown>
  /** Intermediate world-space control points. When present, overrides auto bezier routing. */
  waypoints?: { x: number; y: number }[]
  /** When true, the edge renders as marching-ants (animated dashes). */
  animated?: boolean
  /** Type-specific routing tuning (corner radius for `'smoothstep'`, etc.). */
  pathOptions?: EdgePathOptions
}

export const DEFAULT_EDGE_STYLE: EdgeStyle = {
  color: '#555555',
  width: 2,
}

export const DEFAULT_SMOOTHSTEP_BORDER_RADIUS = 8
export const DEFAULT_SMOOTHSTEP_ARC_SEGMENTS = 8
