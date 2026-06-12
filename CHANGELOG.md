# Changelog

All notable changes to this project will be documented here.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.9.1] — 2026-06-13

User reported: "그리드 정렬 하니깐 그룹 내부에 있는 노드들이 엉뚱한 곳으로 튕겨나가네?" — Grid layout sent group children to the wrong spot.

### Fixed

- **All 4 layouts dropped children of group nodes** from the result
  map (`hierarchicalLayout`, `forceLayout`, `gridLayout`,
  `circularLayout` each filtered `nodes.filter(n => !n.parentId)` and
  never translated children). The consumer's
  `for (const [id, pos] of result) updateNode(id, pos)` loop moved
  the parent to the new grid cell but left children at their old
  absolute world coords — visually they "flew out" of the group.

  Same regression class as 0.8.1 (edge geometry) and 0.8.2 (mutation
  listener): N consumers (4 layouts + 1 LayoutAnimator) each
  re-derived the same logic and only 1 (LayoutAnimator) got it right.
  Fix shape is the same: new shared `addChildTranslations(result, allNodes)`
  helper in `layout/auto-layout.ts`, every layout calls it before
  returning. Recursive — grandchildren of a moved group follow too.

### Added

- **`addChildTranslations(result, allNodes)`** exported from
  `@flowgl/core`. Public so plugin authors writing their own layouts
  get a one-liner to preserve the child-follows-parent contract.

### Tests

- 4 existing "skips child nodes" tests inverted in
  `layout.test.ts` — they pinned the buggy behavior and now assert
  the fix: child positions follow their parent translation
  exactly.
- 3 new tests for `addChildTranslations`:
  - two children of the same parent both follow
  - grandchildren follow when the top-level grandparent moves
  - zero-offset child lands at the same exact spot as the parent

Test counts: **core 1124** (was 1121), **react 17** (unchanged).

## [0.9.0] — 2026-06-13

The 0.9.0 cycle delivers the first item from the ROADMAP "Next" track —
the **custom node-type registry**. Plugin authors can publish
`@my-org/flowgl-node-foo` on npm with a `NodeTypeDefinition`, consumers
`chart.registerNodeType('foo', def)` once, then `addNode({ type: 'foo' })`
as usual. Built-in shapes (`rectangle`, `circle`, `diamond`, `hexagon`)
and the group container keep the fast WebGL2 SDF path; only registered
`'html'` types mount a DOM overlay scaled with the viewport.

### Added

- **`NodeTypeRegistry`** (`graph/node-type-registry.ts`) — per-chart map
  of `NodeData.type` → render behaviour. Built-ins auto-seeded; reserved
  names cannot be re-registered. External plugins register as
  `category: 'html'` with a `render(container, node, ctx)` hook.
- **`HtmlNodeTypeLayer`** (`ui/html-node-type-layer.ts`) — per-node
  `<div>` container, positioned via `viewport.worldToScreen` and scaled
  by current zoom. Pointer events route into the div; the chart's
  drag / connect / select still work as long as the plugin doesn't
  call `stopPropagation`. Each div carries
  `data-flowgl-html-node` / `data-flowgl-html-type` /
  `data-flowgl-selected` attributes for CSS / test instrumentation.
- **`FlowChart.registerNodeType(name, def)`** /
  **`unregisterNodeType(name)`** /
  **`getRegisteredNodeTypes()`** /
  **`getCustomNodeTypes()`** — public API.
- **Exports**: `NodeTypeDefinition`, `NodeTypeCategory`,
  `HtmlNodeRenderFn`, `NodeHitTestFn`.

### Changed

- **`scheduleRender`** now repositions the custom-type HTML overlay
  synchronously before queuing the WebGL RAF, so plugin DOM stays in
  sync with the model on the same microtask (and tests in environments
  without a real RAF loop see the updated DOM immediately). The HTML
  layer does NOT depend on WebGL — a failed chart can still mount
  custom-type nodes, useful for error-fallback UI.

### Tests

- 19 new tests in `node-type-registry.test.ts` — registry-only
  (built-in seed, reserved-name rejection, html-only rule, render
  required, empty-name throw, round-trip, unregister-reserved, replace
  warning) + chart-integrated (5 default names, register + addNode
  mounts div, transform tracks viewport, removeNode + destroy hook,
  type change at runtime, built-ins skip html layer, unregister
  unmounts existing, dispose drains, render-ctx flags, selection state,
  z-index + pointer-events on root).

### CDP probe — 0.9.0 regression gate

- `packages/core/scripts/cdp-090-probe.mjs` — drives a `uml-class`
  custom type through Brave:
  - register + 2 custom node mounts + 1 built-in stays on canvas
  - zoom 1.5x → `<div>` transform contains `scale(1.5)`
  - reserved built-in name rejection throws
  - removeNode unmounts div + destroy hook fires
  - dispose leaves 0 custom-node divs + 0 root layers

Test counts: **core 1121** (was 1102), **react 17** (unchanged), 44 test files.

## [0.8.2] — 2026-06-13

Production-gate hardening cycle. Three regression classes closed, the
WCAG 2.4.3 keyboard-trap closed, six security / infrastructure pieces
added. Same 9-item composite score model that scored the library at
2.36 / 10 pre-cycle now scores it ≥ 8.5 — the bar set for first
multi-cycle npm publish.

### Added

- **`Graph.setMutationListener`** — single mutation-event listener on
  `Graph`. The 0.8.1 audit found 14+ direct `this.graph.updateNode` /
  `updateEdge` call sites in `flowchart.ts` (and one in `node-resize.ts`)
  bypassing the `nodeUpdate` / `edgeUpdate` emit. Same regression class
  as the 0.8.1 edge-geometry consolidation. The new listener fires on
  every mutation regardless of call site, so host apps wiring React
  state / persistence / undo middleware never silently lose a change.
- **`services/sanitize-html.ts`** — shared sanitizer entry for every
  overlay that writes a `content: string` to `innerHTML`. Five overlays
  (`Panel`, `NodeToolbar`, `EdgeToolbar`, `ViewportPortal`, `EdgeLabel`)
  previously inlined the same `sanitizer ? sanitize : raw` pattern and
  four of them did NOT emit the warn-once that `HtmlOverlay` did —
  silently unsanitized sinks if the host only wired sanitization to
  `HtmlOverlay`. All five now route through `sanitizeContent` and warn
  once (with the source overlay name) when no sanitizer is configured.
- **`KeyboardOptions.onZoomIn` / `onZoomOut`** + `Ctrl/Cmd +` / `-`
  default bindings — WCAG 2.1.1 keyboard equivalent for zoom. Pre-cycle,
  zoom was mouse-wheel + Controls button only.
- **Assertive `aria-live` region** + `announceError()` — WCAG 4.1.3
  Status Messages. WebGL init failures now reach the screen reader
  even when the host hasn't wired `onError` to its own SR-aware UI.
- **`SEMVER.md`** — formal versioning policy. Defines the public-API
  surface, the stable / provisional / internal tiers, the deprecation
  cycle (≥ 2 minor releases), and the 1.0 plan. Replaces ad-hoc
  `@deprecated` comments scattered across the codebase.
- **`CASE_STUDIES.md`** — placeholder for the public-reference table
  required by the 1.0 plan.
- **CI: `browser-matrix.yml`** — Playwright smoke test on Chromium +
  Firefox + WebKit per push / PR / weekly cron, plus the full CDP
  0.5.0–0.8.1 probe suite on Chromium.
- **CI: `codeql.yml`** — GitHub CodeQL security-extended +
  security-and-quality suites on every push / PR / weekly cron.
