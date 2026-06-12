# Why flowgl

There are good flowchart libraries already. Why another one?

## The short version

Every other diagramming library renders to **SVG or Canvas 2D** — both
CPU-bound and DOM-heavy. They hit a performance ceiling at one to two
thousand nodes, and most of them require buying into a specific framework.

flowgl renders the entire graph through a single **WebGL2** context:
instanced draw calls, frustum culling, fragment-shader text atlas. The
result is smooth interaction at graph sizes the SVG-based tools can't
reach — verified at **10,000 nodes ≥ 60 fps** in the
[PERFORMANCE.md](https://github.com/Deiamor/flowgl/blob/master/packages/core/PERFORMANCE.md)
benchmarks.

The core has **zero runtime dependencies** — no D3, no Lodash, no
framework — and a thin wrapper layer for React, Vue, and Svelte. Switch
frameworks without rewriting your editor.

## How it compares

| | **flowgl** | React Flow | mermaid |
| --- | --- | --- | --- |
| Renderer | WebGL2 (GPU) | SVG | SVG |
| Runtime dependencies | **0** | ~6 | ~15 |
| Touch support | ✅ | ✅ | ❌ |
| Built-in undo / redo | ✅ | ❌ | ❌ |
| Group nodes (collapse/expand) | ✅ | partial | ❌ |
| Framework wrappers | React, Vue, Svelte | React only | — |
| SSR-safe | ✅ | ✅ | ✅ |
| Provenance signed | ✅ (sigstore) | ❌ | ❌ |
| SBOM in tarball | ✅ (CycloneDX 1.5) | ❌ | ❌ |

The comparison isn't "flowgl is always the right answer" — for a static
flowchart embedded in a docs page, mermaid's Markdown integration is
hard to beat. For a React-only product where 500 nodes is the upper
bound, React Flow is mature and battle-tested.

flowgl is the right answer when you have **at least one** of these:

- More than a couple thousand nodes
- A non-React stack
- A supply-chain audit that wants zero dependencies and signed builds
- A workload where the renderer is the bottleneck

## The Core Value Tenets

If the comparison above caught your eye, the next page to read is
[PRODUCT.md](https://github.com/Deiamor/flowgl/blob/master/PRODUCT.md).
It defines the seven non-negotiable properties that every PR is checked
against:

1. **T1 — GPU-First Rendering.** Default renderer is and stays WebGL2.
2. **T2 — Zero Runtime Dependencies** in `@flowgl/core`. Hard line.
3. **T3 — Framework-Agnostic Core.** No React / Vue / Svelte imports.
4. **T4 — Renderer-Backend Interchangeability.** Public API is backend-agnostic.
5. **T5 — Visual Feature Parity Across Backends.** No "works on WebGL2 only".
6. **T6 — Performance Tier.** 1K @ 60fps, 5K @ 60fps target, 10K @ 30fps floor.
7. **T7 — Accessibility.** WCAG 2.2 AA, axe-clean, keyboard-complete.

Outside contributors get to see these too — they're not internal-only
guidance. The intent is that "no surprises" is a property of the library,
not just a slogan.

## Migrating from React Flow

A more detailed migration guide is coming with 0.6. In the meantime, the
high-level mapping:

| React Flow | flowgl |
| --- | --- |
| `<ReactFlow nodes={} edges={} />` | `<Flowchart nodes={} edges={} />` from `@flowgl/react` |
| `useNodesState` / `useEdgesState` | controlled props + `onNodesChange` / `onEdgesChange` callbacks |
| `Background` component | `grid` option on `FlowChart` |
| `MiniMap` component | `minimap` option on `FlowChart` |
| Custom node types | `htmlContent` (custom HTML overlay) — a registry-based API is on the [roadmap](https://github.com/Deiamor/flowgl/blob/master/ROADMAP.md) |
| Layout (manual) | built-in `hierarchicalLayout` + `circularLayout` |

If you hit a missing piece during migration, file an issue with the
`migration` label and we'll either point you at the equivalent or add it
to the roadmap with your use case attached.

## Why not just contribute to React Flow?

React Flow is excellent and has a thriving ecosystem. flowgl exists for
the workloads where the design choice "always render through React" is
the bottleneck — once a graph is large enough that React reconciliation
+ SVG DOM updates dominate the frame budget, no amount of optimization
inside the existing architecture fixes that. A separate renderer is the
honest answer.

We're also Vue- and Svelte-friendly, which a React-only library can't be.
