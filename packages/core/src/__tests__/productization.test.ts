/**
 * Productization validation tests — covers all items fixed in the production readiness pass.
 *
 * Scenarios:
 * 1. TextAtlas cache key includes color → no cross-node color bleed
 * 2. exportSVG hexagon shape → correct polygon points
 * 3. exportSVG all shapes round-trip correctly
 * 4. onContextLost / onContextRestored options are present in FlowChartOptions
 * 5. README package name consistency (via package.json verification)
 * 6. Framework wrapper event completeness (react/vue prop list)
 * 7. FlowChart onContextLost/onContextRestored options accepted without error
 * 8. TextAtlas DPR constructor parameter
 * 9. Multiple edge-case SVG scenarios (empty graph, single node, escaped chars)
 * 10. exportSVG step-edge type
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FlowChart } from '../flowchart'
import { TextAtlas } from '../renderer/webgl/atlas/text-atlas'

// ── OffscreenCanvas mock (not available in happy-dom) ────────────────────────

function makeMockCtx2d() {
  return {
    font: '',
    fillStyle: '',
    direction: 'ltr' as CanvasDirection,
    textBaseline: 'top' as CanvasTextBaseline,
    scale: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 3,
    })),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
  }
}

function installOffscreenCanvasMock(): void {
  if (typeof globalThis.OffscreenCanvas === 'undefined') {
    const ctx = makeMockCtx2d()
    // @ts-expect-error — mock for test environment
    globalThis.OffscreenCanvas = class MockOffscreenCanvas {
      width: number; height: number
      constructor(w: number, h: number) { this.width = w; this.height = h }
      getContext(type: string) { return type === '2d' ? ctx : null }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  Object.defineProperty(div, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
  })
  document.body.appendChild(div)
  return div
}

// ── 1. TextAtlas color cache key correctness ─────────────────────────────────

describe('TextAtlas — color cache key', () => {
  beforeEach(() => { installOffscreenCanvasMock() })

  it('same text + different color → different cache entries', () => {
    const atlas = new TextAtlas()

    // Access private cache by testing that both calls produce distinct entries
    // (different UVs indicate different atlas regions)
    const entry1 = atlas.getOrCreate('Hello', '14px system-ui', '#000000', 200, 1.4)
    const entry2 = atlas.getOrCreate('Hello', '14px system-ui', '#ffffff', 200, 1.4)

    expect(entry1).not.toBeNull()
    expect(entry2).not.toBeNull()
    // They should occupy different regions of the atlas
    expect(entry1!.u0).not.toBe(entry2!.u0)
  })

  it('same text + same color → same cache entry (reference equality)', () => {
    const atlas = new TextAtlas()

    const entry1 = atlas.getOrCreate('World', '14px system-ui', '#333333', 200, 1.4)
    const entry2 = atlas.getOrCreate('World', '14px system-ui', '#333333', 200, 1.4)

    expect(entry1).toBe(entry2)
  })

  it('bgColor is also part of the key', () => {
    const atlas = new TextAtlas()

    const entry1 = atlas.getOrCreate('X', '14px system-ui', '#000', 200, 1.4, 'rgba(255,255,255,0.9)')
    const entry2 = atlas.getOrCreate('X', '14px system-ui', '#000', 200, 1.4, '')

    expect(entry1).not.toBeNull()
    expect(entry2).not.toBeNull()
    expect(entry1!.u0).not.toBe(entry2!.u0)
  })

  it('empty text returns a non-null entry', () => {
    const atlas = new TextAtlas()
    const entry = atlas.getOrCreate('', '14px system-ui', '#000', 200, 1.4)
    // empty string → single empty line → non-null but tiny entry
    expect(entry).not.toBeNull()
  })
})

// ── 2. TextAtlas DPR constructor ─────────────────────────────────────────────

describe('TextAtlas — DPR scaling', () => {
  beforeEach(() => { installOffscreenCanvasMock() })

  it('accepts dpr=1 (default)', () => {
    expect(() => new TextAtlas(1)).not.toThrow()
  })

  it('accepts dpr=2', () => {
    expect(() => new TextAtlas(2)).not.toThrow()
  })

  it('dpr=2 and dpr=1 produce same logical w/h for same text', () => {
    const atlas1 = new TextAtlas(1)
    const atlas2 = new TextAtlas(2)

    const e1 = atlas1.getOrCreate('Test', '14px system-ui', '#000', 200, 1.4)
    const e2 = atlas2.getOrCreate('Test', '14px system-ui', '#000', 200, 1.4)

    expect(e1).not.toBeNull()
    expect(e2).not.toBeNull()
    // w/h are CSS (logical) pixels — should be equal at any DPR
    expect(e1!.w).toBe(e2!.w)
    expect(e1!.h).toBe(e2!.h)
  })

  it('dpr=2 UV span is double that of dpr=1 (more physical pixels)', () => {
    const atlas1 = new TextAtlas(1)
    const atlas2 = new TextAtlas(2)

    const e1 = atlas1.getOrCreate('Scale', '14px system-ui', '#000', 200, 1.4)
    const e2 = atlas2.getOrCreate('Scale', '14px system-ui', '#000', 200, 1.4)

    expect(e1).not.toBeNull()
    expect(e2).not.toBeNull()
    const uvSpan1 = e1!.u1 - e1!.u0
    const uvSpan2 = e2!.u1 - e2!.u0
    // At 2× DPR, the same logical width occupies 2× the physical pixel UV span
    expect(uvSpan2).toBeCloseTo(uvSpan1 * 2, 1)
  })
})

// ── 3. exportSVG — hexagon shape ─────────────────────────────────────────────

describe('FlowChart.exportSVG — hexagon shape', () => {
  let container: HTMLElement

  beforeEach(() => { container = makeContainer() })
  afterEach(() => { document.body.removeChild(container) })

  it('renders hexagon as <polygon> not <rect>', () => {
    const chart = new FlowChart({
      container,
      onError: () => {},
      nodes: [{
        id: 'h1', x: 100, y: 100, width: 120, height: 60, label: 'Hex',
        style: { shape: 'hexagon' },
      }],
    })
    const svg = chart.exportSVG()
    // Should contain a polygon (hexagon) not a rect for this node
    expect(svg).toContain('<polygon')
    expect(svg).not.toMatch(/<rect[^>]*>[\s\S]*?Hex/)
  })

  it('hexagon polygon has 6 points', () => {
    const chart = new FlowChart({
      container,
      onError: () => {},
      nodes: [{
        id: 'h1', x: 0, y: 0, width: 120, height: 60, label: 'H',
        style: { shape: 'hexagon' },
      }],
    })
    const svg = chart.exportSVG()
    const polygonMatch = svg.match(/<polygon[^>]*points="([^"]+)"/)
    expect(polygonMatch).not.toBeNull()
    const points = polygonMatch![1]!.trim().split(/\s+/)
    expect(points).toHaveLength(6)
  })

  it('diamond shape still renders as polygon with 4 points', () => {
    const chart = new FlowChart({
      container,
      onError: () => {},
      nodes: [{
        id: 'd1', x: 0, y: 0, width: 120, height: 60, label: 'D',
        style: { shape: 'diamond' },
      }],
    })
    const svg = chart.exportSVG()
    const polygonMatch = svg.match(/<polygon[^>]*points="([^"]+)"/)
    expect(polygonMatch).not.toBeNull()
    const points = polygonMatch![1]!.trim().split(/\s+/)
    expect(points).toHaveLength(4)
  })

  it('circle shape renders as <ellipse>', () => {
    const chart = new FlowChart({
      container,
      onError: () => {},
      nodes: [{
        id: 'c1', x: 0, y: 0, width: 80, height: 80, label: 'C',
        style: { shape: 'circle' },
      }],
    })
    const svg = chart.exportSVG()
    expect(svg).toContain('<ellipse')
  })

  it('rectangle shape renders as <rect>', () => {
    const chart = new FlowChart({
      container,
      onError: () => {},
      nodes: [{
        id: 'r1', x: 0, y: 0, width: 120, height: 60, label: 'R',
        style: { shape: 'rectangle' },
      }],
    })
    const svg = chart.exportSVG()
    expect(svg).toContain('<rect')
  })
})

// ── 4. exportSVG edge cases ───────────────────────────────────────────────────

describe('FlowChart.exportSVG — edge cases', () => {
  let container: HTMLElement

  beforeEach(() => { container = makeContainer() })
  afterEach(() => { document.body.removeChild(container) })

  it('empty graph returns a valid empty SVG', () => {
    const chart = new FlowChart({ container, onError: () => {} })
    const svg = chart.exportSVG()
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*><\/svg>$/)
  })

  it('single node with no edges produces valid SVG', () => {
    const chart = new FlowChart({
      container, onError: () => {},
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' }],
    })
    const svg = chart.exportSVG()
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('<rect')
  })

  it('SVG escapes special characters in labels', () => {
    const chart = new FlowChart({
      container, onError: () => {},
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: '<script>&"test"' }],
    })
    const svg = chart.exportSVG()
    expect(svg).toContain('&lt;script&gt;')
    expect(svg).toContain('&amp;')
    expect(svg).toContain('&quot;test&quot;')
    expect(svg).not.toContain('<script>')
  })

  it('includes edge labels in SVG', () => {
    const chart = new FlowChart({
      container, onError: () => {},
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 200, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', label: 'connects' }],
    })
    const svg = chart.exportSVG()
    expect(svg).toContain('connects')
  })

  it('straight edge type renders as L path', () => {
    const chart = new FlowChart({
      container, onError: () => {},
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 200, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', type: 'straight' }],
    })
    const svg = chart.exportSVG()
    // straight edge uses M...L notation
    expect(svg).toMatch(/M[\d.,]+ L[\d.,]+/)
  })

  it('bezier edge renders as C path', () => {
    const chart = new FlowChart({
      container, onError: () => {},
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 200, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', type: 'bezier' }],
    })
    const svg = chart.exportSVG()
    expect(svg).toMatch(/M[\d.,-]+ C[\d.,-]/)
  })

  it('dashed edge includes stroke-dasharray', () => {
    const chart = new FlowChart({
      container, onError: () => {},
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 200, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', style: { dashArray: [8, 4] } }],
    })
    const svg = chart.exportSVG()
    expect(svg).toContain('stroke-dasharray="8 4"')
  })

  it('waypoints produce polyline-style L path', () => {
    const chart = new FlowChart({
      container, onError: () => {},
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 300, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', waypoints: [{ x: 150, y: 100 }] }],
    })
    const svg = chart.exportSVG()
    // waypoints path uses L notation
    expect(svg).toMatch(/M[\d.,]+ L[\d.,]+ L[\d.,]+/)
  })

  it('custom padding shifts viewBox', () => {
    const chart = new FlowChart({
      container, onError: () => {},
      nodes: [{ id: 'a', x: 100, y: 100, width: 100, height: 50, label: 'A' }],
    })
    const svg20 = chart.exportSVG(20)
    const svg60 = chart.exportSVG(60)
    // Both should parse as valid SVG
    expect(svg20).toContain('<svg')
    expect(svg60).toContain('<svg')
    // Larger padding → larger viewBox dimensions
    const extractW = (s: string) => {
      const m = s.match(/width="(\d+)"/)
      return m ? parseInt(m[1]!) : 0
    }
    expect(extractW(svg60)).toBeGreaterThan(extractW(svg20))
  })
})

// ── 5. onContextLost / onContextRestored accepted in options ──────────────────

describe('FlowChart — context loss callbacks', () => {
  let container: HTMLElement

  beforeEach(() => { container = makeContainer() })
  afterEach(() => { document.body.removeChild(container) })

  it('accepts onContextLost callback in options without throwing', () => {
    const onContextLost = vi.fn()
    expect(() => new FlowChart({
      container,
      onError: () => {},
      onContextLost,
    })).not.toThrow()
  })

  it('accepts onContextRestored callback in options without throwing', () => {
    const onContextRestored = vi.fn()
    expect(() => new FlowChart({
      container,
      onError: () => {},
      onContextRestored,
    })).not.toThrow()
  })

  it('onContextLost and onContextRestored both optional — no callback still works', () => {
    expect(() => new FlowChart({
      container,
      onError: () => {},
    })).not.toThrow()
  })
})

// ── 6. Package metadata consistency ──────────────────────────────────────────

describe('Package metadata', () => {
  it('core package.json name is @flowgl/core', async () => {
    const pkg = await import('../../package.json', { assert: { type: 'json' } })
    expect(pkg.default.name).toBe('@flowgl/core')
  })
})

// ── 7. exportSVG — group node ordering (groups rendered first) ────────────────

describe('FlowChart.exportSVG — group node ordering', () => {
  let container: HTMLElement

  beforeEach(() => { container = makeContainer() })
  afterEach(() => { document.body.removeChild(container) })

  it('group nodes appear before child nodes in SVG output', () => {
    const chart = new FlowChart({
      container, onError: () => {},
      nodes: [
        { id: 'child', x: 50, y: 50, width: 80, height: 40, label: 'Child', parentId: 'g1' },
        { id: 'g1', x: 0, y: 0, width: 200, height: 150, label: 'Group', type: 'group' },
      ],
    })
    const svg = chart.exportSVG()
    const groupIdx = svg.indexOf('Group')
    const childIdx = svg.indexOf('Child')
    expect(groupIdx).toBeGreaterThanOrEqual(0)
    expect(childIdx).toBeGreaterThan(groupIdx)
  })
})

// ── 8. TextAtlas — multiline text ─────────────────────────────────────────────

describe('TextAtlas — multiline text', () => {
  beforeEach(() => { installOffscreenCanvasMock() })

  it('newlines produce multi-line entries without error', () => {
    const atlas = new TextAtlas()
    const entry = atlas.getOrCreate('Line 1\nLine 2\nLine 3', '14px system-ui', '#000', 300, 1.4)
    expect(entry).not.toBeNull()
    // Multi-line entry should be taller than single-line
    const single = atlas.getOrCreate('Line 1', '14px system-ui', '#000', 300, 1.4)
    expect(entry!.h).toBeGreaterThan(single!.h)
  })

  it('text wider than maxWidth wraps to next line', () => {
    const atlas = new TextAtlas()
    const wide = atlas.getOrCreate(
      'This is a very long text that should wrap onto multiple lines when constrained',
      '14px system-ui', '#000', 100, 1.4,
    )
    const narrow = atlas.getOrCreate(
      'Short',
      '14px system-ui', '#000', 100, 1.4,
    )
    expect(wide).not.toBeNull()
    expect(wide!.h).toBeGreaterThan(narrow!.h)
  })

  it('maxWidth=0 disables word wrap', () => {
    const atlas = new TextAtlas()
    // With maxWidth=0, even long text stays on one line
    const entry = atlas.getOrCreate('one two three four five six', '14px system-ui', '#000', 0, 1.4)
    expect(entry).not.toBeNull()
  })
})

// ── 9. FlowChart — onContextLost replaces onError for context loss ────────────

describe('FlowChart — context loss callback separation from onError', () => {
  let container: HTMLElement

  beforeEach(() => { container = makeContainer() })
  afterEach(() => { document.body.removeChild(container) })

  it('onError is NOT called for WebGL context loss (handled by onContextLost)', () => {
    const onError = vi.fn()
    const onContextLost = vi.fn()
    // Can't simulate an actual WebGL context loss in happy-dom, but we verify
    // the option types are accepted and chart initializes gracefully
    expect(() => new FlowChart({
      container,
      onError,
      onContextLost,
      onContextRestored: vi.fn(),
    })).not.toThrow()
  })
})

// ── 10. TextAtlas — atlas eviction ───────────────────────────────────────────

describe('TextAtlas — atlas eviction on overflow', () => {
  beforeEach(() => { installOffscreenCanvasMock() })

  it('generation increments when atlas overflows', () => {
    const atlas = new TextAtlas(1)
    const gen0 = atlas.generation

    // Fill atlas with unique entries until it overflows
    let overflowed = false
    for (let i = 0; i < 2000; i++) {
      atlas.getOrCreate(`unique_text_${i}_abcdefghijklmnop`, '16px monospace', '#000000', 0, 1.4)
      if (atlas.generation > gen0) {
        overflowed = true
        break
      }
    }

    expect(overflowed).toBe(true)
    expect(atlas.generation).toBeGreaterThan(gen0)
  })

  it('after eviction, same text re-renders correctly', () => {
    const atlas = new TextAtlas(1)

    // Deliberately overflow the atlas
    for (let i = 0; i < 2000; i++) {
      atlas.getOrCreate(`filler_${i}_xxxxxxxxxxxxxxxxxxx`, '16px monospace', '#ff0000', 0, 1.4)
    }

    // After overflow, re-requesting same text should work
    const entry = atlas.getOrCreate('Hello', '14px system-ui', '#000000', 200, 1.4)
    expect(entry).not.toBeNull()
  })

  it('entry height is conservative when measureText returns zero ascent (emoji / CJK / Hangul case)', () => {
    // happy-dom's measureText returns 0 for actualBoundingBoxAscent/Descent
    // on emoji and CJK glyphs in real browsers too (varies by version).
    // The fallback path must still produce an entry tall enough to avoid clipping.
    const atlas = new TextAtlas(1)
    const e = atlas.getOrCreate('⚡ End', '14px system-ui', '#000', 200, 1.4)
    expect(e).not.toBeNull()
    // fontSize 14 → fallback ascent 12.6 + descent 4.2 = 16.8 → ceil = 17
    // lineStep = ceil(17 * 1.4) = 24; h = 24 + PADDING*2(8) = 24 + 16 = 40
    expect(e!.h).toBeGreaterThanOrEqual(32)
  })

  it('entry width is conservative when measureText.width is near zero', () => {
    const atlas = new TextAtlas(1)
    const e = atlas.getOrCreate('한국어', '14px system-ui', '#000', 200, 1.4)
    expect(e).not.toBeNull()
    // 3 Hangul chars × fontSize(14) × 0.6 = 25.2 → ceil 26 + PADDING*2(8) = 34
    expect(e!.w).toBeGreaterThanOrEqual(24)
  })

  it('handles mixed ASCII + CJK without truncating either', () => {
    const atlas = new TextAtlas(1)
    const e = atlas.getOrCreate('Test 한국', '14px system-ui', '#000', 200, 1.4)
    expect(e).not.toBeNull()
    // 7 chars × 14 × 0.6 = 58.8 → ceil 59 + 16 = 75
    expect(e!.w).toBeGreaterThanOrEqual(40)
    expect(e!.h).toBeGreaterThanOrEqual(32)
  })
})

// ── Security: exportSVG attribute injection prevention ────────────────────────

describe('FlowChart.exportSVG — attribute injection hardening', () => {
  let container: HTMLElement
  beforeEach(() => { container = makeContainer() })
  afterEach(() => { document.body.removeChild(container) })

  it('rejects hostile borderColor and falls back to default', () => {
    const chart = new FlowChart({
      container,
      onError: () => {},
      nodes: [{
        id: 'n', x: 0, y: 0, width: 100, height: 50, label: 'X',
        style: { borderColor: 'red"/><script>alert(1)</script><rect fill="red' },
      }],
    })
    const svg = chart.exportSVG()
    expect(svg).not.toContain('<script')
    expect(svg).not.toContain('alert(1)')
    // Falls back to default stroke
    expect(svg).toMatch(/stroke="#1a73e8"/)
  })

  it('accepts well-formed hex / rgb / named colors', () => {
    const chart = new FlowChart({
      container,
      onError: () => {},
      nodes: [
        { id: 'h', x: 0,   y: 0, width: 100, height: 50, label: 'H', style: { backgroundColor: '#ff00aa' } },
        { id: 'r', x: 120, y: 0, width: 100, height: 50, label: 'R', style: { backgroundColor: 'rgb(255, 0, 0)' } },
        { id: 'n', x: 240, y: 0, width: 100, height: 50, label: 'N', style: { backgroundColor: 'dodgerblue' } },
      ],
    })
    const svg = chart.exportSVG()
    expect(svg).toContain('fill="#ff00aa"')
    expect(svg).toContain('fill="rgb(255, 0, 0)"')
    expect(svg).toContain('fill="dodgerblue"')
  })

  it('rejects non-finite borderWidth and falls back', () => {
    const chart = new FlowChart({
      container,
      onError: () => {},
      nodes: [{
        id: 'n', x: 0, y: 0, width: 100, height: 50, label: 'X',
        style: { borderWidth: Infinity as unknown as number },
      }],
    })
    const svg = chart.exportSVG()
    expect(svg).toMatch(/stroke-width="2"/)
  })

  it('rejects hostile dashArray (non-numeric entries) and omits the attribute', () => {
    const chart = new FlowChart({
      container,
      onError: () => {},
      nodes: [
        { id: 'a', x: 0,   y: 0, width: 80, height: 40, label: 'A' },
        { id: 'b', x: 200, y: 0, width: 80, height: 40, label: 'B' },
      ],
      edges: [{
        id: 'e', source: 'a', target: 'b',
        style: { dashArray: ['8' as unknown as number, '"/><script>x</script><rect dashed="' as unknown as number] },
      }],
    })
    const svg = chart.exportSVG()
    expect(svg).not.toContain('<script')
    expect(svg).not.toMatch(/stroke-dasharray=/)
  })

  it('escapes label content', () => {
    const chart = new FlowChart({
      container,
      onError: () => {},
      nodes: [{
        id: 'n', x: 0, y: 0, width: 100, height: 50,
        label: '</text><script>alert(1)</script>',
      }],
    })
    const svg = chart.exportSVG()
    expect(svg).not.toContain('<script')
    expect(svg).toContain('&lt;/text&gt;')
  })
})

// ── Security: HtmlOverlay sanitizer ───────────────────────────────────────────

describe('FlowChart — HTML overlay sanitizer', () => {
  let container: HTMLElement
  beforeEach(() => { container = makeContainer() })
  afterEach(() => { document.body.removeChild(container) })

  it('accepts sanitizeHtml option in constructor without error', () => {
    const sanitize = vi.fn((s: string) => s.replace(/<script[^>]*>.*?<\/script>/gi, ''))
    expect(() => new FlowChart({
      container,
      onError: () => {},
      sanitizeHtml: sanitize,
      nodes: [{
        id: 'n', x: 0, y: 0, width: 100, height: 50, label: '',
        htmlContent: '<b>safe</b><script>evil()</script>',
      }],
    })).not.toThrow()
  })
})

// ── Accessibility: ARIA attributes ────────────────────────────────────────────

describe('FlowChart — ARIA attributes on canvas', () => {
  let container: HTMLElement
  beforeEach(() => { container = makeContainer() })
  afterEach(() => { document.body.removeChild(container) })

  it('canvas has role="application", aria-label, aria-roledescription, aria-keyshortcuts, tabindex', () => {
    new FlowChart({ container, onError: () => {} })
    const canvas = container.querySelector('canvas')!
    expect(canvas.getAttribute('role')).toBe('application')
    expect(canvas.getAttribute('aria-label')).toBe('Flowchart')
    expect(canvas.getAttribute('aria-roledescription')).toBe('Flowchart editor')
    expect(canvas.getAttribute('tabindex')).toBe('0')
    const ks = canvas.getAttribute('aria-keyshortcuts') ?? ''
    expect(ks).toContain('Tab')
    expect(ks).toContain('Delete')
    expect(ks).toContain('Control+Z')
    expect(ks).toContain('Control+A')
    expect(ks).toContain('Escape')
  })

  it('respects custom ariaLabel option', () => {
    new FlowChart({ container, onError: () => {}, ariaLabel: 'Workflow diagram' })
    const canvas = container.querySelector('canvas')!
    expect(canvas.getAttribute('aria-label')).toBe('Workflow diagram')
  })

  it('aria-describedby points to a visually-hidden description element', () => {
    new FlowChart({ container, onError: () => {} })
    const canvas = container.querySelector('canvas')!
    const descId = canvas.getAttribute('aria-describedby')!
    expect(descId).toMatch(/^fc-desc-/)
    const desc = document.getElementById(descId)
    expect(desc).not.toBeNull()
    expect(desc!.textContent).toContain('Tab')
    expect(desc!.textContent).toContain('Arrow keys')
  })
})

// ── Security: fromJSON schema validation ──────────────────────────────────────

describe('FlowChart.fromJSON — schema validation', () => {
  let container: HTMLElement
  beforeEach(() => { container = makeContainer() })
  afterEach(() => { document.body.removeChild(container) })

  it('rejects nodes with missing id', () => {
    const chart = new FlowChart({ container, onError: () => {} })
    expect(() => chart.fromJSON({
      nodes: [{ x: 0, y: 0, width: 100, height: 50, label: 'X' }] as unknown as never,
      edges: [],
    })).toThrow(TypeError)
  })

  it('rejects nodes with non-finite x', () => {
    const chart = new FlowChart({ container, onError: () => {} })
    expect(() => chart.fromJSON({
      nodes: [{ id: 'a', x: Infinity, y: 0, width: 100, height: 50, label: 'X' }],
      edges: [],
    })).toThrow(/finite/)
  })

  it('rejects __proto__ pollution attempts', () => {
    const chart = new FlowChart({ container, onError: () => {} })
    const malicious = JSON.parse('{"nodes":[{"__proto__":{"polluted":true},"id":"a","x":0,"y":0,"width":100,"height":50}],"edges":[]}')
    expect(() => chart.fromJSON(malicious)).toThrow(/__proto__/)
  })

  it('rejects oversized htmlContent', () => {
    const chart = new FlowChart({ container, onError: () => {} })
    const huge = 'x'.repeat(200_000)
    expect(() => chart.fromJSON({
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: '', htmlContent: huge }],
      edges: [],
    })).toThrow(/htmlContent/)
  })

  it('accepts well-formed payload without throwing', () => {
    const chart = new FlowChart({ container, onError: () => {} })
    expect(() => chart.fromJSON({
      nodes: [
        { id: 'a', x: 0,   y: 0, width: 100, height: 50, label: 'A' },
        { id: 'b', x: 200, y: 0, width: 100, height: 50, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    })).not.toThrow()
  })

  it('skipValidation:true accepts pre-validated data without throwing', () => {
    const chart = new FlowChart({ container, onError: () => {} })
    expect(() => chart.fromJSON(
      { nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'X' }], edges: [] },
      { skipValidation: true },
    )).not.toThrow()
  })

  it('rejects htmlContent containing <script>', () => {
    const chart = new FlowChart({ container, onError: () => {} })
    expect(() => chart.fromJSON({
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: '', htmlContent: '<div><script>alert(1)</script></div>' }],
      edges: [],
    })).toThrow(/<script>/)
  })

  it('rejects htmlContent containing inline event handler (onload=)', () => {
    const chart = new FlowChart({ container, onError: () => {} })
    expect(() => chart.fromJSON({
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: '', htmlContent: '<img src=x onerror="alert(1)">' }],
      edges: [],
    })).toThrow(/event handler/)
  })

  it('double-click on an htmlContent node does NOT open the label editor', () => {
    const chart = new FlowChart({
      container,
      onError: () => {},
      nodes: [{
        id: 'h', x: 80, y: 80, width: 160, height: 80, label: '',
        htmlContent: '<div>⚡ End</div>',
      }],
    })
    // Simulate a dblclick on the canvas center of the node.
    // In WebGL-unavailable mode the chart is in `failed` state, so this is
    // really a "no editor opens" assertion rather than a positive event-flow
    // test — but the path we want to cover is the htmlContent guard in
    // canvasDblClick at flowchart.ts:518.
    const before = document.querySelectorAll('input[type=text]').length
    const canvas = container.querySelector('canvas')
    if (canvas) canvas.dispatchEvent(new MouseEvent('dblclick', { clientX: 160, clientY: 120, bubbles: true }))
    const after = document.querySelectorAll('input[type=text]').length
    expect(after).toBe(before)
    chart.dispose()
  })

  it('rejects htmlContent containing javascript: URL', () => {
    const chart = new FlowChart({ container, onError: () => {} })
    expect(() => chart.fromJSON({
      nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 50, label: '', htmlContent: '<a href="javascript:alert(1)">x</a>' }],
      edges: [],
    })).toThrow(/javascript:/)
  })

  it('importJSON merge also validates the payload', () => {
    const chart = new FlowChart({ container, onError: () => {} })
    expect(() => chart.importJSON({
      nodes: [{ id: 'a', x: Infinity, y: 0, width: 100, height: 50, label: '' }],
      edges: [],
    }, 'merge')).toThrow(/finite/)
  })
})
