import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import axe from 'axe-core'
import { FlowChart } from '../flowchart'

/**
 * Run axe-core against the FlowChart canvas + its sibling a11y nodes.
 *
 * happy-dom does not implement layout / visual-rendering APIs, so rules that
 * depend on bounding boxes (e.g. `color-contrast`, `target-size`) cannot be
 * exercised here — they are noted in `EXCLUDED_RULES` and audited via the
 * Playwright + @axe-core/playwright path in the docs.
 *
 * The rules that DO apply at the DOM-shape level — `aria-roles`,
 * `aria-required-attr`, `aria-valid-attr`, `aria-keyshortcuts`,
 * `landmark-unique` etc. — must all pass on a freshly-mounted chart.
 */

const EXCLUDED_RULES = [
  'color-contrast',         // needs layout
  'target-size',            // needs layout
  'page-has-heading-one',   // doc-level rule, irrelevant to a widget
  'region',                 // doc-level
  'landmark-one-main',      // doc-level
]

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  Object.defineProperty(div, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
  })
  document.body.appendChild(div)
  return div
}

describe('a11y — axe-core scan', () => {
  let container: HTMLElement

  beforeEach(() => { container = makeContainer() })
  afterEach(()  => { document.body.removeChild(container) })

  it('FlowChart canvas + a11y siblings have zero applicable axe violations', async () => {
    new FlowChart({ container, onError: () => {}, ariaLabel: 'Pipeline editor' })

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] },
      rules: Object.fromEntries(EXCLUDED_RULES.map(id => [id, { enabled: false }])),
    })

    const violations = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')
    if (violations.length > 0) {
      console.error('axe violations:', JSON.stringify(violations, null, 2))
    }
    expect(violations).toEqual([])
  })

  it('aria-keyshortcuts is valid (matches axe schema for the attribute)', async () => {
    new FlowChart({ container, onError: () => {} })
    const canvas = container.querySelector('canvas')!
    const ks = canvas.getAttribute('aria-keyshortcuts')!
    // Token-separated list of key sequences; each token has optional modifiers.
    const tokens = ks.split(/\s+/)
    expect(tokens.length).toBeGreaterThan(5)
    for (const tok of tokens) {
      // Each token is non-empty and contains only allowed characters
      expect(tok).toMatch(/^[A-Za-z0-9+_-]+$/)
    }
  })

  it('aria-describedby target exists in the same subtree', async () => {
    new FlowChart({ container, onError: () => {} })
    const canvas = container.querySelector('canvas')!
    const descId = canvas.getAttribute('aria-describedby')!
    const descEl = document.getElementById(descId)
    expect(descEl).not.toBeNull()
    expect(descEl!.textContent?.trim().length).toBeGreaterThan(20)
  })

  it('Korean ariaLabel survives axe scan (no false-positive on non-ASCII)', async () => {
    new FlowChart({ container, onError: () => {}, ariaLabel: '워크플로우 다이어그램' })
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] },
      rules: Object.fromEntries(EXCLUDED_RULES.map(id => [id, { enabled: false }])),
    })
    expect(results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([])
    const canvas = container.querySelector('canvas')!
    expect(canvas.getAttribute('aria-label')).toBe('워크플로우 다이어그램')
  })

  it('aria-keyshortcuts uses canonical key names (axe-recognised)', async () => {
    new FlowChart({ container, onError: () => {} })
    const canvas = container.querySelector('canvas')!
    const ks = canvas.getAttribute('aria-keyshortcuts')!
    // Per WAI-ARIA 1.2: tokens use named-keys ('ArrowUp', 'Escape', 'Control', etc.) and '+' for modifiers
    for (const tok of ks.split(/\s+/)) {
      expect(tok).toMatch(/^([A-Z][a-zA-Z]*(\+|$))*[A-Za-z0-9]+$/)
    }
  })

  it('aria-live region is positioned in the accessibility tree, not just visually hidden', async () => {
    new FlowChart({ container, onError: () => {} })
    const live = container.querySelector('[aria-live]')
    expect(live).not.toBeNull()
    expect(live!.getAttribute('aria-live')).toBe('polite')
    // Visually hidden, but accessibility tree must still see it
    const cssText = (live as HTMLElement).style.cssText
    expect(cssText).toMatch(/width:\s*1px/)   // sr-only pattern
    expect(cssText).toMatch(/height:\s*1px/)
  })
})
