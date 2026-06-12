# PROJECT.md

## Overview
WebGL2-based flowchart library. No external runtime dependencies. Framework-agnostic pure ESM core with React, Vue, and Svelte wrappers.

## Tech Stack
- Language: TypeScript 5.x (strict)
- Rendering: WebGL2 (instanced rendering, SDF rounded rects, bezier tessellation)
- Text: Canvas 2D texture atlas → WebGL texture (2-pass, RTL support, DPR-aware)
- Build: Rollup 4 + @rollup/plugin-typescript + @rollup/plugin-terser (production minification)
- Test: Vitest + happy-dom (919 tests: 892 core / 27 wrappers across react/vue/svelte)
- Dev server: Vite (demo only)
- Package manager: pnpm workspaces

## Directory Tree
```
flowchart/
├── package.json               # root (private) — test/build/typecheck scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── packages/
│   ├── core/
│   │   ├── package.json       # @flowgl/core
│   │   ├── tsconfig.json
│   │   ├── rollup.config.mjs  # Rollup config (ESM + CJS, terser minification)
│   │   ├── vitest.config.ts
│   │   ├── README.md          # Public API reference
│   │   ├── PERFORMANCE.md     # 1K/5K/10K SwiftShader benchmarks + 8 critical optimizations
│   │   ├── scripts/
│   │   │   └── atlas-cjk-diag.mjs  # CDP-driven CJK pixel-parity + entry-mapping regression gate
│   │   └── src/
│   │       ├── index.ts       # public API exports
│   │       ├── flowchart.ts   # FlowChart class (main entry)
│   │       ├── types.ts       # shared type definitions
│   │       ├── services/      # pure-function services extracted from FlowChart
│   │       │   ├── alignment.ts        # alignNodes / distributeNodes
│   │       │   ├── graph-analysis.ts   # getIncomers / getOutgoers / hasCycle / findPaths
│   │       │   ├── json-validate.ts    # fromJSON / importJSON schema + XSS sink guards
│   │       │   ├── layout-animator.ts  # smoothstep RAF interpolation
│   │       │   ├── safe-css.ts         # safeColor / safeNumber / safeDashArray / safeFontFamily SSOT
│   │       │   └── svg-export.ts       # SVG export with shape polygons + edge bezier/step/waypoints
│   │       ├── events/
│   │       │   └── emitter.ts
│   │       ├── graph/
│   │       │   ├── node.ts
│   │       │   ├── edge.ts
│   │       │   └── graph.ts
│   │       ├── viewport/
│   │       │   └── viewport.ts
│   │       ├── history/
│   │       │   └── history.ts
│   │       ├── layout/
│   │       │   └── auto-layout.ts
│   │       ├── interaction/
│   │       │   ├── hit-test.ts
│   │       │   ├── edge-hit-test.ts
│   │       │   ├── pan-zoom.ts      # mouse + touch pan/zoom/pinch
│   │       │   ├── drag.ts          # node drag (mouse + touch)
│   │       │   ├── connect.ts       # handle drag → edge connection (mouse + touch)
│   │       │   ├── keyboard.ts      # keyboard shortcuts + Tab/Arrow nav
│   │       │   ├── box-select.ts    # rubber-band multi-select
│   │       │   ├── context-menu.ts  # right-click context menu
│   │       │   ├── label-edit.ts    # inline label editing (double-click)
│   │       │   ├── edge-reroute.ts  # edge control point dragging
│   │       │   ├── edge-waypoint.ts # waypoint handle DOM overlay (z-index:15)
│   │       │   └── node-resize.ts   # node resize handle drag
│   │       ├── renderer/
│   │       │   ├── interface.ts
│   │       │   ├── canvas2d/
│   │       │   │   └── index.ts       # Canvas2DRenderer — opt-in fallback (rendererKind: 'canvas2d')
│   │       │   └── webgl/
│   │       │       ├── index.ts           # WebGL2Renderer
│   │       │       ├── context.ts
│   │       │       ├── cull.ts            # frustum culling
│   │       │       ├── buffers/
│   │       │       │   └── dynamic-buffer.ts
│   │       │       ├── atlas/
│   │       │       │   └── text-atlas.ts  # Canvas2D → WebGL texture atlas (DPR-scaled)
│   │       │       ├── programs/
│   │       │       │   ├── node-program.ts
│   │       │       │   ├── edge-program.ts
│   │       │       │   ├── text-program.ts  # node + edge label rendering
│   │       │       │   ├── handle-program.ts
│   │       │       │   ├── cap-program.ts   # edge cap (arrow/circle) rendering
│   │       │       │   └── grid-program.ts
│   │       │       └── util/
│   │       │           ├── bezier.ts
│   │       │           └── color.ts
│   │       ├── ui/
│   │       │   ├── context-panels.ts  # node/edge context panel UI
│   │       │   ├── html-overlay.ts    # custom HTML content inside nodes
│   │       │   └── minimap.ts         # minimap canvas overlay
│   │       ├── workers/
│   │       │   ├── layout-client.ts   # LayoutWorkerClient — async layout via Web Worker
│   │       │   └── layout-worker.ts   # Web Worker entry point
│   │       ├── utils/
│   │       │   └── id.ts
│   │       └── __tests__/
│   │           ├── flowchart.test.ts      # full public API + undo consistency
│   │           ├── connect.test.ts
│   │           ├── panZoom.test.ts
│   │           ├── drag.test.ts
│   │           ├── keyboard.test.ts
│   │           ├── boxSelect.test.ts
│   │           ├── graph.test.ts
│   │           ├── history.test.ts
│   │           ├── layout.test.ts
│   │           ├── viewport.test.ts
│   │           ├── hit-test.test.ts
│   │           ├── edge-hit-test.test.ts
│   │           ├── edge-reroute.test.ts
│   │           ├── edge-waypoint.test.ts
│   │           ├── node-resize.test.ts
│   │           ├── label-editor.test.ts
│   │           ├── context-menu.test.ts
│   │           ├── handle-xy.test.ts
│   │           ├── cull.test.ts
│   │           ├── bezier.test.ts
│   │           ├── analysis.test.ts
│   │           ├── productization.test.ts
│   │           └── edge-cases.test.ts     # 341 edge-case scenarios
│   ├── react/
│   │   ├── package.json       # @flowgl/react
│   │   └── src/
│   │       ├── Flowchart.tsx  # React wrapper (forwardRef, stable callback refs)
│   │       └── index.ts
│   ├── vue/
│   │   ├── package.json       # @flowgl/vue
│   │   └── src/
│   │       ├── Flowchart.vue  # Vue 3 wrapper (Composition API)
│   │       └── index.ts
│   └── svelte/
│       ├── package.json       # @flowgl/svelte
│       └── src/
│           ├── Flowchart.svelte
│           └── index.ts
├── wrangler.toml                  # Cloudflare Workers static assets config
└── demo/
    ├── package.json
    ├── vite.config.ts
    ├── index.html                 # vanilla JS demo (deployed at dev.flowgl.ouranos.kr)
    └── react.html                 # React demo page
```

