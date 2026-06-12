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
│   │       │   ├── layout-animator.ts  # smoothstep RAF interpolation (0.8.2: prefers-reduced-motion guard)
│   │       │   ├── safe-css.ts         # safeColor / safeNumber / safeDashArray / safeFontFamily SSOT
│   │       │   ├── sanitize-html.ts    # 0.8.2 — shared `sanitizeContent` for every overlay innerHTML write (warn-once)
│   │       │   └── svg-export.ts       # SVG export with shape polygons + edge bezier/step/waypoints
│   │       ├── events/
│   │       │   └── emitter.ts
│   │       ├── graph/
│   │       │   ├── node.ts
│   │       │   ├── edge.ts
│   │       │   ├── graph.ts
│   │       │   └── node-type-registry.ts  # 0.9.0 — per-chart map of NodeData.type → render behaviour. Built-ins auto-seeded; reserved names cannot be re-registered. External plugins register as `category: 'html'`.
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
│   │       │           ├── edge-geometry.ts  # 0.8.1 — shared 4-branch edge geometry (waypoints/straight/step/smoothstep/bezier). Single source of truth for hit testing, label position, EdgeToolbar anchor, SVG export, culling, cache fingerprint.
│   │       │           └── color.ts
│   │       ├── ui/
│   │       │   ├── context-panels.ts       # node/edge context panel UI
│   │       │   ├── html-overlay.ts         # custom HTML content inside nodes
│   │       │   ├── minimap.ts              # minimap canvas overlay
│   │       │   ├── panel-overlay.ts        # 0.5.0 — 9-position floating panels (Panel API)
│   │       │   ├── controls.ts             # 0.5.0 — built-in zoom/fit/lock control bar
│   │       │   ├── node-toolbar.ts         # 0.5.0 — node-anchored, constant-pixel-size toolbar
│   │       │   ├── perf-overlay.ts         # 0.5.0 — FPS / frame time / draw call / atlas-miss differentiator
│   │       │   ├── viewport-portal.ts      # 0.6.0 — world-coord DOM portal (scales with viewport)
│   │       │   ├── edge-label-overlay.ts   # 0.6.0 — HTML edge label alternative to atlas SDF
│   │       │   ├── edge-toolbar.ts         # 0.7.0 — edge-anchored variant of NodeToolbar
│   │       │   ├── helper-lines.ts         # 0.8.0 — Figma-style alignment guides + snap during drag
│   │       │   ├── proximity-connect.ts    # 0.8.0 — drag node near another → ghost line + halo → drop creates edge
│   │       │   └── html-node-type-layer.ts # 0.9.0 — per-node `<div>` overlay for `category: 'html'` custom node-types. Positioned + zoom-scaled via viewport.worldToScreen.
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
├── demo/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html                 # vanilla JS demo (deployed at dev.flowgl.ouranos.kr)
│   ├── react.html                 # React demo page
│   ├── react-app.tsx              # React demo entry
│   ├── benchmark.html             # synthetic 1K/5K/10K perf benchmark + window.__flowglBenchmark hook
│   └── examples/                  # focused single-page scenarios linked from docs/examples
│       ├── index.html             #   gallery
│       ├── minimal.html
│       ├── drag-connect.html
│       ├── animated-edges.html
│       ├── cjk-labels.html
│       └── hierarchical-layout.html
├── docs/                          # Vitepress public docs site (separate workspace package @flowgl/docs)
│   ├── package.json
│   ├── .vitepress/config.ts
│   ├── public/                    # logo / og-card assets copied from /assets/brand
│   ├── index.md                   # landing
│   ├── guide/                     # 10 pages: getting-started, why-flowgl, vanilla/react/vue/svelte, renderers, labels, accessibility, performance
│   ├── api/flowchart.md           # public API reference
│   ├── cookbook/index.md
│   ├── examples/index.md
│   ├── showcase.md
│   └── community.md
├── assets/
│   ├── screenshot-light.png
│   ├── screenshot-dark.png
│   └── brand/                     # logo.svg, logo-dark.svg, mark.svg, og-card.svg
├── .github/                       # Tier 1 OSS community files
│   ├── FUNDING.yml                # GitHub Sponsors button
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── MANUAL_SETUP.md            # one-time GitHub UI configuration checklist
│   ├── ISSUE_TEMPLATE/
│   │   ├── config.yml
│   │   ├── bug_report.yml
│   │   └── feature_request.yml
│   └── workflows/
│       ├── ci.yml                 # typecheck + test + build on every push
│       ├── release.yml            # workflow_dispatch → npm publish with provenance
│       └── benchmark.yml          # push + weekly cron + dispatch → measure 1K/5K/10K and check T6 floor
└── scripts/
    ├── generate-sbom.mjs          # CycloneDX 1.5 SBOM generator (4 packages)
    ├── sync-docs.mjs              # auto-sync versions + test count + coverage badge across docs
    └── run-benchmark.mjs          # Playwright + benchmark.html driver, writes docs/data/benchmarks.json + checks T6 floors