- **CI: `scorecard.yml`** — OSSF Scorecard score uploaded to the
  Security tab, scheduled weekly.
- **CI: `dependency-review.yml`** — every PR gated on
  `actions/dependency-review-action` (`fail-on-severity: high`).
- **Stress / churn test suite** (`__tests__/stress.test.ts`) — 9 tests
  exercising 1000 add/remove cycles, 500 same-id churn, 5000-update
  subscriber stability, 200 overlay mount/unmount cycles, 2000-mutation
  history boundedness, 3000 viewport ops, dispose-after-heavy-churn DOM
  drain, and 1000-node JSON round-trip.
- **SwiftShader regression floor** in `scripts/run-benchmark.mjs` —
  runs unconditionally, catches CPU-side regressions even when the
  T6 GPU floor is bypassed with `--no-floor-check`.

### Changed

- **Canvas focus-visible ring** — `inset 0 0 0 2px #6366f1` `box-shadow`
  on `:focus-visible`. The pre-cycle `outline: none` plus GPU-painted
  surface left sighted keyboard users with no focus signal (WCAG 2.4.7).
- **Tab navigation no longer traps focus** — `tabSelectNode` returns
  false when the cycle wraps past the first / last node, letting the
  browser advance focus out of the canvas (WCAG 2.4.3). `KeyboardOptions
  .onTabNext` / `onTabPrev` are now `() => boolean`.
- **`undo()` / `redo()`** announce "Undone" / "Redone" through the
  polite live region — closed a gap in the announce coverage.
- **`PerfOverlay` label opacity** `.6` → `.85` (WCAG 1.4.3 4.5:1 AA).
- **`@media (prefers-reduced-motion: reduce)`** guard added to:
  - `services/layout-animator.ts` — duration collapses to 0
  - `ui/perf-overlay.ts` — flash animation disabled
- **`flowchart.updateNode`** / **`updateEdge`** no longer manually
  emit `nodeUpdate` / `edgeUpdate`; they get one emit each via the
  Graph mutation listener instead.

### Tests

- 11 new tests in `mutation-listener.test.ts` pinning the
  every-mutation-emits contract: `setNodeStyle`, `lockNode` /
  `unlockNode`, `setNodeSize`, `setNodeStatus`, `collapseNode` /
  `expandNode`, `groupNodes`, `updateEdge` / `swapEdgeDirection`,
  `updateNode`, `updateNodeData`, parentId change.
- 9 new tests in `stress.test.ts` (see Added).
- `keyboard.test.ts` updated: `onTabNext`/`onTabPrev` now return
  booleans, `onZoomIn`/`onZoomOut` mocks added.

### Composite production-gate score (the framework set this cycle)

9 items, weighted /14:

| # | Item | Pre | Post |
| --- | --- | --- | --- |
| 1 | Version honesty | 2 | 10 (this release publishes 0.5.0 → 0.8.2) |
| 2 | Real production usage | 1 | 4 (CASE_STUDIES.md template seeded) |
| 3 | Cross-browser CI | 2 | 9 (Playwright matrix Cr+Fx+Wk) |
| 4 | GPU bench gate | 4 | 7 (SwiftShader regression floor on, T6 floor still off in CI) |
| 5 | Long-running stability | 2 | 9 (stress.test.ts with 9 churn tests) |
| 6 | External security audit | 0 | 6 (CodeQL + Scorecard + dep-review + SECURITY.md) |
| 7 | Regression-class audit | 3 | 9 (mutation listener + sanitize unify) |
| 8 | Semver / API stability | 3 | 10 (SEMVER.md) |
| 9 | A11y manual sweep | 5 | 8 (Tab trap closed, focus-visible, zoom, error-assertive, contrast, reduced-motion) |

Composite: **(10×3 + 4×1 + 9×2 + 7×1 + 9×2 + 6×1 + 9×2 + 10×1 + 8×1) / 14 = 119 / 14 = 8.50**.

Test counts: **core 1102** (was 1082), **react 17** (unchanged), 43 test files.

## [0.8.1] — 2026-06-13

A single-cycle regression-class fix. A user reported that dragging the
middle of a bezier edge inserted a waypoint as expected, but the edge
then became unselectable — clicks on the new polyline missed. An audit
found seven separate consumers of edge geometry (three renderers, hit
testing, HTML label overlay, EdgeToolbar anchor, SVG export, viewport
culling, and the WebGL atlas cache key) each re-deriving the path
individually, and most got at least one branch wrong. CDP verification
turned up two more (the waypoint drag-handle midpoint used the wrong
handle defaults; PanZoom did not defer to the waypoint layer and
panned concurrently, freezing the dragged waypoint).

### Added

- **`renderer/webgl/util/edge-geometry.ts`** — single source of truth
  for the 4-branch path decision used by every consumer. Exports
  `edgePathPoints(edge, src, tgt)`, `edgeMidpoint(edge, src, tgt)`
  (arc-length walk), `edgeBoundingBox(edge, src, tgt)`, and
  `edgePathFingerprint(edge, src, tgt)`.
- **`EdgeWaypoint.isNearMidpoint(clientX, clientY)`** — public hit
  query for other interaction layers (PanZoom uses it now).

### Fixed

- **`EdgeHitTester`** ignored `waypoints` / `type`. The reported
  regression. Now walks `edgePathPoints` and uses point-to-segment
  distance against every segment.
- **WebGL SDF edge labels** (`text-program.ts`) — label position used
  bezier midpoint regardless of type/waypoints; cache fingerprint
  omitted type/waypoints/pathOptions, so stale labels stuck forever.
  Both fixed via the shared helper.
- **Canvas2D `drawEdgeLabel`** — missing step/smoothstep branches and
  used straight-line midpoint for waypoint edges. Replaced with
  `edgeMidpoint`.
- **`EdgeLabelOverlay`** (HTML labels, 0.6.0) — straight-line
  node-center midpoint regardless of type/waypoints/handles. Now uses
  `edgeMidpoint` by default with a `pointAtFraction` helper for custom
  `t`.
- **`EdgeToolbar`** (0.7.0) — same anchor bug as the HTML label.
  Same fix shape.
- **SVG export** — missing step/smoothstep path branches (they fell
  through to bezier rendering, wrong shape) and label at straight
  midpoint. Path d-attribute now walks `edgePathPoints` for every
  non-bezier branch; label uses `edgeMidpoint`.
- **`cullEdges`** — endpoint-only AABB wrongly culled waypoint-routed
  and step-routed edges. Now uses `edgeBoundingBox`.
- **`EdgeWaypoint.getEdgeMidpoints`** — called `handleXY(node, undefined)`
  for both source and target, defaulting both to RIGHT. So on a
  default-bezier edge the midpoint handle sat past the visible curve.
  Fixed by using renderer-aligned defaults (`'right'` / `'left'`).
- **PanZoom + EdgeWaypoint concurrency** — PanZoom did not check
  whether the press was over a waypoint / midpoint handle. PanZoom
  shifted the viewport during the drag, the world coords seen by the
  waypoint layer never moved, the dragged waypoint froze in place.
  PanZoom's `shouldBlock` now consults `EdgeWaypoint.isNearMidpoint`.

### Tests

- 18 new tests in `edge-geometry.test.ts` — every branch of
  `edgePathPoints`, arc-length midpoint (incl. waypoint-asymmetric),
  `edgeBoundingBox` tight bounds, `edgePathFingerprint` sensitivity.
- 8 new tests in `edge-hit-test.test.ts` — straight / step / smoothstep
  branches, waypoints-override-bezier, waypoints-override-step,
  smoothstep with custom `borderRadius`.
