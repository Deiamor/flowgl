# Accessibility

flowgl is designed to be **WCAG 2.2 AA** compliant out of the box, with
`role="application"`, `aria-keyshortcuts`, `aria-live` announcements, and
keyboard-complete navigation. The `axe-core` test suite runs against the
chart on every PR and is required to pass clean.

## What ships by default

| Surface | A11y treatment |
| --- | --- |
| Canvas | `role="application"`, `aria-label` from `options.ariaLabel` (default `'Flowchart'`) |
| Focus | Tab cycles through nodes; Shift+Tab reverses |
| Movement | Arrow keys nudge the focused node by 10 world units (400ms debounce avoids history pollution) |
| Selection | Space toggles selection on the focused node |
| Deletion | Delete / Backspace removes the focused or selected nodes |
| Undo / redo | Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z (or Cmd/Ctrl+Y) |
| Announcements | `aria-live="polite"` region announces the focused node's label on Tab |
| Keyboard hint | `aria-keyshortcuts` lists the navigation keys |

The full key map is in [Install & first chart](./getting-started) and
shown live on the demo page.

## What you should provide

Some context only the host application has:

1. **Meaningful `ariaLabel`** on the chart — describe what the chart
   *is*, not just "flowchart". Examples: `"Pipeline editor"`,
   `"Service dependency map"`, `"Decision tree"`.

   ```ts
   new FlowChart({ container, ariaLabel: 'Order pipeline — edit to reroute' })
   ```

2. **Per-node `ariaLabel`** when the visual label is insufficient. The
   label is what sighted users see; `ariaLabel` is what screen-reader
   users hear. They're usually the same, but not always — an icon-only
   node should still announce a meaningful name.

   ```ts
   { id: 'ingest', label: '⬇', ariaLabel: 'Ingest from S3', ... }
   ```

3. **A descriptive page heading and a brief intro** above the chart so
   landed screen-reader users know what they're about to interact with.

## Verifying

```bash
# Inside the consumer project
npm install -D @axe-core/playwright
```

```ts
import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

test('chart page is axe-clean', async ({ page }) => {
  await page.goto('/your-chart-page')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})
```

The library's own tests do the same in CI — every release ships a passing
axe-core run.

## Known limitations

- **Color contrast** of nodes is your responsibility (you pick the
  `backgroundColor` / `textColor`). flowgl exposes the tokens but doesn't
  enforce a contrast ratio.
- **Touch-only screen readers** (mobile VoiceOver, TalkBack) work with
  the canvas but the swipe-to-focus model is browser-managed; we don't
  intercept it.
- **Custom HTML overlays** (`NodeData.htmlContent`) are your DOM — you
  own the a11y of what you render inside.

## Reporting an a11y issue

Open a regular bug report. Add the `accessibility` label. Include the
assistive technology + browser combination so we can reproduce.
