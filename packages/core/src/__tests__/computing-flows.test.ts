import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FlowChart } from '../flowchart'

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  Object.defineProperty(div, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
  })
  document.body.appendChild(div)
  return div
}

describe('Computing Flows — 0.8.0', () => {
  let container: HTMLElement
  let chart: FlowChart

  beforeEach(() => {
    container = makeContainer()
    chart = new FlowChart({
      container,
      nodes: [
        { id: 'a', label: 'A', x: 0, y: 0, width: 80, height: 50, data: { value: 1 } },
        { id: 'b', label: 'B', x: 200, y: 0, width: 80, height: 50, data: { value: 2 } },
        { id: 'c', label: 'C', x: 400, y: 0, width: 80, height: 50, data: { value: 3 } },
      ],
      onError: () => {},
    })
  })
  afterEach(() => {
    chart.dispose()
    container.remove()
  })

  it('updateNodeData merges into existing data without losing other fields', () => {
    chart.updateNodeData('a', { foo: 'bar' })
    const node = chart.getNode('a')!
    expect(node.data).toEqual({ value: 1, foo: 'bar' })
  })

  it('updateNodeData returns false on unknown id', () => {
    expect(chart.updateNodeData('nope', { x: 1 })).toBe(false)
  })

  it('subscribeNodeData fires on updates and returns an unsubscribe', () => {
    const calls: Array<{ data: Record<string, unknown>; partial: Record<string, unknown> }> = []
    const unsub = chart.subscribeNodeData('a', (data, partial) => calls.push({ data, partial }))
    chart.updateNodeData('a', { v: 10 })
    expect(calls.length).toBe(1)
    expect(calls[0]?.partial).toEqual({ v: 10 })
    expect(calls[0]?.data).toEqual({ value: 1, v: 10 })
    unsub()
    chart.updateNodeData('a', { v: 11 })
    expect(calls.length).toBe(1)
  })

  it('subscriber count tracks add/remove', () => {
    const unsub1 = chart.subscribeNodeData('a', () => {})
    const unsub2 = chart.subscribeNodeData('a', () => {})
    expect(chart.getNodeDataSubscriberCount('a')).toBe(2)
    unsub1()
    expect(chart.getNodeDataSubscriberCount('a')).toBe(1)
    unsub2()
    expect(chart.getNodeDataSubscriberCount('a')).toBe(0)
  })

  it('a→b→c chain: writing to a propagates through both subscribers', () => {
    chart.subscribeNodeData('a', (data) => {
      const v = (data.value as number) * 10
      chart.updateNodeData('b', { value: v })
    })
    chart.subscribeNodeData('b', (data) => {
      const v = (data.value as number) + 1
      chart.updateNodeData('c', { value: v })
    })
    chart.updateNodeData('a', { value: 5 })
    expect(chart.getNode('b')!.data!.value).toBe(50)
    expect(chart.getNode('c')!.data!.value).toBe(51)
  })

  it('cycle detection: a→b→a stops at the cycle and emits nodeDataCycle', () => {
    const cycleEvents: Array<{ id: string; chain: string[] }> = []
    chart.on('nodeDataCycle', (e) => cycleEvents.push(e))
    chart.subscribeNodeData('a', (data) => {
      chart.updateNodeData('b', { fromA: data.value })
    })
    chart.subscribeNodeData('b', (data) => {
      chart.updateNodeData('a', { fromB: data.fromA })
    })
    chart.updateNodeData('a', { value: 'init' })
    expect(cycleEvents.length).toBe(1)
    expect(cycleEvents[0]?.id).toBe('a')
    expect(cycleEvents[0]?.chain).toEqual(['a', 'b', 'a'])
    // The second write to a was vetoed; data still has the initial value.
    expect(chart.getNode('a')!.data).toEqual({ value: 'init' })
  })

  it('self-cycle a→a is detected', () => {
    const cycleEvents: Array<{ id: string; chain: string[] }> = []
    chart.on('nodeDataCycle', (e) => cycleEvents.push(e))
    chart.subscribeNodeData('a', () => {
      chart.updateNodeData('a', { rec: true })
    })
    chart.updateNodeData('a', { go: 1 })
    expect(cycleEvents.length).toBe(1)
    expect(cycleEvents[0]?.chain).toEqual(['a', 'a'])
  })

  it('nodeDataChange fires for the initial write with full data + partial', () => {
    const calls: Array<{ id: string; data: Record<string, unknown>; partial: Record<string, unknown> }> = []
    chart.on('nodeDataChange', (e) => calls.push(e))
    chart.updateNodeData('a', { v: 7 })
    expect(calls.length).toBe(1)
    expect(calls[0]?.id).toBe('a')
    expect(calls[0]?.data).toEqual({ value: 1, v: 7 })
    expect(calls[0]?.partial).toEqual({ v: 7 })
  })

  it('dispose clears all subscribers', () => {
    chart.subscribeNodeData('a', () => {})
    chart.subscribeNodeData('b', () => {})
    expect(chart.getNodeDataSubscriberCount('a')).toBe(1)
    chart.dispose()
    expect(chart.getNodeDataSubscriberCount('a')).toBe(0)
    // Reinit to satisfy afterEach
    chart = new FlowChart({ container, onError: () => {} })
  })

  it('partial undefined values are still merged', () => {
    chart.updateNodeData('a', { skip: undefined })
    const node = chart.getNode('a')!
    expect('skip' in (node.data as object)).toBe(true)
  })
})
