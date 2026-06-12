import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { FlowChart } from '@flowgl/core'
import {
  FlowchartProvider,
  useFlowChart,
  useNodes,
  useEdges,
  useViewport,
  useSelection,
} from '../hooks'

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  Object.defineProperty(div, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
  })
  document.body.appendChild(div)
  return div
}

function makeChart(): { chart: FlowChart; container: HTMLElement } {
  const container = makeContainer()
  const chart = new FlowChart({
    container,
    nodes: [
      { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 50 },
      { id: 'b', label: 'B', x: 200, y: 0, width: 100, height: 50 },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b' }],
    onError: () => {},
  })
  return { chart, container }
}

describe('@flowgl/react hooks — 0.6.0', () => {
  let chart: FlowChart
  let container: HTMLElement

  beforeEach(() => {
    const made = makeChart()
    chart = made.chart
    container = made.container
  })
  afterEach(() => {
    chart.dispose()
    container.remove()
  })

  it('useFlowChart throws when used outside a provider', () => {
    expect(() => renderHook(() => useFlowChart())).toThrow()
  })

  it('useFlowChart returns the chart inside FlowchartProvider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FlowchartProvider value={chart}>{children}</FlowchartProvider>
    )
    const { result } = renderHook(() => useFlowChart(), { wrapper })
    expect(result.current).toBe(chart)
  })

  it('useNodes returns the initial node list', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FlowchartProvider value={chart}>{children}</FlowchartProvider>
    )
    const { result } = renderHook(() => useNodes(), { wrapper })
    expect(result.current.map(n => n.id).sort()).toEqual(['a', 'b'])
  })

  it('useNodes re-renders when a node is added', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FlowchartProvider value={chart}>{children}</FlowchartProvider>
    )
    const { result } = renderHook(() => useNodes(), { wrapper })
    act(() => {
      chart.addNode({ id: 'c', label: 'C', x: 400, y: 0, width: 100, height: 50 })
    })
    expect(result.current.map(n => n.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('useNodes re-renders when a node is removed', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FlowchartProvider value={chart}>{children}</FlowchartProvider>
    )
    const { result } = renderHook(() => useNodes(), { wrapper })
    act(() => { chart.removeNode('a') })
    expect(result.current.map(n => n.id)).toEqual(['b'])
  })

  it('useEdges returns the initial edge list and updates on add', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FlowchartProvider value={chart}>{children}</FlowchartProvider>
    )
    const { result } = renderHook(() => useEdges(), { wrapper })
    expect(result.current.map(e => e.id)).toEqual(['e1'])
    act(() => {
      chart.addEdge({ id: 'e2', source: 'b', target: 'a' })
    })
    expect(result.current.map(e => e.id).sort()).toEqual(['e1', 'e2'])
  })

  it('useViewport returns the initial viewport and updates on setViewport', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FlowchartProvider value={chart}>{children}</FlowchartProvider>
    )
    const { result } = renderHook(() => useViewport(), { wrapper })
    expect(result.current.zoom).toBe(1)
    act(() => {
      chart.setViewport({ ...chart.getViewport(), zoom: 2 })
    })
    expect(result.current.zoom).toBe(2)
  })

  it('useSelection updates when nodes are selected', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FlowchartProvider value={chart}>{children}</FlowchartProvider>
    )
    const { result } = renderHook(() => useSelection(), { wrapper })
    expect(result.current.selectedIds).toEqual([])
    act(() => { chart.setSelectedIds(['a']) })
    expect(result.current.selectedIds).toEqual(['a'])
  })
})
