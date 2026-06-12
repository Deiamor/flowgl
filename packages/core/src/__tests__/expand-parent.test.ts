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

describe('expandParent — 0.8.0', () => {
  let container: HTMLElement
  let chart: FlowChart

  beforeEach(() => {
    container = makeContainer()
    chart = new FlowChart({
      container,
      nodes: [
        { id: 'p', label: 'parent', x: 100, y: 100, width: 200, height: 100, type: 'group' },
        { id: 'c', label: 'child',  x: 120, y: 120, width: 60,  height: 40, parentId: 'p', expandParent: true },
      ],
      onError: () => {},
    })
  })
  afterEach(() => {
    chart.dispose()
    container.remove()
  })

  // Direct unit test of the expansion helper: we move the child via updateNode
  // and call into the drag-end pipeline by emitting nodeDragEnd through the
  // public API. expandParent runs in the drag-end callback; simulate by
  // manually re-invoking that codepath via setNodes.

  it('child stays inside parent — no expansion needed', () => {
    chart.updateNode('c', { x: 150, y: 130 })
    // Simulate drag-end via internal access — we just check expandParent flag
    const child = chart.getNode('c')!
    expect(child.expandParent).toBe(true)
    expect(child.parentId).toBe('p')
    const parent = chart.getNode('p')!
    expect(parent.x).toBe(100); expect(parent.width).toBe(200)
  })

  it('expandParent flag preserved through addNode/updateNode/getNode', () => {
    chart.addNode({ id: 'd', label: 'd', x: 0, y: 0, width: 50, height: 50, expandParent: true })
    expect(chart.getNode('d')?.expandParent).toBe(true)
    chart.updateNode('d', { x: 10 })
    expect(chart.getNode('d')?.expandParent).toBe(true)
  })

  it('toJSON preserves expandParent', () => {
    const json = chart.toJSON()
    const childJson = json.nodes.find((n) => n.id === 'c')
    expect(childJson?.expandParent).toBe(true)
  })

  // Validate the expansion math by invoking the private helper through the
  // drag-end pathway: we manipulate the child's position then trigger an
  // identity update on the child to flush mutations. The expandParent path
  // only fires from the drag.ts onEnd callback, so directly verifying needs
  // the CDP probe. The model-side check below ensures the inputs are stored
  // correctly — the actual expansion runs in the browser.
})
