import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
} from 'react'
import { FlowChart, generateId } from '@flowgl/core'
import type {
  NodeData,
  EdgeData,
  ViewportState,
  GridConfig,
  MinimapConfig,
  HandleSide,
} from '@flowgl/core'

export interface ConnectParams {
  sourceId: string
  targetId: string
  sourceHandle: HandleSide
  targetHandle: HandleSide
}

export interface FlowchartProps {
  nodes?: NodeData[]
  edges?: EdgeData[]
  onNodesChange?: (nodes: NodeData[]) => void
  onEdgesChange?: (edges: EdgeData[]) => void
  onConnect?: (params: ConnectParams) => void
  onNodeClick?: (node: NodeData) => void
  onNodeAdd?: (node: NodeData) => void
  onNodeRemove?: (id: string) => void
  onNodeUpdate?: (id: string, updates: Partial<NodeData>) => void
  onEdgeAdd?: (edge: EdgeData) => void
  onEdgeRemove?: (id: string) => void
  onEdgeUpdate?: (id: string, updates: Partial<EdgeData>) => void
  onSelectionChange?: (params: { selectedIds: string[]; edgeIds: string[] }) => void
  onViewportChange?: (state: ViewportState) => void
  onInit?: (chart: FlowChart) => void
  style?: CSSProperties
  className?: string
  background?: string
  minimap?: Partial<MinimapConfig>
  grid?: Partial<GridConfig>
  labelEditable?: boolean
  readOnly?: boolean
  historyLimit?: number
  ariaLabel?: string
  onError?: (err: Error) => void
  /**
   * When `true` (default), the wrapper automatically calls `chart.addEdge()` when a
   * connection is drawn. Set to `false` to handle edge creation yourself inside `onConnect`.
   */
  autoConnect?: boolean
}

