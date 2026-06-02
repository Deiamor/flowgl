import { describe, it, expect } from 'vitest'
import { handleXY } from '../renderer/webgl/util/handle-xy'
import type { NodeData } from '../graph/node'

function nd(x = 0, y = 0, w = 100, h = 50, extra: Partial<NodeData> = {}): NodeData {
  return { id: 'n', label: 'n', x, y, width: w, height: h, ...extra }
}

describe('handleXY — standard sides', () => {
  const node = nd(10, 20, 100, 60)
  const cx = 10 + 100 / 2   // 60
  const cy = 20 + 60  / 2   // 50

  it('right (default)', () => {
    expect(handleXY(node, 'right')).toEqual([110, cy])
  })

  it('left', () => {
    expect(handleXY(node, 'left')).toEqual([10, cy])
  })

  it('top', () => {
    expect(handleXY(node, 'top')).toEqual([cx, 20])
  })

  it('bottom', () => {
    expect(handleXY(node, 'bottom')).toEqual([cx, 80])
  })

  it('undefined side → right handle', () => {
    expect(handleXY(node, undefined)).toEqual([110, cy])
  })

  it('unknown string side → right handle (default)', () => {
    expect(handleXY(node, 'center')).toEqual([110, cy])
  })
})

describe('handleXY — named ports', () => {
  const node = nd(0, 0, 200, 100, {
    ports: [
      { id: 'out-top',    side: 'top',    offset: 0.25 },
      { id: 'out-right',  side: 'right',  offset: 0.5  },
      { id: 'out-bottom', side: 'bottom', offset: 0.75 },
      { id: 'out-left',   side: 'left',   offset: 0.1  },
    ],
  })

  it('top port at offset 0.25', () => {
    expect(handleXY(node, 'out-top')).toEqual([200 * 0.25, 0])
  })

  it('right port at offset 0.5 (center)', () => {
    expect(handleXY(node, 'out-right')).toEqual([200, 100 * 0.5])
  })

  it('bottom port at offset 0.75', () => {
    expect(handleXY(node, 'out-bottom')).toEqual([200 * 0.75, 100])
  })

  it('left port at offset 0.1', () => {
    expect(handleXY(node, 'out-left')).toEqual([0, 100 * 0.1])
  })

  it('port with offset=0 → flush to start', () => {
    const n = nd(0, 0, 100, 50, { ports: [{ id: 'p', side: 'top', offset: 0 }] })
    expect(handleXY(n, 'p')).toEqual([0, 0])
  })

  it('port with offset=1 → flush to end', () => {
    const n = nd(0, 0, 100, 50, { ports: [{ id: 'p', side: 'bottom', offset: 1 }] })
    expect(handleXY(n, 'p')).toEqual([100, 50])
  })

  it('port with offset undefined → defaults to 0.5 (center)', () => {
    const n = nd(0, 0, 100, 50, { ports: [{ id: 'p', side: 'left' }] })
    const [x, y] = handleXY(n, 'p')
    expect(x).toBe(0)
    expect(y).toBeCloseTo(25)
  })

  it('unknown port id falls through to standard handle lookup', () => {
    // 'unknown-port' not in ports list → falls through to switch(side) → hits default → right
    const [x, y] = handleXY(node, 'unknown-port')
    expect(x).toBe(200)          // right edge
    expect(y).toBeCloseTo(50)    // center y
  })

  it('no ports on node → standard handles used', () => {
    const plain = nd(0, 0, 100, 50)
    expect(handleXY(plain, 'top')).toEqual([50, 0])
  })

  it('empty ports array → standard handles used', () => {
    const n = nd(0, 0, 100, 50, { ports: [] })
    expect(handleXY(n, 'left')).toEqual([0, 25])
  })
})

describe('handleXY — zero-size node', () => {
  it('zero-width node: left and right at same x', () => {
    const n = nd(50, 50, 0, 0)
    const [lx] = handleXY(n, 'left')
    const [rx] = handleXY(n, 'right')
    expect(lx).toBe(50)
    expect(rx).toBe(50)
  })

  it('zero-height node: top and bottom at same y', () => {
    const n = nd(50, 50, 100, 0)
    const [, ty] = handleXY(n, 'top')
    const [, by] = handleXY(n, 'bottom')
    expect(ty).toBe(50)
    expect(by).toBe(50)
  })

  it('zero-size node: all positions finite', () => {
    const n = nd(100, 100, 0, 0)
    for (const side of ['left', 'right', 'top', 'bottom', undefined] as const) {
      const [x, y] = handleXY(n, side)
      expect(isFinite(x)).toBe(true)
      expect(isFinite(y)).toBe(true)
    }
  })
})

describe('handleXY — port with invalid side (known fallthrough behavior)', () => {
  it('port found but side unrecognized → falls through to default right handle', () => {
    // This documents current behavior: if port.side is an unknown value, the inner
    // switch has no match so execution falls through to the outer switch(side).
    // The outer switch receives the port *id* (not a standard side name) → hits default → right.
    const n = nd(0, 0, 200, 100, {
      ports: [{ id: 'my-port', side: 'center' as any }],
    })
    const [x, y] = handleXY(n, 'my-port')
    expect(x).toBe(200)          // right edge (default)
    expect(y).toBeCloseTo(50)    // center y
  })
})
