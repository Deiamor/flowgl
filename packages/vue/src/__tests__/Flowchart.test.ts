import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Flowchart from '../Flowchart.vue'

type MockChart = {
  options:      Record<string, unknown>
  handlers:     Record<string, ((...args: unknown[]) => void)[]>
  graph:        { getNodes: ReturnType<typeof vi.fn>; getEdges: ReturnType<typeof vi.fn> }
  getNodes:     ReturnType<typeof vi.fn>
  getEdges:     ReturnType<typeof vi.fn>
  setNodes:     ReturnType<typeof vi.fn>
  setEdges:     ReturnType<typeof vi.fn>
  setReadOnly:  ReturnType<typeof vi.fn>
  setBackground:ReturnType<typeof vi.fn>
  setGrid:      ReturnType<typeof vi.fn>
  setMinimap:   ReturnType<typeof vi.fn>
  addEdge:      ReturnType<typeof vi.fn>
  dispose:      ReturnType<typeof vi.fn>
  on:           (event: string, handler: (...args: unknown[]) => void) => void
  emit:         (event: string, ...args: unknown[]) => void
}

const { mockState, MockChart } = vi.hoisted(() => {
  const mockState = {
    instances: [] as MockChart[],
    lastChart: null as MockChart | null,
  }

  function MockChart(this: MockChart, options: Record<string, unknown>) {
    this.options       = options
    this.handlers      = {}
    this.graph         = { getNodes: vi.fn(() => []), getEdges: vi.fn(() => []) }
    this.getNodes      = vi.fn(() => [])
    this.getEdges      = vi.fn(() => [])
    this.setNodes      = vi.fn()
    this.setEdges      = vi.fn()
    this.setReadOnly   = vi.fn()
    this.setBackground = vi.fn()
    this.setGrid       = vi.fn()
    this.setMinimap    = vi.fn()
    this.addEdge       = vi.fn()
    this.dispose       = vi.fn()
    mockState.instances.push(this)
    mockState.lastChart = this
  }

  MockChart.prototype.on = function(event: string, handler: (...args: unknown[]) => void) {
    if (!this.handlers[event]) this.handlers[event] = []
    this.handlers[event].push(handler)
  }

  MockChart.prototype.emit = function(event: string, ...args: unknown[]) {
    this.handlers[event]?.forEach((h: (...a: unknown[]) => void) => h(...args))
  }

  return { mockState, MockChart }
})

vi.mock('@flowgl/core', () => ({
  FlowChart:  MockChart,
  generateId: (prefix: string) => `${prefix}-test-id`,
}))

const nodes = [{ id: 'n1', x: 0, y: 0, width: 120, height: 40, label: 'Node 1' }]
const edges = [{ id: 'e1', source: 'n1', target: 'n1' }]

beforeEach(() => {
  mockState.instances.length = 0
  mockState.lastChart = null
})

describe('Flowchart (Vue)', () => {
  it('FlowChart constructor called on mount', () => {
    mount(Flowchart)
    expect(mockState.instances).toHaveLength(1)
  })

  it('dispose() called on unmount', () => {
    const wrapper = mount(Flowchart)
    const chart = mockState.lastChart!
    wrapper.unmount()
    expect(chart.dispose).toHaveBeenCalledOnce()
  })

  it('init event emitted with chart instance', () => {
    const wrapper = mount(Flowchart)
    expect(wrapper.emitted('init')).toHaveLength(1)
    expect(wrapper.emitted('init')![0][0]).toBe(mockState.lastChart)
  })

  it('initial nodes and edges passed to constructor', () => {
    mount(Flowchart, { props: { nodes, edges } })
    const { options } = mockState.lastChart!
    expect(options.nodes).toStrictEqual(nodes)
    expect(options.edges).toStrictEqual(edges)
  })

  it('nodes prop change → chart.setNodes()', async () => {
    const wrapper = mount(Flowchart, { props: { nodes } })
    const chart = mockState.lastChart!
    const newNodes = [{ id: 'n2', x: 10, y: 10, width: 120, height: 40, label: 'Node 2' }]
    await wrapper.setProps({ nodes: newNodes })
    await nextTick()
    expect(chart.setNodes).toHaveBeenCalledWith(newNodes)
  })

  it('edges prop change → chart.setEdges()', async () => {
    const wrapper = mount(Flowchart, { props: { edges } })
    const chart = mockState.lastChart!
    const newEdges = [{ id: 'e2', source: 'n1', target: 'n1' }]
    await wrapper.setProps({ edges: newEdges })
    await nextTick()
    expect(chart.setEdges).toHaveBeenCalledWith(newEdges)
  })

  it('readOnly prop change → chart.setReadOnly()', async () => {
    const wrapper = mount(Flowchart, { props: { readOnly: false } })
    const chart = mockState.lastChart!
    await wrapper.setProps({ readOnly: true })
    await nextTick()
    expect(chart.setReadOnly).toHaveBeenCalledWith(true)
  })

  it('autoConnect=true: addEdge called on connect event', () => {
    mount(Flowchart, { props: { autoConnect: true } })
    const chart = mockState.lastChart!
    chart.emit('connect', {
      sourceId: 'n1', targetId: 'n2',
      sourceHandle: 'right', targetHandle: 'left',
    })
    expect(chart.addEdge).toHaveBeenCalledOnce()
  })

  it('autoConnect=false: addEdge NOT called on connect event', () => {
    mount(Flowchart, { props: { autoConnect: false } })
    const chart = mockState.lastChart!
    chart.emit('connect', {
      sourceId: 'n1', targetId: 'n2',
      sourceHandle: 'right', targetHandle: 'left',
    })
    expect(chart.addEdge).not.toHaveBeenCalled()
  })
})
