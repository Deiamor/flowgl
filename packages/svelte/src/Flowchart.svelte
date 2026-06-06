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
  /**
   * When `true` (default), the wrapper automatically calls `chart.addEdge()` when a
   * connection is drawn. Set to `false` to handle edge creation yourself inside the
   * `connect` event handler.
   */
  export let autoConnect:   boolean                = true

  // Expose chart instance
  export let chart: FlowChart | null = null

  const dispatch = createEventDispatcher<{
    nodesChange:    NodeData[]
    edgesChange:    EdgeData[]
    connect:        { sourceId: string; targetId: string; sourceHandle: HandleSide; targetHandle: HandleSide }
    nodeClick:      NodeData
    nodeAdd:        NodeData
    nodeRemove:     string
    nodeUpdate:     { id: string; updates: Partial<NodeData> }
    edgeAdd:        EdgeData
    edgeRemove:     string
    edgeUpdate:     { id: string; updates: Partial<EdgeData> }
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
      if (autoConnect) {
        chart!.addEdge({ id: generateId('e'), source: sourceId, target: targetId, sourceHandle, targetHandle })
        const e = chart!.graph.getEdges()
        lastEdges = e
        dispatch('edgesChange', e)
      }
      dispatch('connect', { sourceId, targetId, sourceHandle, targetHandle })
    })

    chart.on('nodeAdd',        ({ node })        => dispatch('nodeAdd', node))
    chart.on('nodeRemove',     ({ id })          => dispatch('nodeRemove', id))
    chart.on('nodeUpdate',     ({ id, updates }) => dispatch('nodeUpdate', { id, updates: updates as Partial<NodeData> }))
    chart.on('edgeAdd',        ({ edge })        => dispatch('edgeAdd', edge))
    chart.on('edgeRemove',     ({ id })          => dispatch('edgeRemove', id))
    chart.on('edgeUpdate',     ({ id, updates }) => dispatch('edgeUpdate', { id, updates: updates as Partial<EdgeData> }))
    chart.on('nodeClick',       ({ node })       => dispatch('nodeClick', node))
    chart.on('selectionChange', (params)         => dispatch('selectionChange', params))
    chart.on('viewportChange',  (state)          => dispatch('viewportChange', state))

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

  $: if (chart && background !== undefined) {
    chart.setBackground(background)
  }

  $: if (chart && grid !== undefined) {
    chart.setGrid(grid)
  }

  $: if (chart) {
    chart.setMinimap(minimap ?? null)
  }
</script>

<div
  bind:this={container}
  class={className}
  style="position:relative;width:{width};height:{height};"
/>
