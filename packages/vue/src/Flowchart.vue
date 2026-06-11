<template>
  <div ref="containerRef" :class="props.class" :style="containerStyle" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, shallowRef } from 'vue'
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

const props = withDefaults(defineProps<{
  nodes?:            NodeData[]
  edges?:            EdgeData[]
  background?:       string
  minimap?:          Partial<MinimapConfig>
  grid?:             Partial<GridConfig>
  labelEditable?:    boolean
  readOnly?:         boolean
  historyLimit?:     number
  ariaLabel?:        string
  class?:            string
  style?:            string | Record<string, string>
  width?:            string
  height?:           string
  autoConnect?:      boolean
}>(), {
  nodes:         () => [],
  edges:         () => [],
  width:         '100%',
  height:        '100%',
})

const emit = defineEmits<{
  nodesChange:    [nodes: NodeData[]]
  edgesChange:    [edges: EdgeData[]]
  connect:        [params: ConnectParams]
  nodeClick:      [node: NodeData]
  nodeAdd:        [node: NodeData]
  nodeRemove:     [id: string]
  nodeUpdate:     [id: string, updates: Partial<NodeData>]
  edgeAdd:        [edge: EdgeData]
  edgeRemove:     [id: string]
  edgeUpdate:     [id: string, updates: Partial<EdgeData>]
  selectionChange:[params: { selectedIds: string[]; edgeIds: string[] }]
  viewportChange: [state: ViewportState]
  init:           [chart: FlowChart]
  error:          [err: Error]
}>()

const containerRef = shallowRef<HTMLDivElement | null>(null)
const chartRef     = shallowRef<FlowChart | null>(null)

// Expose chart instance via defineExpose
defineExpose({ chart: chartRef })

const containerStyle = computed(() => ({
  position: 'relative' as const,
  width:    props.width,
  height:   props.height,
  ...(typeof props.style === 'object' ? props.style : {}),
}))

// Track last-applied values to avoid echoing internal mutations back
let lastNodes: NodeData[] | undefined
let lastEdges: EdgeData[] | undefined

onMounted(() => {
  if (!containerRef.value) return

  const options: FlowChartOptions = {
    container: containerRef.value,
    nodes:     props.nodes,
    edges:     props.edges,
  }
  if (props.background    !== undefined) options.background    = props.background
  if (props.minimap       !== undefined) options.minimap       = props.minimap
  if (props.grid          !== undefined) options.grid          = props.grid
  if (props.labelEditable !== undefined) options.labelEditable = props.labelEditable
  if (props.readOnly      !== undefined) options.readOnly      = props.readOnly
  if (props.historyLimit  !== undefined) options.historyLimit  = props.historyLimit
  if (props.ariaLabel     !== undefined) options.ariaLabel     = props.ariaLabel
  options.onError = (err) => emit('error', err)

  const chart = new FlowChart(options)
  lastNodes = props.nodes
  lastEdges = props.edges

  chart.on('nodeDragEnd', () => {
    const nodes = chart.getNodes()
    lastNodes = nodes
    emit('nodesChange', nodes)
  })

  chart.on('connect', ({ sourceId, targetId, sourceHandle, targetHandle }) => {
    if (props.autoConnect !== false) {
      chart.addEdge({ id: generateId('e'), source: sourceId, target: targetId, sourceHandle, targetHandle })
      const edges = chart.getEdges()
      lastEdges = edges
      emit('edgesChange', edges)
    }
    emit('connect', { sourceId, targetId, sourceHandle, targetHandle })
  })

  chart.on('nodeAdd',        ({ node })            => emit('nodeAdd', node))
  chart.on('nodeRemove',     ({ id })              => emit('nodeRemove', id))
  chart.on('nodeUpdate',     ({ id, updates })     => emit('nodeUpdate', id, updates as Partial<NodeData>))
  chart.on('edgeAdd',        ({ edge })            => emit('edgeAdd', edge))
  chart.on('edgeRemove',     ({ id })              => emit('edgeRemove', id))
  chart.on('edgeUpdate',     ({ id, updates })     => emit('edgeUpdate', id, updates as Partial<EdgeData>))
  chart.on('nodeClick',       ({ node })           => emit('nodeClick', node))
  chart.on('selectionChange', (params)             => emit('selectionChange', params))
  chart.on('viewportChange',  (state)              => emit('viewportChange', state))

  chartRef.value = chart
  emit('init', chart)
})

onUnmounted(() => {
  chartRef.value?.dispose()
  chartRef.value = null
})

watch(() => props.nodes, (nodes) => {
  const chart = chartRef.value
  if (!chart || nodes === lastNodes) return
  chart.setNodes(nodes ?? [])
  lastNodes = nodes
})

watch(() => props.edges, (edges) => {
  const chart = chartRef.value
  if (!chart || edges === lastEdges) return
  chart.setEdges(edges ?? [])
  lastEdges = edges
})

watch(() => props.readOnly, (v) => {
  if (v !== undefined) chartRef.value?.setReadOnly(v)
})

watch(() => props.background, (v) => {
  if (v !== undefined) chartRef.value?.setBackground(v)
})

watch(() => props.grid, (v) => {
  if (v !== undefined) chartRef.value?.setGrid(v)
}, { deep: true })

watch(() => props.minimap, (v) => {
  chartRef.value?.setMinimap(v ?? null)
}, { deep: true })
</script>
