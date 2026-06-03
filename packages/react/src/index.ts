export { Flowchart } from './Flowchart'
export type { FlowchartProps, ConnectParams } from './Flowchart'

// Re-export core types commonly needed by React consumers
export type {
  NodeData,
  NodeStyle,
  NodeShape,
  EdgeData,
  EdgeStyle,
  ViewportState,
  GridConfig,
  MinimapConfig,
  HandleSide,
} from '@flowgl/core'
export { FlowChart, generateId, DEFAULT_NODE_STYLE, DEFAULT_EDGE_STYLE } from '@flowgl/core'
