export { Flowchart } from './Flowchart'
export type { FlowchartProps, ConnectParams } from './Flowchart'

// 0.6.0 — hook-based subscriptions. Mount your own `<FlowchartProvider>`
// around components that use the hooks; the value is the FlowChart instance
// you got from a Flowchart ref or constructed yourself.
export {
  FlowchartProvider,
  useFlowChart,
  useNodes,
  useEdges,
  useViewport,
  useSelection,
} from './hooks'

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