## Canvas Overlay Stack
Overlays are positioned absolutely on top of the WebGL canvas, inside the container div.

| Layer | Element | z-index | Purpose |
|-------|---------|---------|---------|
| highlight overlay | `<canvas>` 2D | 1 | Yellow dashed rect around highlighted nodes |
| status overlay | `<canvas>` 2D | 2 | Node status badges (error/warning/success/info) |
| waypoint overlay | `<div>` | 15 | Waypoint handle DOM elements |
| minimap | `<canvas>` 2D | 20 | Mini navigation map, click-to-pan |

## Key Design Decisions
- Nodes: WebGL2 instanced draw (single draw call for all nodes)
- Edges: CPU bezier → triangle strip, packed into one VBO per frame
- Text: OffscreenCanvas → 2048×2048 texture atlas, shelf-packing, 2-pass render (pre-warm → vertex gen); DPR-scaled for Retina clarity. Per-entry OffscreenCanvas + drawImage strategy isolates fillText from any cumulative live-atlas ctx state (introduced in 0.2.6, structural fix for the CJK glyph-drop). Pass-1 generation re-check (0.4.1) catches mid-Pass-1 eviction so cached quads never carry stale UVs.
- TextAtlas cache key includes text color — prevents color bleed between nodes with same label but different textColor
- Hit test: CPU AABB (no GPU color picking)
- Renderer abstraction: `Renderer` interface → two implementations. `WebGL2Renderer` (default — instanced GPU rendering, full feature set) and `Canvas2DRenderer` (opt-in via `rendererKind: 'canvas2d'` — fallback for environments without WebGL2; T5 parity gaps under "Known limitations" in CHANGELOG)
- SSR safety: `typeof window === 'undefined'` guard at FlowChart constructor entry
- Minification: @rollup/plugin-terser (production), no obfuscation — preserves debuggability for open-source consumers
- Undo/redo: state-snapshot approach — `beforeMutation()` saves a full snapshot before every mutation; `undo()`/`redo()` restore snapshots wholesale
- batchUpdate: `batching` + `batchMutSaved` flags ensure a single history entry and a single render flush for the entire batch callback
- GPU resource management: all WebGL programs (including `CapProgram`) implement `dispose()` — called from `WebGL2Renderer.dispose()`
- Event listener management: canvas event handlers stored as class fields so `dispose()` can call `removeEventListener` with the exact same reference
- WebGL context loss: `webglcontextlost` / `webglcontextrestored` events handled; programs are re-created on restore; `onContextLost`/`onContextRestored` callbacks notify the host application

## Production Hardening (completed)
- Memory leak fix: 4 canvas event listeners stored as class fields and removed in `dispose()`
- `ariaDesc` DOM element removed in `dispose()`
- GPU leak fix: `CapProgram.dispose()` added and wired into `WebGL2Renderer.dispose()`
- Render cache: `cachedTextNodes` and `cachedHasAnimated` eliminate per-frame `filter`/`some` calls
- `Graph.getEdgesForNode()` O(1) via `nodeEdgeIndex` (public method)
- `ungroupNodes()` uses `replaceNode` pattern to correctly delete optional fields (`parentId`)
- TextAtlas cache key includes color — correct multi-color text rendering
- DPR-scaled TextAtlas — crisp text on Retina displays

## Build Commands
```bash
pnpm test           # run 919 tests across all packages (892 core / 9+9+9 wrappers)
pnpm build          # production build (minified)
pnpm build:dev      # development build (readable + sourcemaps)
pnpm typecheck      # tsc --noEmit (all packages)
```
