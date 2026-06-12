import { createContext, useContext, useEffect, useState } from 'react'
import type { FlowChart, NodeData, EdgeData, ViewportState } from '@flowgl/core'

const ChartContext = createContext<FlowChart | null>(null)

/**
 * Provider that exposes a `FlowChart` instance to descendant hooks. The
 * built-in `<Flowchart>` component wires this automatically — you only need
 * `<FlowchartProvider>` directly when you manage the chart instance yourself.
 */
export const FlowchartProvider = ChartContext.Provider

/**
 * Returns the `FlowChart` instance from the nearest provider. Throws when
 * used outside a `<Flowchart>` or explicit `<FlowchartProvider>` boundary.
 */
export function useFlowChart(): FlowChart {
  const c = useContext(ChartContext)
  if (!c) throw new Error('useFlowChart must be called inside a <Flowchart> or <FlowchartProvider>')
  return c
}

/**
 * Subscribes to the chart's node list. Re-renders when nodes are added,
 * removed, updated, dragged to a new position, or resized. Wraps the same
 * subscribe pattern React Flow exposes via `useNodes()`.
 */
export function useNodes(): NodeData[] {
  const chart = useFlowChart()
  const [nodes, setNodes] = useState<NodeData[]>(() => chart.getNodes())
  useEffect(() => {
    const update = (): void => setNodes(chart.getNodes())
    chart.on('nodeAdd',    update)
    chart.on('nodeRemove', update)
    chart.on('nodeUpdate', update)
    chart.on('nodeDragEnd', update)
    chart.on('nodeResize', update)
    return () => {
      chart.off('nodeAdd',    update)
      chart.off('nodeRemove', update)
      chart.off('nodeUpdate', update)
      chart.off('nodeDragEnd', update)
      chart.off('nodeResize', update)
    }
  }, [chart])
  return nodes
}

/** Subscribes to the chart's edge list. */
export function useEdges(): EdgeData[] {
  const chart = useFlowChart()
  const [edges, setEdges] = useState<EdgeData[]>(() => chart.getEdges())
  useEffect(() => {
    const update = (): void => setEdges(chart.getEdges())
    chart.on('edgeAdd',    update)
    chart.on('edgeRemove', update)
    chart.on('edgeUpdate', update)
    return () => {
      chart.off('edgeAdd',    update)
      chart.off('edgeRemove', update)
      chart.off('edgeUpdate', update)
    }
  }, [chart])
  return edges
}

/** Subscribes to the chart's viewport (pan + zoom). */
export function useViewport(): ViewportState {
  const chart = useFlowChart()
  const [viewport, setViewport] = useState<ViewportState>(() => chart.getViewport())
  useEffect(() => {
    const update = (state: ViewportState): void => setViewport({ ...state })
    chart.on('viewportChange', update)
    return () => { chart.off('viewportChange', update) }
  }, [chart])
  return viewport
}

/** Subscribes to the chart's current selection (nodes + edges). */
export function useSelection(): { selectedIds: string[]; edgeIds: string[] } {
  const chart = useFlowChart()
  const [sel, setSel] = useState<{ selectedIds: string[]; edgeIds: string[] }>(() => ({
    selectedIds: chart.getSelectedIds(),
    edgeIds:     chart.getSelectedEdgeIds(),
  }))
  useEffect(() => {
    const update = (payload: { selectedIds: string[]; edgeIds: string[] }): void => {
      setSel({ selectedIds: [...payload.selectedIds], edgeIds: [...payload.edgeIds] })
    }
    chart.on('selectionChange', update)
    return () => { chart.off('selectionChange', update) }
  }, [chart])
  return sel
}
