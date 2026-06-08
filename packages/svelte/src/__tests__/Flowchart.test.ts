import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { tick } from 'svelte'
import Flowchart from '../Flowchart.svelte'

type MockChart = {
  options:      Record<string, unknown>
  handlers:     Record<string, ((...args: unknown[]) => void)[]>
  graph:        { getNodes: ReturnType<typeof vi.fn>; getEdges: ReturnType<typeof vi.fn> }
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

const nodes = [{ id: 'n1', x: 0, y: 0, label: 'Node 1' }]
const edges = [{ id: 'e1', source: 'n1', target: 'n1' }]

beforeEach(() => {
  mockState.instances.length = 0
  mockState.lastChart = null
  cleanup()
})

describe('Flowchart (Svelte)', () => {
  it('FlowChart constructor called on mount', async () => {
    render(Flowchart)
    await tick()
    expect(mockState.instances).toHaveLength(1)
  })

  it('dispose() called on unmount', async () => {
    const { unmount } = render(Flowchart)
    await tick()
    const chart = mockState.lastChart!
    unmount()
    expect(chart.dispose).toHaveBeenCalledOnce()
  })

  it('chart instance is created after mount (init dispatched)', async () => {
    render(Flowchart)
    await tick()
    expect(mockState.lastChart).not.toBeNull()
  })

  it('initial nodes and edges passed to constructor', async () => {
    render(Flowchart, { props: { nodes, edges } })
    await tick()
    const { options } = mockState.lastChart!
    expect(options.nodes).toBe(nodes)
    expect(options.edges).toBe(edges)
  })

  it('nodes prop change → chart.setNodes()', async () => {
    const { component } = render(Flowchart, { props: { nodes } })
    await tick()
    const chart = mockState.lastChart!
    const newNodes = [{ id: 'n2', x: 10, y: 10, label: 'Node 2' }]
    await component.$set({ nodes: newNodes })
    await tick()
    expect(chart.setNodes).toHaveBeenCalledWith(newNodes)
  })

  it('edges prop change → chart.setEdges()', async () => {
    const { component } = render(Flowchart, { props: { edges } })
    await tick()
    const chart = mockState.lastChart!
    const newEdges = [{ id: 'e2', source: 'n1', target: 'n1' }]
    await component.$set({ edges: newEdges })
    await tick()
    expect(chart.setEdges).toHaveBeenCalledWith(newEdges)
  })

  it('readOnly prop change → chart.setReadOnly()', async () => {
    const { component } = render(Flowchart, { props: { readOnly: false } })
    await tick()
    const chart = mockState.lastChart!
    await component.$set({ readOnly: true })
    await tick()
    expect(chart.setReadOnly).toHaveBeenCalledWith(true)
  })

  it('autoConnect=true: addEdge called on connect event', async () => {
    render(Flowchart, { props: { autoConnect: true } })
    await tick()
    const chart = mockState.lastChart!
    chart.emit('connect', {
      sourceId: 'n1', targetId: 'n2',
      sourceHandle: 'right', targetHandle: 'left',
    })
    expect(chart.addEdge).toHaveBeenCalledOnce()
  })

  it('autoConnect=false: addEdge NOT called on connect event', async () => {
    render(Flowchart, { props: { autoConnect: false } })
    await tick()
    const chart = mockState.lastChart!
    chart.emit('connect', {
      sourceId: 'n1', targetId: 'n2',
      sourceHandle: 'right', targetHandle: 'left',
    })
    expect(chart.addEdge).not.toHaveBeenCalled()
  })
})
