# PROJECT.md

## Overview
WebGL2-based flowchart library. No external runtime dependencies. Framework-agnostic pure ESM core.

## Tech Stack
- Language: TypeScript 5.x (strict)
- Rendering: WebGL2 (instanced rendering, SDF rounded rects, bezier tessellation)
- Text: Canvas 2D texture atlas → WebGL texture
- Build: Rollup 4 + @rollup/plugin-typescript
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
│       ├── rollup.config.ts
│       └── src/
│           ├── index.ts       # public API
│           ├── flowchart.ts   # FlowChart class (main entry)
│           ├── events/
│           │   └── emitter.ts
│           ├── graph/
│           │   ├── node.ts
│           │   ├── edge.ts
│           │   └── graph.ts
│           ├── viewport/
│           │   └── viewport.ts
│           ├── renderer/
│           │   ├── interface.ts
│           │   └── webgl/
│           │       ├── index.ts         # WebGL2Renderer
│           │       ├── context.ts
│           │       ├── cull.ts          # frustum culling
│           │       ├── buffers/
│           │       │   └── dynamic-buffer.ts
│           │       ├── atlas/
│           │       │   └── text-atlas.ts
│           │       └── programs/
│           │           ├── node-program.ts
│           │           ├── edge-program.ts
│           │           └── text-program.ts
│           └── interaction/
│               ├── hit-test.ts
│               ├── pan-zoom.ts
│               └── drag.ts
└── demo/
    ├── package.json
    ├── vite.config.ts
    └── index.html
```

## Key Design Decisions
- Nodes: WebGL2 instanced draw (single draw call for all nodes)
- Edges: CPU bezier → triangle strip, packed into one VBO per frame
- Text: OffscreenCanvas → 2048×2048 texture atlas, shelf-packing
- Hit test: CPU AABB (no GPU color picking)
- Renderer abstraction: `Renderer` interface → WebGL2 implementation; Canvas2D possible later