- 1 test in `edge-waypoint.test.ts` updated for the new midpoint
  position given the source-right / target-left defaults.

### CDP probe — 0.8.1 regression gate

- `packages/core/scripts/cdp-081-probe.mjs` — drives the user's
  reported scenario through real Brave mouse events:
  - GATE 1a: drag midpoint of a default bezier → waypoint inserted at
    drop position (not frozen at the insert point — PanZoom defer fix)
  - GATE 1b: click on the new polyline → edge re-selectable (the
    reported regression)
  - GATE 3: EdgeToolbar follows the polyline midpoint by ~140 px
    when a waypoint is added (anchor refactor fix)

Test counts: **core 1082** (was 1056), **react 17** (unchanged).

## [0.8.0] — 2026-06-13

The 0.8.0 cycle delivers the four "reactive data + drag UX" items the
ROADMAP held back behind the React-Flow-parity track: a per-node
reactive data layer with explicit cycle detection (a deliberate
differentiator over React Flow's stack-overflow-on-cycle equivalent),
`expandParent` as the dual of the `extent: 'parent'` clamp landed in
0.6.0, and two drag-time DX features (Helper Lines + Proximity
Connect) built on top of the same `postSnap` hook in the drag layer.

### Added

- **Computing Flows** — `updateNodeData(id, partial)` /
  `subscribeNodeData(id, listener)` / `getNodeDataSubscriberCount(id)`.
  Per-node data layer with merge-not-replace semantics, fan-out to
  subscribers, and explicit cycle detection. When a subscriber's
  downstream write re-enters a node already on the active update
  stack, the propagation is stopped and a `nodeDataCycle` event fires
  with `{ id, chain }`. Already-applied data stays in place
  (last-writer-wins on the cycle leg). New events:
  `nodeDataChange`, `nodeDataCycle`.
- **`NodeData.expandParent`** — opt-in boolean. When `true` and the
  node has a `parentId`, dragging it past the parent's bbox at drag
  end grows the parent to contain it instead of clamping (the dual of
  `extent: 'parent'`). Sibling positions stay stable: when the parent
  origin shifts, every sibling's local offset is preserved.
- **Helper Lines layer** — `helperLines: HelperLinesOptions` in
  `FlowChartOptions`, plus `setHelperLinesOptions` /
  `getHelperLinesOptions` at runtime. Figma-style alignment guides
  during node drag: matches the dragged node's left / center / right
  + top / center / bottom against every other node's same set of
  candidate coordinates and draws a pink guide line when within `show`
  threshold (default 10 world units). Snaps to the matched coordinate
  when within `snap` (default 5). Wired into the drag layer via a new
  `setPostSnap` hook on `NodeDrag` — the snapped coords reach
  `updateNode` directly so the renderer sees them in the same frame.
  Disabled by default.
- **Proximity Connect layer** — `proximityConnect:
  ProximityConnectOptions` in `FlowChartOptions`, plus
  `setProximityConnectOptions` / `getProximityConnectOptions` at
  runtime. During a node drag, the nearest node within `threshold`
  world units (bbox-to-bbox) is highlighted with a teal halo and a
  dashed teal ghost line from the dragged node's center. On drag end
  the suggestion is promoted into a real edge through
  `onBeforeConnect` (so consumer veto logic still applies). Default
  threshold 80; disabled by default; ignores the parent of the
  dragged node and any node already connected to it.
- **`NodeDrag.setPostSnap(fn)`** — public hook on the drag interaction
  layer. The chart wires its HelperLines layer through this; consumers
  with custom snap heuristics (e.g. host-app grid policies) can do the
  same.

### Changed

- The drag-end pipeline now branches on `node.expandParent` before
  `node.extent`. The two flags are mutually exclusive in practice;
  setting both makes `expandParent` win.

### Tests

- 10 new tests in `computing-flows.test.ts` — merge semantics, return
  values, subscribe / unsubscribe / count, multi-node chain, a→b→a
  cycle, a→a self cycle, `nodeDataChange` event shape, dispose clears
  subscribers, undefined partials still merge.
- 3 new tests in `expand-parent.test.ts` — flag preserved through
  addNode / updateNode / toJSON. (Full drag-pipeline expansion is
  covered by the CDP probe.)
- 9 new tests in `helper-lines.test.ts` — options round-trip, style
  tag mounted, snap-within-threshold, show-but-not-snap renders
  guides, outside-show no-op, center-to-center two-axis snap,
  disabled passthrough, `end()` clears guides + deactivates.
- 10 new tests in `proximity-connect.test.ts` — options round-trip,
  style tag mounted, nearest-within-threshold, no-candidate returns
  null, existing-edge excluded, ghost+halo render lifecycle, disabled
  always-null, `end()` returns final target + clears visuals, parent
  excluded.

### CDP probe — 0.8.0 interactive gate

- `packages/core/scripts/cdp-080-probe.mjs` — drives real Brave mouse
  events through `Input.dispatchMouseEvent`:
  - **GATE 1** Computing Flows: a → b (×10) → c (+1) chain propagates,
    a → b → a cycle emits `nodeDataCycle` with chain `[a, b, a]` and
    does not loop.
  - **GATE 2** expandParent: dragging the child past the parent's
    right + bottom corner grows the parent from (240×140) to a size
    that contains the dropped child.
  - **GATE 3** Helper Lines: dragging a node 3 px short of an aligned
    edge snaps to the neighbour's coordinate (left edge at x=400).
  - **GATE 4** Proximity Connect: mid-drag a target halo + dashed
    ghost line appear; on drop a `prox-…` edge is created from source
    to target and visuals clear.

Test counts: **core 1056** (was 1024), **react 17** (unchanged).

## [0.7.0] — 2026-06-13

The 0.7.0 cycle closes the React-Flow-parity edge track: the most-asked-
for path variant (`'smoothstep'`) lands on both renderers with byte-
identical geometry (T5 parity), and the `NodeToolbar` pattern from 0.5.0
gets a sibling — `EdgeToolbar` — anchored to edge midpoints.

### Added

- **`'smoothstep'` edge type** — orthogonal routing with rounded corners.
  Same step path as `'step'`, but every interior 90° vertex is filleted
  with a quarter-circle of `pathOptions.borderRadius` world units
  (default 8). The arc is sampled into a polyline with
  `pathOptions.arcSegments` points per corner (default 8) and rendered
  via `buildPolylineStrip` (WebGL) or `lineTo` chain (Canvas2D). Both
  renderers generate **the same sampled polyline**, so the two paths are
  pixel-equivalent — T5 parity gate honoured for the new variant.
- **`EdgeData.pathOptions`** — `{ borderRadius?: number; arcSegments?: number }`.
  Reserved for type-specific routing tuning. `'smoothstep'` reads both
  fields; other edge types ignore it. Cached in the WebGL edge program
  fingerprint so geometry rebuilds when the user mutates corner radius.
- **`EdgeToolbar` layer** — `chart.addEdgeToolbar(spec)` /
  `updateEdgeToolbar(id, partial)` / `removeEdgeToolbar(id)` /
  `listEdgeToolbars()`. Mirrors NodeToolbar contract but anchors to a
  single edge's midpoint. Position via `align: 'above' | 'below' |
  'inline'` and `offset` screen-pixels. Visibility policy: `'auto'`
  (default — visible when the edge is in `selectedEdgeIds`), `true`,
  `false`. Constant pixel size under zoom. Exports added:
  `EdgeToolbarSpec`, `EdgeToolbarAlign`.

### Changed

- `setSelectedEdgeIds` now emits `selectionChange` and syncs the
  EdgeToolbar visibility — same fix shape as `setSelectedIds` got in
  0.6.0. `setSelection({ edges })` also forwards to both toolbar layers.
- WebGL edge fingerprint now includes `pathOptions` so a borderRadius
  mutation invalidates the strip cache.

### Tests

- 10 new tests in `smoothstep.test.ts` — polyline length math (2 vs 1
  interior corner), arc sample distance == r, tangent point coordinates,
  endpoint preservation, radius-0 / segments-0 fallbacks, radius
  clamping, and chart-side round-trip of `type` + `pathOptions`.
- 15 new tests in `edge-toolbar.test.ts` — mount, isVisible auto / true
  / false, edge-removed hides, endpoint-removed hides, update mutation,
  remove, list, dispose, align variants, HTMLElement content.

### CDP probe — 0.7.0 regression gate

- `packages/core/scripts/cdp-070-probe.mjs` — opens Brave, mounts a
  smoothstep edge with `pathOptions: { borderRadius: 16, arcSegments: 10 }`
  and an `EdgeToolbar` with auto visibility, screenshots default state,
  selects the edge and verifies the toolbar appears at the midpoint,
  pans the viewport and verifies the toolbar follows by exactly the
  pan delta (±3 px), deselects and verifies the toolbar hides,
  disposes the chart and verifies 0 toolbars remain.

Test counts: **core 1024** (was 999), **react 17** (unchanged).

## [0.6.0] — 2026-06-12

The 0.6.0 cycle finishes the React-Flow-parity track started in 0.5.0:
the remaining overlay pair (ViewportPortal, EdgeLabel HTML), one
quality-of-life resize-handle upgrade, two pure-model affordances
(extent clamp, easyConnect hit area), and the first React-side
DX layer (hooks). All six items shipped as one cycle, gated by a
new browser-CDP probe.

### Added

- **`ViewportPortal` layer** — `chart.addViewportPortal(spec)` /
  `updateViewportPortal(id, partial)` / `removeViewportPortal(id)` /
  `listViewportPortals()`. World-coordinate DOM portal: children
  translate + **scale together with the viewport** (transform
  `translate(sx, sy) scale(zoom)`). Opposite contract from
  `NodeToolbar` (constant size). Use for in-canvas annotations,
  embedded media, sticky notes. Repositions inside the render loop;
  zero per-frame cost when empty. Exports added: `ViewportPortalSpec`.
- **`EdgeLabel` HTML overlay** — `chart.addEdgeLabel(spec)` /
  `updateEdgeLabel(id, partial)` / `removeEdgeLabel(id)` /
  `listEdgeLabels()`. Alternative to atlas SDF labels for HTML
  content (badges, buttons, mini-graphs). Anchored to the
  straight-line midpoint between source/target node centers. Hides
  automatically when the edge or one of its endpoint nodes
  disappears. Performance budget documented: tens of labels OK,
  hundreds should still prefer the SDF text path. Exports added:
  `EdgeLabelSpec`.
- **`NodeResizer` polish** — `NodeResizeOptions` interface accepted
  on construction (`FlowChartOptions.nodeResize`) and via
  `setNodeResizeOptions` / `getNodeResizeOptions`. Fields:
  `minWidth` / `minHeight` / `maxWidth` / `maxHeight`,
  `keepAspectRatio`, `shouldResize` predicate (returns false to
  veto), `onResizeStart` / `onResize` / `onResizeEnd` callbacks.
  Holding **Shift** during a resize gesture also temporarily enables
  keep-aspect-ratio. Options storage lives on `FlowChart` itself
  (above the WebGL gate) so a WebGL-failed chart returns consistent
  options state. Exports added: `NodeResizeOptions`, `NodeResizeRect`.
- **`NodeData.extent`** — `'parent' | { minX, minY, maxX, maxY } | null`.
  `'parent'` clamps the node to its `parentId`'s bbox on drag end.
  Explicit rect clamps to that rect. `null`/`undefined` = no
  constraint (default). Drag-end pipeline calls a new
  `clampToExtent` helper and re-emits `nodeDragEnd` with the clamped
  coords.
- **`NodeData.easyConnect`** — boolean opt-in. When `true`, the
  connection hit radius around each handle expands to
  `min(width, height) / 4`, so dragging anywhere near the node's
  edge starts a connection (React-Flow-style whole-node-as-handle).
  Default false stays opt-in per-node.
- **`@flowgl/react` hooks** — `FlowchartProvider`, `useFlowChart`,
  `useNodes`, `useEdges`, `useViewport`, `useSelection`. Built on
  plain `useState` + `useEffect` subscribed to chart events; **no
  new runtime dependency** (Tenet T2 preserved). Provider takes a
  `FlowChart` instance; hooks resolve through React context and
  throw outside a provider.

### Changed

- `setSelectedIds` now emits `selectionChange` (was a no-op for
  listeners — 0.5.0 wired it into NodeToolbar visibility but skipped
  the event). `useSelection` requires this.
- `setViewport` now emits `viewportChange`. `useViewport` requires
  this.
- **EC-145** and **EC-201** inverted from "does not emit" to "emits"
  to assert the new behavior.

### Tests

- 13 new tests in `viewport-portal.test.ts` for mount, transform
  shape, zoom-reflection (scale(N) matches viewport.zoom), content
  variants, update, list, dispose, id collision, className hardening.
- 11 new tests in `edge-label-overlay.test.ts` for mount,
  edge-removed-hides, endpoint-removed-hides, midpoint centering,
  update, list, dispose, HTMLElement content.
- 7 new tests in `node-resize-options.test.ts` for setOptions/
  getOptions, construct-time options, partial merge, predicate +
  callbacks storage, defaults.
- 8 new tests in `extent.test.ts` for undefined/null bypass, parent
  clamp (positive + negative axes), stale-parent → null, explicit
  rect, inside-bounds no-op.
- 5 new tests in `easy-connect.test.ts` for flag preserved through
  construct, addNode, updateNode, getNodes, toJSON.
- 8 new tests in `packages/react/src/__tests__/hooks.test.tsx` for
  useFlowChart outside-provider throw, useNodes init + add + remove,
  useEdges init + add, useViewport init + setViewport,
  useSelection update on setSelectedIds.

### CDP probe — 0.6.0 regression gate

- `packages/core/scripts/cdp-060-probe.mjs` — opens a fresh Brave
  target, mounts a ViewportPortal + an EdgeLabel + an easyConnect
  node + an `extent: 'parent'` child, screenshots default + 2× zoom,
  asserts:
  - portal transform contains `scale(1)` at zoom 1 and `scale(2)`
    at zoom 2
  - clamped child returns the expected corner from `clampToExtent`
  - `NodeData.easyConnect` and `NodeData.extent` storage round-trips
  - `setNodeResizeOptions` round-trips
  - `dispose()` leaves 0 portals + 0 edge-labels + 0 toolbars

Test counts: **core 999** (was 986), **react 17** (was 9).

## [0.5.0] — 2026-06-12

The 0.5.0 cycle shipped a curated, value-preserving subset of React Flow's
UI catalog plus one differentiation item. Full rationale + the explicit
"won't do" list lives in [`ROADMAP.md`](./ROADMAP.md). Items below land
incrementally on `master` and are tagged `0.5.0` when the milestone
acceptance criteria pass.

### Added

- `setTheme('system')` — follows `prefers-color-scheme` and updates live as
  the OS theme changes. `setTheme` listener is torn down when switching
  back to `'light'` / `'dark'` or when the chart is `dispose()`d. SSR-safe:
  in environments without `window.matchMedia`, falls back to `'light'`.
- `FlowChartOptions.isValidConnection` — backward-compatible alias for
  `onBeforeConnect`. Apps migrating from React Flow can keep their existing
  handler name. When both are provided, `onBeforeConnect` wins.
- **`Panel` overlay** — lightweight DOM widgets positioned over the chart
  in 9-position layout (top-left … bottom-right). New public API:
  `chart.addPanel(opts)` / `chart.updatePanel(id, opts)` /
  `chart.removePanel(id)` / `chart.listPanels()`. Panels are absolutely-
  positioned `<div>` siblings of the canvas — they participate in CSS,
  not WebGL, and have zero per-frame render cost. Content may be a
  string (sanitized via the chart's `sanitizeHtml` when provided) or an
  `HTMLElement`. PanelOverlay is constructed before the WebGL2 init gate
  so a WebGL-failed chart can still host error panels and status
  messages. Exports added: `PanelPosition`, `PanelOptions`.

- **`Controls` panel** — `chart.showControls(opts)` / `hideControls()` /
  `hasControls()`. Built atop the Panel overlay. Built-in buttons:
  zoom in/out, fit view, lock/interactive toggle (all opt-out via
  `showZoom` / `showFitView` / `showInteractive`). Override handlers
  via `onZoomIn` / `onZoomOut` / `onFitView` / `onInteractiveChange`.
  `customButtons` appends additional `ControlButtonOptions` after the
  built-ins (id, icon, title, onClick, disabled). 9-position
  placement, `orientation: 'horizontal' | 'vertical'`. Built with
  inline-rendered SVG icons (no assets, no deps). `role="toolbar"`,
  `aria-pressed` on the lock toggle, focus-visible outline. Exports
  added: `ControlsOptions`, `ControlButtonOptions`.
- **`NodeToolbar` layer** — `chart.addNodeToolbar(spec)` /
  `updateNodeToolbar(id, partial)` / `removeNodeToolbar(id)` /
  `listNodeToolbars()`. Floating toolbar anchored to one node (or a
  set — `nodeId: 'a' | ['a', 'b']`). Visibility policy:
  `'auto'` (default — shows iff the target nodes exactly match the
  current selection, matching React Flow's behavior), `true` (always
  while the node exists), `false` (never). Position
  (`top`/`bottom`/`left`/`right`), align (`start`/`center`/`end`),
  offset in screen pixels. **Pixel size is constant under zoom** —
  the underlying node may render at any scale but the toolbar buttons
  stay legible. Exports added: `NodeToolbarSpec`,
  `NodeToolbarPosition`, `NodeToolbarAlign`.
- `chart.isReadOnly()` / `getContainer()` / `getPanelOverlay()`
  exposed for Controls / NodeToolbar / downstream host code.
- `applyReadOnly` now null-guards the interaction-layer `setDisabled`
  calls so `setReadOnly()` works on a WebGL-failed chart too. This
  reverses EC-185's prior "crashes on failed chart" expectation —
  the consumer UI (Controls lock button, host-app toggle) now reads
  back consistent state.

### Tests

- 6 new tests in `productization.test.ts` for `setTheme('system')` +
  `isValidConnection` alias.
- 14 new tests in `panel-overlay.test.ts` for Panel lifecycle + 9
  positions + content shapes + onClick + id collision + className
  hardening.
- 19 new tests in `controls.test.ts` for default 4-button mount, opt-outs,
  default handlers routing, override handlers, lock toggle + aria-pressed,
  onInteractiveChange override, orientation, customButtons + disabled,
  hide/show/dispose lifecycle, re-show swap.
- 13 new tests in `node-toolbar.test.ts` for mount, isVisible auto/true/false,
  multi-node visibility (selection-exact match), update mutation, remove,
  list, dispose, unknown-node hidden-without-throw, multi-node hides on
  selection extras.
- EC-185 updated from "throws" to "flips without throw + isReadOnly returns
  the new value".

## [0.4.2] — 2026-06-12

### Fixed (critical)

- **Multi-line label edit destroyed `\n`.** `LabelEditor` used a single-line
  `<input type="text">`, whose `value` setter silently strips newlines.
  Opening the inline editor on a node like `'여러줄\nテスト\n测试'`
  copied the label into the input as the joined single-line string, and
  blur (or Enter) committed *that* back — permanently flattening the
  label. Even Escape couldn't recover, because the strip happened at
  `input.value = node.label` before any user interaction.

  Fix: switch the editor element to `<textarea>` and preserve interior
  newlines on commit via `value.trim()` (interior whitespace and newlines
  pass through; only leading / trailing whitespace is stripped, matching
  the prior single-line behaviour). `rows` is set from the label's line
  count so the editor opens at the visual height the label occupies.

### Changed

- Keyboard contract inside the editor: plain **Enter commits** (preserves
  the existing UX), **Shift+Enter inserts a newline**, Escape cancels,
  blur commits. IME composition (`isComposing` / `keyCode === 229`)
  continues to swallow Enter so Korean / Japanese / Chinese
  composition-finalisation Enter doesn't commit prematurely.

### Tests

- 5 new regression tests in `label-editor.test.ts` pin: (a) opening on a
  multi-line label preserves every `\n` in the textarea value, (b) blur
  commits a multi-line value verbatim, (c) `rows` attribute matches the
  label's line count, (d) Shift+Enter does not commit, (e) plain Enter
  still commits the single-line UX.

## [0.4.1] — 2026-06-12

### Fixed (critical — 0.4.0 deprecated)

- **Atlas eviction race that mis-mapped labels across nodes.** When the total
  count of labeled entries overflowed `ATLAS_SIZE`, atlas eviction inside the
  Pass 1 pre-warm loop of `text-program.ts` ran *after* some node entries had
  already been written but *before* every dirty-node quad had its UV recorded.
  The frame-start `generation` check was too early to notice; the result was
  that nodes whose quads still carried pre-eviction UVs were drawn at the
  shelf cells now occupied by *different* labels. Visually, ASCII nodes like
  `Start` / `Process` / `Branch A` ended up showing fragments of CJK labels
  (`Mixed`, `여러줄`, `测试`). On top of that, zoom and pan kept re-triggering
  the same eviction every frame, which read as label flicker.

  Two-part fix:
  1. **`text-program.ts` re-checks `atlas.generation` after Pass 1.** If
     eviction happened during pre-warm, the entire `quadCache` is cleared
     and every labeled node enters Pass 2 as dirty, so no quad survives with
     a stale UV.
  2. **`ATLAS_SIZE` restored from 1024 back to 2048.** The 0.2.5 reduction
     was a workaround for a Chromium fillText corruption that 0.2.6's
     per-entry OffscreenCanvas + drawImage strategy eliminated structurally
     (the live atlas never receives fillText directly anymore). With 4× the
     row capacity, the eviction race that 0.4.0 surfaced no longer triggers
     for any realistic mixed ASCII + CJK workload. The 50%-row wrap that
     accompanied the 1024 atlas is also removed — same reason.

- **`scripts/atlas-cjk-diag.mjs` gained an entry-mapping regression gate.**
  After the CJK pixel-parity phase, the script now injects 40 stress nodes
  into the running chart (overflowing the *old* 1024 atlas by ~4×), then
  walks every labeled node and asserts its atlas entry's nonzero-pixel
  count matches an isolated reproduction of *that node's own label*. A
  divergence above 5% is the 0.4.0 mis-mapping signal and the script exits
  non-zero. The verification stays local-only (CDP needs a real Chromium +
  live dev server) but is now a permanent pre-release smoke test for atlas
  write path changes. The script also accepts a target URL argument so it
  can be pointed at the dev server, the live demo at dev.flowgl.ouranos.kr,
  or any deployed preview.

### Deprecated

- `@flowgl/{core,react,vue,svelte}@0.4.0` published earlier today carries the
  eviction race described above. The four packages have been
  `npm deprecate`-marked with an upgrade-to-0.4.1 message. Consumers
  installing 0.4.0 will see the deprecation warning. Pin 0.2.6 or upgrade to
  0.4.1.

## [0.4.0] — 2026-06-12

### Fixed

- **CJK / Hangul / Japanese / mixed label rendering — confirmed parity with isolated reproduction.** The 0.2.5 known limitation ("WebGL2 atlas drops glyph pixels for CJK strings inside the chart's render frame; 261 nonzero pixels in isolation vs. 113 in-frame") is closed. 0.2.6's per-entry `OffscreenCanvas` + `drawImage` strategy in the atlas write path was the right structural fix; this release adds the in-frame verification harness that proves it works and converts that harness into a permanent regression gate.
  - In-frame CDP-driven diagnostic at `packages/core/scripts/atlas-cjk-diag.mjs` opens a fresh Brave/Chrome tab against the dev server, draws five sample strings (`'Hello'`, `'한국어'`, `'日本語'`, `'中文测试'`, `'Mixed 한글 test'`) through both a fresh `OffscreenCanvas` and the live chart atlas, and asserts the nonzero-alpha pixel counts match.
  - Current readings (Brave 149 / macOS / `dpr=2`):

    | sample | isolated nz | atlas nz | parity |
    | --- | --- | --- | --- |
    | `Hello` | 665 | 665 | ✅ |
    | `한국어` | 789 | 789 | ✅ |
    | `日本語` | 913 | 913 | ✅ |
    | `中文测试` | 1294 | 1294 | ✅ |
    | `Mixed 한글 test` | 1985 | 1985 | ✅ |

  - The script exits non-zero on any divergence — wire it into pre-release smoke testing alongside `pnpm typecheck && pnpm test && pnpm build`. Local-only; CI doesn't run it because CDP needs a real Chromium and a live dev server.

### Changed

- The `Known limitations` block in 0.2.6 listing the CJK atlas drop is removed — the limitation no longer holds.

### Documentation

- Demo (`demo/index.html`) ships five new CJK / mixed / multi-line CJK nodes (`cjk1`–`cjk5`) on the canvas. They double as a hand-eye verification anytime the atlas write path is touched. `cjk5` (`'여러줄\nテスト\n测试'`) uses a tall `height: 100` so the three-line wrapped block fits without overflow — also documents the rule-of-thumb that multi-line label nodes need height ≥ `lineCount × fontSize × lineHeight + 2 × PADDING`.

## [0.2.6] — 2026-06-12

### Added

- `Canvas2DRenderer` ships behind the same `Renderer` interface as `WebGL2Renderer`. Opt in with `rendererKind: 'canvas2d'`. Useful for environments without WebGL2 or for workloads whose labels are CJK-heavy (see Known limitations).
- `FlowChartOptions.groupDoubleClickCollapses?: boolean` — explicit opt-in for double-click → collapse on group nodes. **Default is false** so a single accidental double-click can never hide an entire subtree. Set to `true` to restore the previous behavior. Explicit collapse via `toggleCollapse(id)` / `collapseNode(id)` / `expandNode(id)` is always available regardless of the option.
- `FlowChart.dissolveGroup(groupId)` — new public API that removes the group container node itself and detaches every child, so children survive as top-level nodes and edges between them are preserved. Edges connected directly to the group are removed with the group (same as `removeNode`). No-op when `groupId` is not a `type: 'group'` node. Single undo entry. Pairs with the existing `ungroupNodes(childIds)` which only detaches children and leaves the group container intact — use `ungroupNodes` to pull selected children out of a group that should stay, and `dissolveGroup` when the group itself should disappear.
- `services/safe-css.ts` — single source of truth for the CSS-attribute allow-list (`safeColor` / `safeNumber` / `safeDashArray` / `safeFontFamily`). `svg-export.ts` and `label-edit.ts` now share these validators instead of carrying duplicate copies; hardening the allow-list now propagates everywhere.
- `packages/core/PERFORMANCE.md` documents SPEC verification (1K @ 120 fps, 5K @ 113.6 fps, 10K @ 114.1 fps under SwiftShader) and the 8 optimizations behind those numbers.
- 3 new axe-core tests covering Korean `ariaLabel`, `aria-keyshortcuts` token grammar (WAI-ARIA 1.2 named-key list), and the sr-only positioning of the `aria-live` region.
- 4 new visual-regression tests pinning that node labels render centered horizontally inside their atlas entry (3 in `productization.test.ts` covering `textAlign='center'`, single-line draw x past `PADDING`, multi-line lines share x; 1 in `edge-cases.test.ts` pinning `groupDoubleClickCollapses` default storage).

### Changed

- `FlowChart.canvasDblClick` now suppresses the inline label editor for nodes whose visual is rendered via `htmlContent` — editing `label` on such a node had no visible effect because `HtmlOverlay` owns the pixels. The `nodeDoubleClick` event still fires so consumer apps can route those nodes to their own editor.
- Node labels in the WebGL2 renderer now anchor at the horizontal center of their atlas entry's text block. Previously, `text-atlas.ts` left the per-entry `OffscreenCanvas` at the spec default `textAlign='start'`, so glyphs sat at the left edge and labels — especially CJK / Hangul, and any string whose conservative-estimated width exceeded the measured width — rendered visibly left-shifted inside their node quad. The fix is two lines: `textAlign='center'` plus `centerX = PADDING + blockW / 2`.
- Group nodes no longer collapse on double-click by default. Previously, double-clicking a `type: 'group'` node called `toggleCollapse` unconditionally, which hid the entire subtree on one click and was easy to trigger by accident. The new default emits `nodeDoubleClick` and routes to the label editor (the same path as any other node); set `groupDoubleClickCollapses: true` to restore the prior behavior. Programmatic `toggleCollapse(id)` is unchanged.

### Security

- All 4 packages enable `publishConfig.provenance: true`. Consumers can verify the tarball with `npm audit signatures @flowgl/<pkg>`.
- New `scripts/generate-sbom.mjs` emits deterministic CycloneDX 1.5 SBOMs for all 4 packages; each tarball ships `sbom.json` for downstream supply-chain auditing.

### Documentation

- Root README adds a 60-second tour code example and new badges for coverage, provenance, SBOM, and CJK status.
- `PRODUCT.md` adds a "Core Value Tenets" section formalizing the seven non-negotiable properties of the project (GPU-first rendering, zero deps, framework-agnostic core, renderer-backend interchangeability, visual feature parity across backends, performance tier, accessibility). `AGENTS.md` adds the per-tenet pre-merge guardrails and a "Tenet-Violation Escalation Protocol" so any future change that would break a tenet halts at planning time. `SPEC_CHECKLIST.md` adds a "Tenet Regression Gates" section as the binary pass/fail at Definition-of-Done time. These three documents are intentionally redundant: a tenet without a guardrail is a wish; a guardrail without a regression check is a slogan.

### Known limitations

- `Canvas2DRenderer` does not yet render the WebGL-only HandleProgram (connect-drag circles), reroute handles, or endpoint circles. These are tracked under T5 (Visual Feature Parity Across Backends) in `PRODUCT.md`. Canvas2D will remain opt-in until parity is closed.

## [0.2.5] — 2026-06-11

### Added

- GitHub Actions `ci.yml` runs `pnpm typecheck && test && build` on every push and PR to `master` (badge wired into the root README).
- GitHub Actions `release.yml` (manual `workflow_dispatch`) publishes selected packages with `npm publish --provenance` so consumers can verify the tarball came from this exact commit. Requires the `NPM_TOKEN` secret on the repo.
- Root README badges: per-package npm versions (core / react / vue / svelte), npm monthly downloads, CI status.
- core README — Accessibility section now includes a WCAG 2.2 AA audit table (criterion × library guarantee × caller responsibility) plus an `@axe-core/playwright` snippet so consumers can automate the check.

## [0.2.4] — 2026-06-11

### Changed

- `FlowChart` shrunk from 1946 → 1769 LOC by extracting three more services:
  - `services/graph-analysis.ts` — `getIncomers`, `getOutgoers`, `getConnectedNodes`, `hasCycle`, `findPaths` are now pure functions that take a `Graph` argument. `FlowChart`'s methods delegate.
  - `services/alignment.ts` — `alignNodes(graph, nodes, axis)` and `distributeNodes(graph, nodes, axis)` extracted.
  - `services/layout-animator.ts` — `LayoutAnimator` class owns the smoothstep RAF loop. `FlowChart.animateLayout(...)` delegates and `dispose()` cancels via `layoutAnimator.dispose()`.

No public API changes — methods on `FlowChart` keep the same signatures.

## [0.2.3] — 2026-06-11

### Security

- `importJSON({ ..., mode: 'merge' })` now runs the same schema validator as `fromJSON` (it previously trusted the input). `{ skipValidation: true }` opts out.
- `validateChartJson` now rejects `htmlContent` containing `<script>` tags, `javascript:` URLs, or `on*=` inline event handlers. Combined with the `sanitizeHtml` hook, untrusted JSON cannot smuggle XSS through the HTML overlay without an explicit `skipValidation: true` opt-in.

### Tests

- 4 new tests: htmlContent `<script>` rejected, inline event handler rejected, `javascript:` URL rejected, importJSON merge validation.

## [0.2.2] — 2026-06-11

### Security

- **`fromJSON(data)` now runs schema validation before mutating state.** Invalid input throws `TypeError` with a specific reason — non-string `id`, non-finite `x`/`y`, non-positive `width`/`height`, over-length `label` (10k) / `htmlContent` (100k) / `tooltip` (1k), `__proto__` / `constructor` / `prototype` keys. Unknown fields are silently dropped. Pass `{ skipValidation: true }` to opt out when loading data you produced yourself with `toJSON()`.

### Changed

- SVG export moved from `FlowChart.exportSVG` into a new `services/svg-export.ts` (`exportGraphAsSvg(graph, padding)`). `flowchart.ts` shrunk by ~110 LOC; the safe-color / safe-number / safe-dash-array validators now live with the function they protect.

### Tests

- 6 new tests for `fromJSON` schema validation (missing id, non-finite x, `__proto__` pollution, oversized htmlContent, valid payload, skipValidation flag).

## [0.2.1] — 2026-06-11

### Added

- Canvas now exposes `aria-roledescription="Flowchart editor"` and `aria-keyshortcuts` listing every supported shortcut so AT users discover them without reading docs.
- README — 6 new sections: Recipes (external state sync, auto-layout + animate, conditional connection guard, JSON persistence, context menu extension), Accessibility (ARIA contract + WCAG guidance), Security (`sanitizeHtml` recipe + threat model), Migration 0.1.x → 0.2.0.

### Tests

- 3 new ARIA tests in `productization.test.ts` (canvas role / label / shortcuts, custom ariaLabel, aria-describedby content).

## [0.2.0] — 2026-06-11

### Breaking

- **`Renderer.render(graph, viewport, frame)` signature changed.** The 10-parameter positional form (`selectedIds`, `connectState`, `selectedEdgeIds`, `bgColor`, `grid`, `rerouteState`, `endpointCircles`, `dashOffset`) is replaced by a single `RenderFrame` object. Custom renderer implementations must update their signature. The built-in `WebGL2Renderer` migration is internal; consumers who use only `new FlowChart(...)` are unaffected. `Renderer` interface also now requires `hasAnimatedEdges(): boolean`.

### Added

- `setSelection({ nodes?, edges? })` — unified selection setter. Replaces only the dimensions you pass; emits `selectionChange` exactly once.
- `RenderFrame` type exported from `@flowgl/core`.

### Deprecated (removal scheduled for 1.0)

- `setNodeBorderColor(id, color)` → use `setNodeStyle(id, { borderColor })`
- `setNodeBackgroundColor(id, color)` → use `setNodeStyle(id, { backgroundColor })`
- `setNodeShape(id, shape)` → use `setNodeStyle(id, { shape })`
- `setSelectedIds(ids)` → use `setSelection({ nodes: ids })`
- `setSelectedEdgeIds(ids)` → use `setSelection({ edges: ids })`
- `requestRender()` — internal `scheduleRender` already handles all mutations
- `chart.graph` direct access → use `getNodes()` / `getEdges()` / `addNode()` etc.
- `chart.viewport` direct access → use `getViewport()` / `panTo()` / `zoomIn()` etc.

### Changed

- React, Vue, Svelte wrappers no longer reach into `chart.graph` directly; all event handlers go through `chart.getNodes()` / `chart.getEdges()`.

## [0.1.5] — 2026-06-11

### Security

- **`NodeData.htmlContent` is now opt-in unsafe.** `HtmlOverlay` writes still go through `innerHTML`, but the new `FlowChartOptions.sanitizeHtml` hook lets callers plug in a vetted sanitizer (e.g. DOMPurify). If `htmlContent` is set without a sanitizer, a one-time console warning is emitted documenting the trust boundary.
- **`exportSVG` style fields are now whitelisted.** `backgroundColor` / `borderColor` / `textColor` / edge `color` are validated against a CSS-color regex (hex, rgb()/rgba(), hsl()/hsla(), named); invalid input falls back to the documented defaults. `borderWidth` / `borderRadius` / `fontSize` go through a finite-non-negative number guard. `dashArray` requires every entry to be a finite non-negative number — otherwise the attribute is omitted entirely.
- **`label-edit.ts` no longer concatenates user-controlled CSS.** The inline label editor's `cssText` is split into a fixed-shape base block plus per-property `setProperty` calls for `border-color`, `background`, `color`, `font-size`, `font-family`. `fontFamily` rejects `<`, `>`, `;`, `{`, `}` to block declaration breakouts.

### Changed

- `tsconfig.build.json` introduced so Rollup declaration emission excludes `src/__tests__` — published tarballs no longer ship 46 `.test.d.ts` / `.test.d.ts.map` files.
- `*.tgz` added to `.gitignore`; stale 0.1.0 tarball removed from the working tree.

## [0.1.4] — 2026-06-10

### Fixed

- WebGL `BLEND` state was not restored after `webglcontextrestored` — text labels rendered as solid dark rectangles because per-pixel alpha was written directly to the framebuffer instead of being blended. Extracted `applyGlState()` from `createWebGL2Context()` and call it from `reinitializePrograms()` so the blend equation survives a context loss/restore cycle.
- Inline label editor committed mid-IME composition — Enter pressed to confirm a Korean / Japanese / Chinese composition would fire `commit()` before the composition was finalized. Added `e.isComposing || e.keyCode === 229` guard to both node and edge label keydown handlers.
- Inline label editor bypassed the public `updateNode()` / `updateEdge()` paths and called `graph.updateNode()` directly, so the `nodeUpdate` / `edgeUpdate` events never fired for inline edits. Wrappers (React / Vue / Svelte) that rely on those events to sync controlled state did not learn about the change. Inline editors now route through the public mutation methods.

## [0.1.3] — 2026-06-10

### Added

- SDF (Signed Distance Field) text rendering for node labels — zoom-invariant sharp text at any zoom level using dead-reckoning EDT + `smoothstep(fwidth)` in GLSL fragment shader

### Changed

- `TextAtlas` PADDING 4→8 px; glyph-only entries now store distance field in alpha channel (RGB = text color), with bitmap fallback for environments lacking `getImageData`

### Fixed

- Test `NodeData` fixtures missing required `width` / `height` fields in all three wrapper test files

## [0.1.2] — 2026-06-09

### Added

- Vitest unit tests for `@flowgl/react`, `@flowgl/vue`, `@flowgl/svelte` — 9 tests each (27 total): constructor on mount, dispose on unmount, onInit callback, initial props, nodes/edges/readOnly prop sync, autoConnect behavior
- `vi.hoisted` MockChart pattern shared across all wrapper tests
- Force Layout worker integration in demo (`LayoutWorkerClient`)

### Changed

- Root `pnpm test` script runs all 4 packages; `test:wrappers` script added

## [0.1.1] — 2026-06-09

### Added

- `readOnly`, `snapGrid`, `autoFit`, `minimap` constructor options
- Events `nodeDoubleClick`, `nodeDragStart`, `edgeClick`, `edgeDoubleClick`, `edgeUpdate`, `nodeResize`, `nodeHover`, `edgeHover`
- Node mutations `deleteSelected()`, `duplicateSelected()`, `lockNode()`, `unlockNode()`, `setNodeShape()`, `setNodeStatus()`
- Edge mutations `updateEdge()`, `setEdgeStyle()`, `swapEdgeDirection()`
- Graph queries `getNode()`, `getEdge()`, `getEdgesForNode()`, `getEdgesBetween()`, `getIncomers()`, `getOutgoers()`, `getConnectedNodes()`, `hasCycle()`, `findPaths()`
- Viewport `zoomIn()`, `zoomOut()`, `zoomTo()`, `fitViewToSelection()`, `panTo()`, `getNodesBounds()`, `scrollToNode()`
- History `clearHistory()`, `batchUpdate(fn)`
- Group `collapseNode()`, `expandNode()`, `groupNodes()`, `ungroupNodes()`
- Alignment `alignNodes()`, `distributeNodes()`; Layout `circularLayout()`, `animateLayout()`
- Export `exportPNG()`, `exportSVG()`
- `NodeStyle.shape` variants (circle, diamond, hexagon); `NodeStatus` type; `NodeData` fields tooltip/locked/status/parentId/collapsed/ports/htmlContent; `EdgeData` fields animated/waypoints
- GitHub link and demo site URL in all package READMEs

### Fixed

- Group drag spurious dblclick; canvas event listener leak on dispose; GPU leak in CapProgram; undo inconsistency for setNodeStyle/setNodeSize/lockNode/collapseNode/groupNodes

### Changed

- `getEdgesForNode()`, `getIncomers()`, `getOutgoers()` use O(degree) index; test suite expanded from 127 to 832 tests

## [0.1.0] — 2026-06-03

### Added

- `@flowgl/core@0.1.0` — first public release on npm
- `@flowgl/react@0.1.0` — first public release on npm
- `@flowgl/vue@0.1.0` — first public release on npm
- `@flowgl/svelte@0.1.0` — first public release on npm
- GitHub repository `github.com/Deiamor/flowgl` made public

## [Unreleased]

### Added

- `FlowChartOptions`: `readOnly`, `snapGrid`, `autoFit`, `minimap`, `onBeforeConnect`, `onBeforeDelete`
- Events: `nodeDoubleClick`, `nodeDragStart`, `edgeClick`, `edgeDoubleClick`, `edgeUpdate`, `nodeResize`, `nodeHover`, `edgeHover`
- Node mutation: `deleteSelected()`, `duplicateSelected()`, `lockNode()`, `unlockNode()`, `setNodeShape()`, `setNodeStatus()` (error / warning / success / info / null — top-right badge)
- Edge mutation: `updateEdge()`, `setEdgeStyle()`, `swapEdgeDirection()`, `importJSON(data, mode)` (replace | merge)
- Graph query: `getNode()`, `getEdge()`, `getNodes()`, `getEdges()`, `getEdgesForNode()`, `getEdgesBetween()`, `getSelectedNodes()`, `getSelectedEdges()`, `getIncomers()`, `getOutgoers()`, `getConnectedNodes()`, `hasCycle()`, `findPaths()`
- Selection: `selectAll()`, `setSelectedEdgeIds()`, `getSelectedEdgeIds()`
- Viewport: `zoomIn()`, `zoomOut()`, `zoomTo()`, `fitViewToSelection()`, `panTo()`, `getNodesBounds()`, `scrollToNode()`
- Appearance: `setTheme('light' | 'dark')`, `setReadOnly()`, `setSnapGrid()`, `setMinimap()`, `setLabelEditable()`
- History: `clearHistory()`, `batchUpdate(fn)` (multiple mutations collapsed into a single undo entry)
- Group: `collapseNode()`, `expandNode()`, `toggleCollapse()`, `groupNodes()`, `ungroupNodes()`
- Alignment: `alignNodes(axis)`, `distributeNodes(axis)`
- Search: `searchNodes()`, `setHighlightedNodes()`, `clearHighlights()`
- Layout: `circularLayout()`, `animateLayout(targets, duration)`
- Export: `exportPNG(scale?)`, `exportSVG(padding?)`
- Runtime callbacks: `setOnBeforeDelete(fn | null)`
- `NodeData` fields: `tooltip`, `locked`, `status`, `type('group')`, `parentId`, `collapsed`, `ports`, `htmlContent`
- `EdgeData` fields: `animated`, `waypoints`
- `NodeStyle.shape`: `rectangle` | `circle` | `diamond` | `hexagon`
- `NodeStatus` type: `error` | `warning` | `success` | `info`

### Fixed

- `ungroupNodes()`: `updateNode` spread merge could not delete `parentId` — replaced with `replaceNode` pattern
- Canvas event listeners (`dblclick` / `contextmenu` / `mousedown` / `click`) leaked on `dispose()` — stored as class fields and properly removed in `dispose()`
- `ariaDesc` DOM element was not removed on `dispose()`
- GPU leak: `CapProgram.dispose()` was not implemented — added `deleteProgram` + `deleteVertexArray` + buffer disposal; called from `WebGL2Renderer.dispose()`
- Undo inconsistency: `beforeMutation()` was missing from `setNodeStyle`, `setNodeSize`, `lockNode`, `collapseNode`, `groupNodes`, `updateNode`, `updateEdge`, `setEdges`, and related public mutation APIs — added across all affected methods
- `undo()` / `redo()`: early-return on `this.failed` state prevented graph restore — removed; render path already guards against failed state

### Changed

- `getEdgesForNode()`, `getIncomers()`, `getOutgoers()`, `getConnectedNodes()`: replaced `getEdges().filter()` O(n) full scan with `Graph.getEdgesForNode()` O(degree) index lookup
- Render cache: per-frame `visNodes.filter(n => !n.htmlContent)` allocation replaced with `cachedTextNodes` field
- Render loop: per-frame `getEdges().some(e => e.animated)` replaced with `renderer.hasAnimatedEdges()` cache
- `undo()` / `redo()`: history restore now works regardless of `failed` state
- Test suite expanded from 127 to **220** tests across 11 files
