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

// happy-dom's canvas getBoundingClientRect + WebGL-failed init make pointer
// coordinate arithmetic brittle for connect-drag, so this file pins the
// *storage* contract — easyConnect is preserved on the node, addressable via
// updateNode, and listed back through getNodes / getNode. Visual hit-area
// verification lives in the 0.6.0 CDP probe.

describe('Easy Connect — 0.6.0 storage', () => {
  let container: HTMLElement
  let chart: FlowChart

  beforeEach(() => {
    container = makeContainer()
    chart = new FlowChart({
      container,
      nodes: [
        { id: 'a', label: 'A', x: 0, y: 0, width: 100, height: 80 },
        { id: 'b', label: 'B', x: 200, y: 0, width: 100, height: 80, easyConnect: true },
      ],
      onError: () => {},
    })
  })
  afterEach(() => {
    chart.dispose()
    container.remove()
  })

  it('easyConnect flag is preserved through initial construct', () => {
    expect(chart.getNode('b')?.easyConnect).toBe(true)
    expect(chart.getNode('a')?.easyConnect).toBeUndefined()
  })

  it('addNode with easyConnect: true preserves the flag', () => {
    chart.addNode({ id: 'c', label: 'C', x: 400, y: 0, width: 80, height: 80, easyConnect: true })
    expect(chart.getNode('c')?.easyConnect).toBe(true)
  })

  it('updateNode can flip easyConnect on at runtime', () => {
    expect(chart.getNode('a')?.easyConnect).toBeUndefined()
    chart.updateNode('a', { easyConnect: true })
    expect(chart.getNode('a')?.easyConnect).toBe(true)
  })

  it('getNodes preserves the flag', () => {
    const nodes = chart.getNodes()
    const b = nodes.find(n => n.id === 'b')
    expect(b?.easyConnect).toBe(true)
  })

  it('toJSON preserves easyConnect on the serialised snapshot', () => {
    const snap = chart.toJSON()
    expect(snap.nodes.find(n => n.id === 'b')?.easyConnect).toBe(true)
  })
})