```

## Canvas Overlay Stack
Overlays are positioned absolutely on top of the WebGL canvas, inside the container div.

| Layer | Element | z-index | Purpose |
|-------|---------|---------|---------|
| highlight overlay | `<canvas>` 2D | 1 | Yellow dashed rect around highlighted nodes |
| status overlay | `<canvas>` 2D | 2 | Node status badges (error/warning/success/info) |
| waypoint overlay | `<div>` | 15 | Waypoint handle DOM elements |
| minimap | `<canvas>` 2D | 20 | Mini navigation map, click-to-pan |
| helper lines (0.8.0) | `<div>` | 25 | Pink alignment guides during node drag |
| proximity ghost / halo (0.8.0) | `<div>` | 24 | Teal dashed line + halo when a drag is near a target node |
| panel / controls (0.5.0) | `<div>` | 30 | 9-position floating widgets + built-in control bar |
| viewport portal (0.6.0) | `<div>` | 35 | World-coord DOM content that scales with the viewport |
| node toolbar / edge toolbar (0.5.0 / 0.7.0) | `<div>` | 40 | Constant-size floating toolbars anchored to nodes / edges |
| edge label overlay (0.6.0) | `<div>` | 40 | HTML edge labels anchored at the rendered-path midpoint |
| perf overlay (0.5.0) | `<div>` | 60 | FPS / frame time / draw call / atlas-miss stats |

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
- Edge geometry (0.8.1): every consumer of edge geometry — hit testing, WebGL/Canvas2D atlas SDF labels, HTML edge labels, EdgeToolbar anchor, SVG export, viewport culling — reads from `renderer/webgl/util/edge-geometry.ts`. The shared module exposes `edgePathPoints` (rendered polyline, 4-branch decision), `edgeMidpoint` (arc-length walk), `edgeBoundingBox` (tight AABB), and `edgePathFingerprint` (cache key). Pre-0.8.1 each consumer derived geometry on its own and most got at least one branch wrong; consolidating closed an entire regression class.
- Mutation emit (0.8.2): every mutation to a node or edge fires `nodeUpdate` / `edgeUpdate`, regardless of which call site triggered it. `Graph.setMutationListener` is the single emit point — `FlowChart` wires it in the constructor. Pre-0.8.2 14 + direct `graph.updateNode/updateEdge` callsites in `flowchart.ts` skipped the emit; React state mirrors / persistence / undo middleware silently lost the change. Same regression-class shape as the 0.8.1 edge-geometry consolidation; fix by single-listener routing rather than 14 surgical edits.
- Sanitizer plumbing (0.8.2): every overlay that writes a `content: string` to `innerHTML` (`Panel`, `NodeToolbar`, `EdgeToolbar`, `ViewportPortal`, `EdgeLabel`) routes through `services/sanitize-html.ts#sanitizeContent`, which warns once per page load with the source overlay name when no `sanitizeHtml` option is configured. Pre-0.8.2 only `HtmlOverlay` emitted that warning — host apps that wired sanitization to `HtmlOverlay` because that's the one that warned still had five other unsanitized sinks.
- WCAG 2.2 AA hardening (0.8.2): the 5 blockers identified by the a11y audit are closed in code — Tab no longer traps focus (2.4.3), canvas gets a `:focus-visible` ring drawn via `box-shadow` since `outline` is occluded by the GPU surface (2.4.7), keyboard zoom (`Ctrl/Cmd +`/`-`) is bound (2.1.1), WebGL init failures fire an assertive `aria-live` announcement (4.1.3), and PerfOverlay label contrast meets 4.5:1 (1.4.3). Reduced-motion guards on `layout-animator` and the PerfOverlay flash animation respect 2.3.3.
- Reactive data (0.8.0): `updateNodeData(id, partial)` merges into `node.data` and fans out to subscribers. A `dataUpdateStack` tracks the active propagation chain — when a subscriber writes back to a node already on the stack, propagation is halted and a `nodeDataCycle` event fires. Explicit cycle break (differentiator vs React Flow's equivalent, which stack-overflows).
- Drag pipeline (0.8.0): `NodeDrag.setPostSnap()` lets layers rewrite drag coordinates after grid snap, before `updateNode`. Helper Lines reach into this hook; consumers with custom snap heuristics can register their own.

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
pnpm test           # run 1119 tests across all packages (1102 core / 17 react / 9 vue / 9 svelte)
pnpm build          # production build (minified)
pnpm build:dev      # development build (readable + sourcemaps)
pnpm typecheck      # tsc --noEmit (all packages)
```