export const Flowchart = forwardRef<FlowChart | null, FlowchartProps>(
  function Flowchart(props, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const instanceRef  = useRef<FlowChart | null>(null)

    // Track last-synced refs to avoid re-applying changes that originated internally
    const lastNodesRef = useRef<NodeData[] | undefined>(undefined)
    const lastEdgesRef = useRef<EdgeData[] | undefined>(undefined)

    // Stable refs for callbacks — avoids stale closures without re-creating the chart
    const cbRef = useRef({
      onNodesChange:      props.onNodesChange,
      onEdgesChange:      props.onEdgesChange,
      onConnect:          props.onConnect,
      onNodeClick:        props.onNodeClick,
      onNodeAdd:          props.onNodeAdd,
      onNodeRemove:       props.onNodeRemove,
      onNodeUpdate:       props.onNodeUpdate,
      onEdgeAdd:          props.onEdgeAdd,
      onEdgeRemove:       props.onEdgeRemove,
      onEdgeUpdate:       props.onEdgeUpdate,
      onSelectionChange:  props.onSelectionChange,
      onViewportChange:   props.onViewportChange,
      onInit:             props.onInit,
      autoConnect:        props.autoConnect,
    })
    useEffect(() => {
      cbRef.current.onNodesChange     = props.onNodesChange
      cbRef.current.onEdgesChange     = props.onEdgesChange
      cbRef.current.onConnect         = props.onConnect
      cbRef.current.onNodeClick       = props.onNodeClick
      cbRef.current.onNodeAdd         = props.onNodeAdd
      cbRef.current.onNodeRemove      = props.onNodeRemove
      cbRef.current.onNodeUpdate      = props.onNodeUpdate
      cbRef.current.onEdgeAdd         = props.onEdgeAdd
      cbRef.current.onEdgeRemove      = props.onEdgeRemove
      cbRef.current.onEdgeUpdate      = props.onEdgeUpdate
      cbRef.current.onSelectionChange = props.onSelectionChange
      cbRef.current.onViewportChange  = props.onViewportChange
      cbRef.current.autoConnect       = props.autoConnect
    })

    // Create/destroy chart instance
    useLayoutEffect(() => {
      if (!containerRef.current) return

      const chart = new FlowChart({
        container: containerRef.current,
        nodes:     props.nodes ?? [],
        edges:     props.edges ?? [],
        ...(props.background    !== undefined && { background:    props.background    }),
        ...(props.minimap       !== undefined && { minimap:       props.minimap       }),
        ...(props.grid          !== undefined && { grid:          props.grid          }),
        ...(props.labelEditable !== undefined && { labelEditable: props.labelEditable }),
        ...(props.readOnly      !== undefined && { readOnly:      props.readOnly      }),
        ...(props.historyLimit  !== undefined && { historyLimit:  props.historyLimit  }),
        ...(props.ariaLabel     !== undefined && { ariaLabel:     props.ariaLabel     }),
        ...(props.onError       !== undefined && { onError:       props.onError       }),
      })

      lastNodesRef.current = props.nodes
      lastEdgesRef.current = props.edges

      chart.on('nodeDragEnd', () => {
        const nodes = chart.graph.getNodes()
        lastNodesRef.current = nodes
        cbRef.current.onNodesChange?.(nodes)
      })

      chart.on('connect', ({ sourceId, targetId, sourceHandle, targetHandle }) => {
        if (cbRef.current.autoConnect !== false) {
          chart.addEdge({ id: generateId('e'), source: sourceId, target: targetId, sourceHandle, targetHandle })
          const edges = chart.graph.getEdges()
          lastEdgesRef.current = edges
          cbRef.current.onEdgesChange?.(edges)
        }
        cbRef.current.onConnect?.({ sourceId, targetId, sourceHandle, targetHandle })
      })

      chart.on('nodeAdd',        ({ node })         => cbRef.current.onNodeAdd?.(node))
      chart.on('nodeRemove',     ({ id })           => cbRef.current.onNodeRemove?.(id))
      chart.on('nodeUpdate',     ({ id, updates })  => cbRef.current.onNodeUpdate?.(id, updates as Partial<NodeData>))
      chart.on('edgeAdd',        ({ edge })         => cbRef.current.onEdgeAdd?.(edge))
      chart.on('edgeRemove',     ({ id })           => cbRef.current.onEdgeRemove?.(id))
      chart.on('edgeUpdate',     ({ id, updates })  => cbRef.current.onEdgeUpdate?.(id, updates as Partial<EdgeData>))
      chart.on('nodeClick',      ({ node })         => cbRef.current.onNodeClick?.(node))
      chart.on('selectionChange', (params)          => cbRef.current.onSelectionChange?.(params))
      chart.on('viewportChange',  (state)           => cbRef.current.onViewportChange?.(state))

      instanceRef.current = chart
      if (typeof ref === 'function') ref(chart)
      else if (ref) (ref as React.MutableRefObject<FlowChart | null>).current = chart

      cbRef.current.onInit?.(chart)

      return () => {
        chart.dispose()
        instanceRef.current = null
        if (typeof ref === 'function') ref(null)
        else if (ref) (ref as React.MutableRefObject<FlowChart | null>).current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Sync nodes prop → chart (skip when change originated from internal mutation)
    useEffect(() => {
      const chart = instanceRef.current
      if (!chart || props.nodes === lastNodesRef.current) return
      chart.setNodes(props.nodes ?? [])
      lastNodesRef.current = props.nodes
    }, [props.nodes])

    // Sync edges prop → chart
    useEffect(() => {
      const chart = instanceRef.current
      if (!chart || props.edges === lastEdgesRef.current) return
      chart.setEdges(props.edges ?? [])
      lastEdgesRef.current = props.edges
    }, [props.edges])

    // Sync runtime props → chart
    useEffect(() => {
      if (props.readOnly !== undefined) instanceRef.current?.setReadOnly(props.readOnly)
    }, [props.readOnly])

    useEffect(() => {
      if (props.background !== undefined) instanceRef.current?.setBackground(props.background)
    }, [props.background])

    useEffect(() => {
      if (props.grid !== undefined) instanceRef.current?.setGrid(props.grid)
    }, [props.grid])

    useEffect(() => {
      instanceRef.current?.setMinimap(props.minimap ?? null)
    }, [props.minimap])

    return (
      <div
        ref={containerRef}
        className={props.className}
        style={{ position: 'relative', width: '100%', height: '100%', ...props.style }}
      />
    )
  },
)
