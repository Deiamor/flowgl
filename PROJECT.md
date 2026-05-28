# PROJECT.md

## Overview
WebGL2-based flowchart library. No external runtime dependencies. Framework-agnostic pure ESM core.

## Tech Stack
- Language: TypeScript 5.x (strict)
- Rendering: WebGL2 (instanced rendering, SDF rounded rects, bezier tessellation)
- Text: Canvas 2D texture atlas → WebGL texture (2-pass, RTL support)
- Build: Rollup 4 + @rollup/plugin-typescript, javascript-obfuscator (production)
- Test: Vitest + happy-dom (127 tests, 10 files)
- Dev server: Vite (demo only)
- Package manager: pnpm workspaces

## Directory Tree
```
flowchart/
├── package.json               # root (private)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── packages/
│   └── core/
│       ├── package.json       # @flowchart/core
│       ├── tsconfig.json
│       ├── rollup.config.mjs  # Rollup config (plain ESM, obfuscation plugin)
│       ├── vitest.config.ts
│       ├── README.md          # Public API reference
│       └── src/
│           ├── index.ts       # public API exports
│           ├── flowchart.ts   # FlowChart class (main entry)
│           ├── types.ts       # shared type definitions
│           ├── events/
│           │   └── emitter.ts
│           ├── graph/
│           │   ├── node.ts
│           │   ├── edge.ts
│           │   └── graph.ts
│           ├── viewport/
│           │   └── viewport.ts
│           ├── history/
│           │   └── history.ts
│           ├── layout/
│           │   └── auto-layout.ts
│           ├── interaction/
│           │   ├── hit-test.ts
│           │   ├── edge-hit-test.ts
│           │   ├── pan-zoom.ts      # mouse + touch pan/zoom/pinch
│           │   ├── drag.ts          # node drag (mouse + touch)
│           │   ├── connect.ts       # handle drag → edge connection (mouse + touch)
│           │   ├── keyboard.ts      # keyboard shortcuts + Tab/Arrow nav
│           │   ├── box-select.ts    # rubber-band multi-select
│           │   ├── context-menu.ts  # right-click context menu
│           │   ├── label-edit.ts    # inline label editing (double-click)
│           │   └── edge-reroute.ts  # edge control point dragging
│           ├── renderer/
│           │   ├── interface.ts
│           │   └── webgl/
│           │       ├── index.ts           # WebGL2Renderer
│           │       ├── context.ts
│           │       ├── cull.ts            # frustum culling
│           │       ├── buffers/
│           │       │   └── dynamic-buffer.ts
│           │       ├── atlas/
│           │       │   └── text-atlas.ts  # Canvas2D → WebGL texture atlas
│           │       ├── programs/
│           │       │   ├── node-program.ts
│           │       │   ├── edge-program.ts
│           │       │   ├── text-program.ts  # node + edge label rendering
│           │       │   ├── handle-program.ts
│           │       │   └── grid-program.ts
│           │       └── util/
│           │           ├── bezier.ts
│           │           └── color.ts
│           ├── ui/
│           │   └── context-panels.ts
│           ├── utils/
│           │   └── id.ts
│           └── __tests__/
│               ├── flowchart.test.ts
│               ├── connect.test.ts
│               ├── panZoom.test.ts
│               ├── drag.test.ts
│               ├── keyboard.test.ts
│               ├── boxSelect.test.ts
│               ├── graph.test.ts
│               ├── history.test.ts
│               ├── layout.test.ts
│               └── viewport.test.ts
└── demo/
    ├── package.json
    ├── vite.config.ts
    └── index.html
```

## Key Design Decisions
- Nodes: WebGL2 instanced draw (single draw call for all nodes)
- Edges: CPU bezier → triangle strip, packed into one VBO per frame
- Text: OffscreenCanvas → 2048×2048 texture atlas, shelf-packing, 2-pass render (pre-warm → vertex gen)
- Hit test: CPU AABB (no GPU color picking)
- Renderer abstraction: `Renderer` interface → WebGL2 implementation
- SSR safety: `typeof window === 'undefined'` guard at FlowChart constructor entry
- Obfuscation: production build only (`MODE !== 'development'`), splitStrings disabled to protect GLSL

## Build Commands
```bash
pnpm build          # production build (obfuscated)
pnpm build:dev      # development build (readable + sourcemaps)
pnpm test           # run 127 tests
pnpm typecheck      # tsc --noEmit
```
