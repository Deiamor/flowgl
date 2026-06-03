<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte'
  import { FlowChart, generateId } from '@flowgl/core'
  import type {
    NodeData,
    EdgeData,
    ViewportState,
    GridConfig,
    MinimapConfig,
    HandleSide,
    FlowChartOptions,
  } from '@flowgl/core'

  export interface ConnectParams {
    sourceId:     string
    targetId:     string
    sourceHandle: HandleSide
    targetHandle: HandleSide
  }

  // Props
  export let nodes:         NodeData[]             = []
  export let edges:         EdgeData[]             = []
  export let background:    string | undefined     = undefined
  export let minimap:       Partial<MinimapConfig> | undefined = undefined
  export let grid:          Partial<GridConfig>    | undefined = undefined
  export let labelEditable: boolean | undefined    = undefined
  export let readOnly:      boolean | undefined    = undefined
  export let historyLimit:  number  | undefined    = undefined
  export let ariaLabel:     string  | undefined    = undefined
  export let width:         string                 = '100%'
  export let height:        string                 = '100%'
  export let className:     string                 = ''

  // Expose chart instance
  export let chart: FlowChart | null = null

  const dispatch = createEventDispatcher<{
    nodesChange:    NodeData[]
    edgesChange:    EdgeData[]
    connect:        ConnectParams
    nodeClick:      NodeData
    selectionChange:{ selectedIds: string[]; edgeIds: string[] }
    viewportChange: ViewportState
    init:           FlowChart
    error:          Error
  }>()

  let container: HTMLDivElement
  let lastNodes: NodeData[] | undefined
  let lastEdges: EdgeData[] | undefined

  onMount(() => {
    const options: FlowChartOptions = { container, nodes, edges }
    if (background    !== undefined) options.background    = background
    if (minimap       !== undefined) options.minimap       = minimap
    if (grid          !== undefined) options.grid          = grid
    if (labelEditable !== undefined) options.labelEditable = labelEditable
    if (readOnly      !== undefined) options.readOnly      = readOnly
    if (historyLimit  !== undefined) options.historyLimit  = historyLimit
    if (ariaLabel     !== undefined) options.ariaLabel     = ariaLabel
    options.onError = (err) => dispatch('error', err)

    chart = new FlowChart(options)
    lastNodes = nodes
    lastEdges = edges

    chart.on('nodeDragEnd', () => {
      const n = chart!.graph.getNodes()
      lastNodes = n
      dispatch('nodesChange', n)
    })

    chart.on('connect', ({ sourceId, targetId, sourceHandle, targetHandle }) => {
      chart!.addEdge({ id: generateId('e'), source: sourceId, target: targetId, sourceHandle, targetHandle })
      const e = chart!.graph.getEdges()
      lastEdges = e
      dispatch('edgesChange', e)
      dispatch('connect', { sourceId, targetId, sourceHandle, targetHandle })
    })

    chart.on('nodeClick',       ({ node }) => dispatch('nodeClick', node))
    chart.on('selectionChange', (params)  => dispatch('selectionChange', params))
    chart.on('viewportChange',  (state)   => dispatch('viewportChange', state))

    dispatch('init', chart)
  })

  onDestroy(() => {
    chart?.dispose()
    chart = null
  })

  // Reactive sync
  $: if (chart && nodes !== lastNodes) {
    chart.setNodes(nodes)
    lastNodes = nodes
  }

  $: if (chart && edges !== lastEdges) {
    chart.setEdges(edges)
    lastEdges = edges
  }

  $: if (chart && readOnly !== undefined) {
    chart.setReadOnly(readOnly)
  }
</script>

<div
  bind:this={container}
  class={className}
  style="position:relative;width:{width};height:{height};"
/>
