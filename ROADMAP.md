# ROADMAP

flowgl is a community-funded MIT library. There's no commercial backlog, no
"Pro tier" gating decisions, and no internal-only milestones. The roadmap
below is the same one the maintainer works from.

This document is a **direction of travel**, not a release commitment. Items
move between sections as priorities and outside contributions land. The
Keep a Changelog-style record of what actually shipped lives in
[CHANGELOG.md](./CHANGELOG.md); the append-only ledger lives in
[HISTORY.md](./HISTORY.md).

## Now (active — 0.9.x window)

The 0.5.0 / 0.6.0 / 0.7.0 / 0.8.0 milestones all shipped between
2026-06-12 and 2026-06-13. The React-Flow-parity track and the
reactive-data + drag-UX track are now closed. 0.8.1 (2026-06-13)
landed a regression-class fix consolidating every edge-geometry
consumer behind a shared `edge-geometry` helper after a user reported
that waypoint-inserted edges became unselectable.

Items below were the original "Now" list — kept here because they are
the operational backbone (docs, examples, benchmarks, identity,
discussions) rather than code milestones.

- ✅ **Official documentation site** — Vitepress under `docs/`, deployed
  at [docs.flowgl.ouranos.kr](https://docs.flowgl.ouranos.kr/). 16
  pages: landing, 10-page guide (getting-started, why-flowgl,
  vanilla/react/vue/svelte, renderers, labels, accessibility,
  performance), API reference, cookbook, examples, showcase, community.
- ✅ **Examples gallery** — 25 focused scenarios under `demo/examples/`,
  live at [dev.flowgl.ouranos.kr/examples/](https://dev.flowgl.ouranos.kr/examples/).
  Drag, connect, group, waypoints, multi-line CJK labels, animated
  edges, status badges, custom HTML nodes, minimap, fit view, search,
  json roundtrip, PNG/SVG export, animated + hierarchical layout.
- ✅ **Automated benchmark workflow** —
  [`.github/workflows/benchmark.yml`](https://github.com/Deiamor/flowgl/blob/master/.github/workflows/benchmark.yml)
  drives `demo/benchmark.html` through Playwright + SwiftShader
  Chromium on push to `packages/core/src/**` + weekly cron. Results
  archive to `docs/data/benchmarks.json`; below-floor opens an issue
  automatically. (Dashboard page with time-series graph is the next
  iteration — see below.)
- ✅ **Logo + visual identity** — SVG wordmark, dark/light variants,
  square mark for favicon, 1200×630 OG card. Live in the README hero
  (with `<picture>` dark-mode swap), the docs site, and social shares.
- ✅ **GitHub Discussions** — Q&A / Ideas / Show & Tell / Announcements
  categories live at
  [github.com/Deiamor/flowgl/discussions](https://github.com/Deiamor/flowgl/discussions).
  Seed posts are the next contributor-facing step.

### Now — next sweep

- ✅ **Benchmark dashboard page** — live at
  [docs.flowgl.ouranos.kr/benchmarks](https://docs.flowgl.ouranos.kr/benchmarks).
  Inline SVG time-series of 10K-node fps, T6 floor (30 fps) as a red
  dashed reference, latest run summary with per-tier floor checks.
  `docs/public/data/benchmarks.json` seeded with the PERFORMANCE.md
  baseline; the workflow appends to it on every run.
- ✅ **Cookbook recipes** — 7/7 written: auto-connect, state-store,
  html-node, animated-layout, svg-to-pdf, ssr, untrusted-json. Each
  links into the examples gallery and the relevant guide page.
- 🟡 **Seed Discussions** — Welcome-post bodies prepared in
  [.github/DISCUSSIONS_WELCOME.md](https://github.com/Deiamor/flowgl/blob/master/.github/DISCUSSIONS_WELCOME.md).
  Maintainer pastes + pins.

---

## ✅ Shipped — 0.5.0 / 0.6.0 / 0.7.0 / 0.8.0 / 0.8.1

The four milestone cycles plus one regression-class fix below shipped
on 2026-06-12 and 2026-06-13. Items kept here for reference; full
per-item rationale and acceptance criteria are in `CHANGELOG.md` and
`HISTORY.md`.

| Milestone | Date | Items |
| --- | --- | --- |
| **0.5.0** | 2026-06-12 | Panel · Controls · NodeToolbar · PerfOverlay (differentiator) · `setTheme('system')` · `isValidConnection` alias |
| **0.6.0** | 2026-06-12 | ViewportPortal · EdgeLabel (HTML) · NodeResize options polish · `NodeData.extent` · `NodeData.easyConnect` · `@flowgl/react` hooks |
| **0.7.0** | 2026-06-13 | `'smoothstep'` edge type + `pathOptions` · EdgeToolbar |
| **0.8.0** | 2026-06-13 | Computing Flows + cycle detection (differentiator) · `NodeData.expandParent` · Helper Lines · Proximity Connect |
| **0.8.1** | 2026-06-13 | Edge geometry shared helper — 7-consumer regression-class fix (the user-reported waypoint-unselectable bug + six audit findings + two CDP-found extras) |

Test counts grew from 934 (pre-0.5.0) to **1082** (post-0.8.1) across
41 test files in core, plus 17 in `@flowgl/react`.

---

## 0.5.0 — UI components 1차 + 차별화 시드

Filtered from a complete React Flow analysis (June 2026). The selection
respects every Core Value Tenet (PRODUCT.md): WebGL2 stays default,
core stays zero-dep, parity stays across renderer backends, T6 floor
unchanged. The detailed selection rationale + the "won't do" list at
the bottom are recorded so the next sprint doesn't re-litigate them.

| Item | Notes |
| --- | --- |
| **`Panel`** | DOM overlay above the viewport. 9-position layout (top-left … bottom-right). DOM only — no renderer change. |
| **`Controls`** | zoom +/-, fit view, lock/interactive toggle, custom `ControlButton`. Wires onto existing public methods (`zoomIn`/`fitView`/`setReadOnly`). |
| **`NodeToolbar`** | Floating, **constant size regardless of zoom** (key UX property). Auto-shows on selection by default. `position`/`align`/`offset`/`isVisible`/single-or-multi `nodeId`. |
| **`colorMode: 'light' \| 'dark' \| 'system'`** | `'system'` follows `prefers-color-scheme`. Adds to existing `setTheme`. |
| **`isValidConnection` alias** | Backward-compatible alias for `onBeforeConnect`. React Flow parity for an existing capability. |
| **`<PerfOverlay>` — differentiation** | fps + frame time + atlas eviction + node count overlay. React Flow has nothing equivalent. Surfaces flowgl's WebGL2 advantage as a visible UI. |

### 0.5.0 acceptance criteria

- Every item behind an opt-in option — no default behavior change for existing apps.
- axe-clean across every new UI surface; keyboard-reachable.
- T6 floor (1K/5K/10K) preserved; the Benchmark workflow gains a
  "UI overlay active" scenario.
- `atlas-cjk-diag` PARITY + ENTRY MAPPING still pass.
- 4 new examples in the gallery: Panel, Controls, NodeToolbar, PerfOverlay.
- CHANGELOG 0.5.0 + HISTORY append.

## 0.6.0 — UI components 2차 + Subflow 강화

| Item | Notes |
| --- | --- |
| **`NodeResizer` polish** | minW/H, maxW/H, `keepAspectRatio`, `autoScale` (zoom-aware handle size), `shouldResize` predicate, onResize{Start,End}. Extends existing `interaction/node-resize.ts`. |
| **`EdgeLabelRenderer`** | HTML overlay label option for edges (alongside the existing atlas SDF labels). "Use sparingly — performance cost scales with edge count" documented at the API boundary. |
| **`ViewportPortal`** | World-coord DOM portal — children scale with zoom and follow pan. Companion to `NodeToolbar` (which is constant size). |
| **`extent: 'parent'`** | Clamp a child node inside its parent's bbox on drag. |
| **Easy Connect** | Whole-node-as-handle pattern via `NodeData.easyConnect: boolean`. |
| **React hooks** | `@flowgl/react` gains `useFlowChart` / `useNodes` / `useEdges` / `useViewport` / `useSelection`. Built on `useSyncExternalStore` — no new dep. Core stays framework-agnostic (Tenet T3). |

### 0.6.0 acceptance criteria

- T3 preserved: zero framework imports under `packages/core/src/`.
- T2 preserved: no new runtime dependency in any wrapper package.
- React hooks: unit-tested via `@testing-library/react`.
- 6 new gallery examples.
- CHANGELOG 0.6.0 + HISTORY append.

## 0.7.0 — Edge variant (selective) + EdgeToolbar

| Item | Notes |
| --- | --- |
| **`EdgeToolbar`** | NodeToolbar pattern for edges. Code reuse from 0.5.0. |
| **`type: 'smoothstep'`** + `pathOptions` | Adds **only** the most-asked-for edge variant. `straight` / `step` / `simplebezier` are intentionally deferred — see "Won't / Deferred" below. |

### 0.7.0 acceptance criteria

- T5: smoothstep renders identically on WebGL2 and Canvas2D. Pixel
  parity gate in `atlas-cjk-diag` extended with edge-type variants.
- T6 floor unchanged.

## 0.8.0+ — Reactive data flow + Helper Lines

| Item | Notes |
| --- | --- |
| **Computing Flows** — `updateNodeData(id, partial)` + `subscribeNodeData(id, listener)` | Differentiator opportunity: ship with explicit **cycle detection** (React Flow's equivalent doesn't). |
| **`expandParent`** | Lands after `extent: 'parent'` (0.6) has bedded in. |
| **Helper Lines** | Figma-style alignment guides during drag, plus snapping at threshold. Built on `viewport.worldToScreen` + drag callbacks. |
| **Proximity Connect** | Drag a node near another → auto-suggest connection. |

## Won't / Deferred (from the React Flow review)

These items came up but did not pass the filter. Recorded so they don't
get re-proposed without an explicit revisit.

- **Edge types `straight` / `step` / `simplebezier`** — 5× tessellation
  paths × 2 renderer backends × visual regression coverage for low
  marginal value. Will revisit on explicit user request. `smoothstep`
  (0.7.0) covers the common ask.
- **Per-edge `markerStart`** — `markerEnd` is the common case;
  `markerStart` is rare enough to defer until requested.
- **Relative-coordinate child positioning** (React Flow's child = parent
  relative) — would invade hit-test, drag, render, group, export, and
  JSON schema layers. **Defer to a future 1.x major.** Absolute child
  coordinates work fine for the current shape of the library.
- **Lasso selection** — box-select covers the cases we want. Lasso is a
  whiteboard-tool affordance that pulls flowgl off-mission.
- **Vue composables / Svelte stores** — React hooks (0.6) land first.
  Wrappers grow when there's traction signal in that framework, not
  speculatively.
- **All-out React Flow chase** — committing to >50% of React Flow's
  surface would erase flowgl's "WebGL2 + zero-dep" identity for a
  duplicate of a mature competitor's API. Every cycle must include at
  least one item that React Flow does not offer (0.5.0: PerfOverlay).

## Next (under design — 0.6+ window)

Items here are on the maintainer's mind but the API is not nailed down
yet. Comments and design proposals very welcome in Discussions or an
issue.

- **Custom node-type registry** — register a node shape + renderer
  + interaction hooks under a name once, then pass that name in
  `NodeData.type`. The shape primitives we already have (rectangle /
  diamond / hexagon / ellipse / circle) become the built-in registry
  entries. Goal: external plugin authors can publish `@my-org/flowgl-node-foo`
  on npm and consumers just `import` + register.
- **Theme tokens API** — `setTheme('light' | 'dark' | CustomTheme)`
  already exists; expose the underlying token set as a documented
  schema so themes can be authored, published, and composed. Probably
  align loosely with the Open Color or Radix token shape so it doesn't
  invent a vocabulary.
- **Async layout worker contract** — `LayoutWorkerClient` exists for
  hierarchical layout. Generalize so any layout algorithm (force,
  ELK-style orthogonal, custom) can run in a worker without blocking
  the main thread, and so the host app can ship its own worker.
- **CRDT collaboration hook** — not a built-in CRDT, but a documented
  observer surface (`chart.observe(mutationListener)` + apply-from-remote
  API) that lets a host app wire Yjs / Automerge / Liveblocks without
  forking the library. Multi-cursor / selection presence is a separate
  layer the host owns.

## Later (longer arc)

Items that need traction, contributors, or significant design work before
they're worth starting.

- **Plugin / extension marketplace** — once the node-type registry has
  a stable contract, a documented `@flowgl/plugin-*` namespace + a
  showcase page collecting community plugins.
- **Migration guides** — a `docs/migration/` section that explains
  every breaking change between minor versions, with codemods where the
  rename is mechanical. We've kept the public API stable so far; this
  becomes necessary the first time we break something on purpose.
- **More renderer backends** — possible candidates: WebGPU (when the
  feature surface stabilizes), a server-side renderer for SSR PNG
  previews. Both have to clear the T5 parity bar before they're allowed
  to ship.
- **Native bindings exploration** — embedded contexts (Tauri / Electron
  / native browser-in-app) shouldn't need a different API. Mostly a
  documentation + CI sweep, but flagged here so it's visible.

## Won't / Will-not

Setting expectations is part of the roadmap too.

- **No commercial Pro tier.** The library is and will remain MIT. If
  upstream maintenance ever needs paid help, it'll be funded through
  GitHub Sponsors and named patron tiers, not a paywall.
- **No React-only or Vue-only API.** Framework wrappers stay thin and
  optional; the core stays framework-agnostic (T3).
- **No external runtime dependency in `@flowgl/core`.** T2 is the
  hardest line we hold — if a feature requires a new dep, the right
  answer is almost always "ship it in an opt-in companion package",
  not "add it to core".
- **No silent default changes.** A change that flips the default
  renderer, the default option, or any user-visible behavior is always
  a `Changed` line in the CHANGELOG, an `HISTORY.md` append, and at
  least a minor version bump.

## Contributing

The roadmap is editable like everything else. If a "Later" item matters
to you, open a Discussion describing your use case — that's how items
move into "Next" and "Now". If you want to take on a "Now" item, comment
on the relevant issue (or open one) saying so; the maintainer will
either pair with you or get out of the way.

The full contribution guide lives in [CONTRIBUTING.md](./CONTRIBUTING.md).
