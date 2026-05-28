# flowchart

Zero-dependency WebGL2 flowchart library. No external runtime dependencies. Framework-agnostic.

> **Repository**: https://github.com/Deiamor/flowchart (private)

---

## Features

- **WebGL2 rendering** — GPU-accelerated nodes, edges, and text at any zoom level
- **Zero dependencies** — no React, no D3, no external packages at runtime
- **Touch support** — drag nodes, draw connections, pan/pinch-zoom
- **Keyboard navigation** — Tab/Shift+Tab, Arrow nudge, Ctrl+Z/Y undo/redo
- **Undo / redo** — snapshot-based history with configurable depth
- **Multi-line text + RTL** — word-wrap within node width, automatic RTL detection
- **Edge labels** — rendered at the bezier midpoint
- **Accessible** — `role="application"`, `aria-live` announcements, full keyboard control
- **SSR-safe** — detects non-browser environments and calls `onError` instead of crashing
- **Production build** — obfuscated output via javascript-obfuscator

## Browser requirements

WebGL2 required: Chrome 56+, Firefox 51+, Safari 15+, Edge 79+.

---

## Repository structure

```
packages/core/   — @flowchart/core  (the published package)
demo/            — Vite dev demo
```

---

## Development

```bash
pnpm install
```

### Build

```bash
# Production build (obfuscated)
pnpm --filter @flowchart/core build

# Development build (readable + sourcemaps)
pnpm --filter @flowchart/core build:dev
```

### Demo server

```bash
pnpm dev   # http://localhost:5173
```

### Tests

```bash
pnpm --filter @flowchart/core test        # 127 tests (vitest)
pnpm --filter @flowchart/core typecheck
```

---

## Quick start

```bash
npm install @flowchart/core
```

```ts
import { FlowChart } from '@flowchart/core'

const chart = new FlowChart({
  container: document.getElementById('app')!,
  nodes: [
    { id: 'a', x: 100, y: 150, width: 120, height: 60, label: 'Start' },
    { id: 'b', x: 350, y: 150, width: 120, height: 60, label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'a', target: 'b', label: 'next' },
  ],
})
```

For the full API reference see [packages/core/README.md](packages/core/README.md).
