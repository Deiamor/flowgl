export type NodeShape = 'rectangle' | 'circle' | 'diamond' | 'hexagon'

export interface NodeStyle {
  backgroundColor: string
  borderColor: string
  borderWidth: number
  borderRadius: number
  textColor: string
  fontSize: number
  fontFamily: string
  textAlign: 'left' | 'center' | 'right'
  lineHeight: number
  /** Node geometry. Default: 'rectangle'. */
  shape: NodeShape
}

export interface NodeData {
  id: string
  x: number
  y: number
  width: number
  height: number
  label: string
  type?: string
  style?: Partial<NodeStyle>
  data?: Record<string, unknown>
  /**
   * Raw HTML rendered inside an overlay div positioned over the node.
   * When set, the WebGL text label is suppressed; the HTML provides content.
   */
  htmlContent?: string
}

export const DEFAULT_NODE_STYLE: NodeStyle = {
  backgroundColor: '#ffffff',
  borderColor: '#1a73e8',
  borderWidth: 2,
  borderRadius: 8,
  textColor: '#1a1a1a',
  fontSize: 14,
  fontFamily: 'system-ui, sans-serif',
  textAlign: 'center',
  lineHeight: 1.4,
  shape: 'rectangle',
}

const SHAPE_INDEX: Record<NodeShape, number> = {
  rectangle: 0,
  circle:    1,
  diamond:   2,
  hexagon:   3,
}

export function shapeToFloat(shape: NodeShape | undefined): number {
  return SHAPE_INDEX[shape ?? 'rectangle'] ?? 0
}
