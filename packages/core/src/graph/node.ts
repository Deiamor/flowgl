export interface NodeStyle {
  backgroundColor: string
  borderColor: string
  borderWidth: number
  borderRadius: number
  textColor: string
  fontSize: number
  fontFamily: string
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
}

export const DEFAULT_NODE_STYLE: NodeStyle = {
  backgroundColor: '#ffffff',
  borderColor: '#1a73e8',
  borderWidth: 2,
  borderRadius: 8,
  textColor: '#1a1a1a',
  fontSize: 14,
  fontFamily: 'system-ui, sans-serif',
}
