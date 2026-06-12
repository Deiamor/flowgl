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

/**
 * 0.8.2 regression suite — every path that mutates a node or an edge must
 * emit `nodeUpdate` / `edgeUpdate`, irrespective of which call site
 * triggered the mutation. Pre-fix, ~14 internal call sites went through
 * `graph.updateNode` / `graph.updateEdge` directly and skipped the emit,
 * so host apps wiring React state / persistence / undo middleware silently
 * lost the change.
 *
 * The fix routes every mutation through `Graph.setMutationListener`. These
 * tests pin that contract — once they pass, the BLOCKER class is closed.
 */

describe('Graph mutation listener — every mutation emits an event (0.8.2 gate)', () => {
  let container: HTMLElement
  let chart: FlowChart
  let nodeUpdates: Array<{ id: string; updates: Record<string, unknown> }>
  let edgeUpdates: Array<{ id: string; updates: Record<string, unknown> }>

  beforeEach(() => {
    container = makeContainer()
    chart = new FlowChart({
      container,
      nodes: [
        { id: 'a', label: 'A', x: 0,   y: 0,   width: 100, height: 50, style: { backgroundColor: '#fff' } },
        { id: 'b', label: 'B', x: 200, y: 0,   width: 100, height: 50 },
        { id: 'c', label: 'C', x: 400, y: 0,   width: 100, height: 50 },
        { id: 'g', label: 'g', x: 0,   y: 100, width: 300, height: 200, type: 'group' },
        { id: 'gc', label: 'gc', x: 30, y: 130, width: 60, height: 40, parentId: 'g' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
      onError: () => {},
    })
    nodeUpdates = []
    edgeUpdates = []
    chart.on('nodeUpdate', (e) => nodeUpdates.push(e))
    chart.on('edgeUpdate', (e) => edgeUpdates.push(e))
  })
  afterEach(() => {
    chart.dispose()
    container.remove()
  })

  it('setNodeStyle emits nodeUpdate', () => {
    chart.setNodeStyle('a', { borderColor: '#f00' })
    expect(nodeUpdates.length).toBe(1)
    expect(nodeUpdates[0]?.id).toBe('a')
    expect((nodeUpdates[0]?.updates as { style?: unknown }).style).toBeDefined()
  })

  it('lockNode + unlockNode each emit nodeUpdate', () => {
    chart.lockNode('a')
    chart.unlockNode('a')
    expect(nodeUpdates.length).toBe(2)
    expect((nodeUpdates[0]?.updates as { locked?: boolean }).locked).toBe(true)
    expect((nodeUpdates[1]?.updates as { locked?: boolean }).locked).toBe(false)
  })

  it('setNodeSize emits nodeUpdate', () => {
    chart.setNodeSize('a', 150, 75)
    expect(nodeUpdates.length).toBe(1)
    expect((nodeUpdates[0]?.updates as { width?: number; height?: number }).width).toBe(150)
  })

  it('setNodeStatus emits nodeUpdate', () => {
    chart.setNodeStatus('a', 'error')
    expect(nodeUpdates.length).toBe(1)
    expect((nodeUpdates[0]?.updates as { status?: string }).status).toBe('error')
  })

  it('collapseNode + expandNode each emit nodeUpdate', () => {
    chart.collapseNode('g')
    expect(nodeUpdates.length).toBe(1)
    chart.expandNode('g')
    expect(nodeUpdates.length).toBe(2)
  })

  it('groupNodes emits nodeUpdate for every reparented child', () => {
    chart.groupNodes('g', ['b', 'c'])
    const reparented = nodeUpdates.filter((e) => (e.updates as { parentId?: string }).parentId !== undefined)
    expect(reparented.length).toBe(2)
    expect(reparented.map((e) => e.id).sort()).toEqual(['b', 'c'])
  })

  it('updateEdge emits exactly one edgeUpdate (no double-fire)', () => {
    chart.updateEdge('e1', { label: 'hello' })
    expect(edgeUpdates.length).toBe(1)
    expect(edgeUpdates[0]?.id).toBe('e1')
  })

  it('swapEdgeDirection emits exactly one edgeUpdate', () => {
    chart.swapEdgeDirection('e1')
    expect(edgeUpdates.length).toBe(1)
    expect((edgeUpdates[0]?.updates as { source?: string }).source).toBe('b')
    expect((edgeUpdates[0]?.updates as { target?: string }).target).toBe('a')
  })

  it('updateNode emits exactly one nodeUpdate', () => {
    chart.updateNode('a', { label: 'A!' })
    expect(nodeUpdates.length).toBe(1)
  })

  it('updateNodeData merges into data and emits nodeUpdate', () => {
    chart.updateNodeData('a', { foo: 'bar' })
    // updateNodeData calls graph.updateNode({ data: ... }) under the hood
    expect(nodeUpdates.length).toBe(1)
    expect((nodeUpdates[0]?.updates as { data?: Record<string, unknown> }).data?.foo).toBe('bar')
  })

  it('updateNode with parentId change emits nodeUpdate', () => {
    chart.updateNode('gc', { parentId: 'g' })
    expect(nodeUpdates.length).toBe(1)
    expect(nodeUpdates[0]?.id).toBe('gc')
  })
})
