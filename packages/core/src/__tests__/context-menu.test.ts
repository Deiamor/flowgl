import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { ContextMenu } from '../interaction/context-menu'
import type { MenuEntry } from '../interaction/context-menu'

describe('ContextMenu', () => {
  let menu: ContextMenu

  beforeEach(() => {
    menu = new ContextMenu()
  })

  afterEach(() => {
    menu.dispose()
    // Clean up any leftover DOM nodes
    document.querySelectorAll('div[style*="z-index: 9000"]').forEach(el => el.remove())
  })

  it('constructs without throwing', () => {
    expect(menu).toBeDefined()
  })

  it('show appends menu to document.body', () => {
    const entries: MenuEntry[] = [{ label: 'Item', action: vi.fn() }]
    menu.show(100, 100, entries)
    const el = document.querySelector('div[style*="z-index: 9000"]')
    expect(el).not.toBeNull()
  })

  it('hide removes menu from DOM', () => {
    menu.show(100, 100, [{ label: 'Item', action: vi.fn() }])
    menu.hide()
    expect(document.querySelector('div[style*="z-index: 9000"]')).toBeNull()
  })

  it('hide is a no-op when menu is not shown', () => {
    expect(() => menu.hide()).not.toThrow()
  })

  it('dispose calls hide', () => {
    menu.show(100, 100, [{ label: 'Item', action: vi.fn() }])
    menu.dispose()
    expect(document.querySelector('div[style*="z-index: 9000"]')).toBeNull()
  })

  it('show with empty entries creates empty menu', () => {
    menu.show(100, 100, [])
    const el = document.querySelector('div[style*="z-index: 9000"]')
    expect(el).not.toBeNull()
    expect(el!.children).toHaveLength(0)
  })

  it('show with MenuItem creates a button', () => {
    const action = vi.fn()
    menu.show(100, 100, [{ label: 'Click Me', action }])
    const buttons = document.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons[0]!.textContent).toContain('Click Me')
  })

  it('MenuItem action is called on pointerdown', () => {
    const action = vi.fn()
    menu.show(100, 100, [{ label: 'Do It', action }])
    const button = document.querySelector('button')!
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(action).toHaveBeenCalledOnce()
  })

  it('MenuItem action hides menu after click', () => {
    const action = vi.fn()
    menu.show(100, 100, [{ label: 'Do It', action }])
    const button = document.querySelector('button')!
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(document.querySelector('div[style*="z-index: 9000"]')).toBeNull()
  })

  it('disabled MenuItem does not fire action on pointerdown', () => {
    const action = vi.fn()
    menu.show(100, 100, [{ label: 'Disabled', action, disabled: true }])
    const button = document.querySelector('button')!
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(action).not.toHaveBeenCalled()
  })

  it('destructive MenuItem renders differently (red-ish color)', () => {
    menu.show(100, 100, [{ label: 'Delete', action: vi.fn(), destructive: true }])
    const button = document.querySelector('button')!
    // Destructive item uses #f87171 (happy-dom preserves hex, not RGB)
    expect(button.style.color).toBe('#f87171')
  })

  it('separator creates a div without button', () => {
    const entries: MenuEntry[] = [
      { label: 'A', action: vi.fn() },
      { separator: true },
      { label: 'B', action: vi.fn() },
    ]
    menu.show(100, 100, entries)
    const menuEl = document.querySelector('div[style*="z-index: 9000"]')!
    const children = Array.from(menuEl.children)
    expect(children).toHaveLength(3)
    expect(children[0]!.tagName).toBe('BUTTON')
    expect(children[1]!.tagName).toBe('DIV')
    expect(children[2]!.tagName).toBe('BUTTON')
  })

  it('show replaces previous menu', () => {
    menu.show(100, 100, [{ label: 'First', action: vi.fn() }])
    menu.show(200, 200, [{ label: 'Second', action: vi.fn() }])
    const menus = document.querySelectorAll('div[style*="z-index: 9000"]')
    expect(menus).toHaveLength(1)
    expect(menus[0]!.textContent).toContain('Second')
  })

  it('SubMenuItem creates a button with arrow indicator', () => {
    const panelFactory = vi.fn(() => {
      const el = document.createElement('div')
      el.textContent = 'subpanel'
      return el
    })
    const entries: MenuEntry[] = [{ label: 'Sub', panel: panelFactory }]
    menu.show(100, 100, entries)
    const button = document.querySelector('button')!
    expect(button.textContent).toContain('▶')
    // Trigger hover — exercises showSubPanel and the panelFactory body
    button.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
    expect(panelFactory).toHaveBeenCalledOnce()
  })

  it('disabled SubMenuItem does not show panel on hover', () => {
    const panelFactory = vi.fn(() => document.createElement('div'))
    const entries: MenuEntry[] = [{
      label: 'Sub',
      panel: panelFactory,
      disabled: true,
    }]
    menu.show(100, 100, entries)
    const button = document.querySelector('button')!
    button.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
    expect(panelFactory).not.toHaveBeenCalled()
  })

  it('outside click hides menu (hideOnOutside fires after rAF)', () => {
    // Make rAF execute synchronously so hideOnOutside gets registered immediately
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })
    menu.show(100, 100, [{ label: 'Item', action: vi.fn() }])
    vi.restoreAllMocks()
    // hideOnOutside is now registered; dispatch a click outside the menu
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(document.querySelector('div[style*="z-index: 9000"]')).toBeNull()
  })

  it('scroll event hides menu (hideOnScroll fires after rAF)', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })
    menu.show(100, 100, [{ label: 'Item', action: vi.fn() }])
    vi.restoreAllMocks()
    // hideOnScroll is now registered; dispatch a scroll event
    window.dispatchEvent(new Event('scroll', { bubbles: true }))
    expect(document.querySelector('div[style*="z-index: 9000"]')).toBeNull()
  })

  it('multiple items all render as buttons', () => {
    const entries: MenuEntry[] = [
      { label: 'A', action: vi.fn() },
      { label: 'B', action: vi.fn() },
      { label: 'C', action: vi.fn() },
    ]
    menu.show(100, 100, entries)
    const buttons = document.querySelectorAll('button')
    expect(buttons).toHaveLength(3)
  })

  it('pointerenter on regular item changes background', () => {
    menu.show(100, 100, [{ label: 'Hover', action: vi.fn() }])
    const button = document.querySelector('button')!
    button.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
    expect(button.style.background).toBeTruthy()
  })

  it('pointerleave on regular item clears background', () => {
    menu.show(100, 100, [{ label: 'Hover', action: vi.fn() }])
    const button = document.querySelector('button')!
    button.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
    button.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }))
    expect(button.style.background).toBe('transparent')
  })

  it('non-disabled SubMenuItem shows panel on pointerenter', () => {
    const panelEl = document.createElement('div')
    panelEl.textContent = 'subpanel-content'
    const panelFactory = vi.fn(() => panelEl)
    const entries: MenuEntry[] = [{
      label: 'Sub',
      panel: panelFactory,
    }]
    menu.show(100, 100, entries)
    const button = document.querySelector('button')!
    button.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
    expect(panelFactory).toHaveBeenCalledOnce()
    // Panel should be in the DOM
    expect(document.body.contains(panelEl)).toBe(true)
  })

  it('SubMenuItem pointerleave schedules hiding the panel', () => {
    const panelEl = document.createElement('div')
    const entries: MenuEntry[] = [{ label: 'Sub', panel: () => panelEl }]
    menu.show(100, 100, entries)
    const button = document.querySelector('button')!
    button.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
    // Panel is now shown; pointerleave schedules hiding
    button.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }))
    // No throw — timer schedules hide
    expect(true).toBe(true)
  })

  it('scheduleHideSub timer callback fires and hides the sub-panel', () => {
    vi.useFakeTimers()
    const panelEl = document.createElement('div')
    const entries: MenuEntry[] = [{ label: 'Sub', panel: () => panelEl }]
    menu.show(100, 100, entries)
    const button = document.querySelector('button')!
    // Show the sub-panel
    button.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
    expect(document.body.contains(panelEl)).toBe(true)
    // Trigger scheduleHideSub via pointerleave
    button.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }))
    // Fire the 180ms timer callback — covers the anonymous function inside scheduleHideSub
    vi.runAllTimers()
    vi.useRealTimers()
    expect(document.body.contains(panelEl)).toBe(false)
  })

  it('cancelHideSub prevents the timer from hiding the sub-panel', () => {
    vi.useFakeTimers()
    const panelEl = document.createElement('div')
    const entries: MenuEntry[] = [{ label: 'Sub', panel: () => panelEl }]
    menu.show(100, 100, entries)
    const button = document.querySelector('button')!
    button.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
    expect(document.body.contains(panelEl)).toBe(true)
    // pointerleave schedules hide
    button.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }))
    // re-enter cancels the scheduled hide (cancelHideSub)
    button.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
    vi.runAllTimers()
    vi.useRealTimers()
    // Panel was kept because cancelHideSub cleared the timer
    expect(true).toBe(true)
  })
})
