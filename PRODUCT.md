# PRODUCT.md

## Vision
A high-performance, dependency-free flowchart rendering library targeting WebGL2.
Designed to be embedded in any framework (React, Vue, Svelte, vanilla JS).

## Core Users
- Frontend engineers building diagramming tools, workflow editors, pipeline visualizers
- Teams needing 10,000+ node scalability without paying for a SaaS product

## Problems Being Solved
1. Existing libraries (React Flow, mermaid) are DOM/SVG-based — they hit performance ceilings at thousands of nodes
2. WebGL-based alternatives require buying into a specific framework or have heavy dependencies
3. No clean, auditable, zero-dependency WebGL flowchart primitive exists

---

## Core Value Tenets

These tenets are the project's identity. Any change that violates a tenet must be
escalated to the user **before** implementation — not after. The companion file
`AGENTS.md` carries the operational guardrails that enforce each tenet, and
`SPEC_CHECKLIST.md` carries the regression-blocking checks. The three documents
are intentionally redundant: a tenet without a guardrail is a wish, a guardrail
without a regression check is a slogan.

### T1 — GPU-First Rendering
**The default `Renderer` is and remains `WebGL2Renderer`.** Instanced draw calls,
fragment-shader text atlas, frustum culling — these are the project's
performance ceiling. A Canvas 2D backend ships behind the same interface as an
**opt-in fallback** for environments without WebGL2 or workloads with known
WebGL2-renderer bugs (currently: CJK glyph drop in the atlas write path).
- **Forbidden**: swapping the default backend to anything that is not WebGL2.
  Working around a WebGL bug by flipping the default is a tenet violation, not
  a fix.
- **Allowed**: adding *new* backends behind the same `Renderer` interface,
  provided T5 (Visual Feature Parity) is met for every public visual feature
  before merge.

### T2 — Zero Runtime Dependencies (core)
**`@flowgl/core` ships with zero runtime dependencies.** No D3, no Lodash, no
framework. The published tarball contains exactly the code the consumer paid
for and exactly the SBOM line-items they can audit.
- **Forbidden**: adding any `dependencies` entry to `packages/core/package.json`.
  `devDependencies` are unaffected. Framework wrappers (`@flowgl/react`,
  `@flowgl/vue`, `@flowgl/svelte`) may take a single peerDependency on their
  host framework, nothing else.
- **Allowed**: vendoring small standalone files when the alternative is a
  runtime dependency, provided the license and the source are recorded in
  `HISTORY.md`.

### T3 — Framework-Agnostic Core
**The core does not import React, Vue, Svelte, or any other framework, ever.**
Framework integration lives strictly in `packages/{react,vue,svelte}` as thin
binding layers over the core's public API.
- **Forbidden**: a framework-specific symbol in `packages/core/src/**`. JSX,
  `defineComponent`, `$:` reactive statements, etc. are tenet violations
  regardless of how clever the use case.
- **Allowed**: shaping the core's public API so wrappers can stay thin
  (controlled-component callbacks, ref handles, etc.).

### T4 — Renderer-Backend Interchangeability
**The public API is backend-agnostic.** Consumers depend on `FlowChart`, not on
`WebGL2Renderer`. Selecting a backend is one option (`rendererKind`); every
other API call works identically across backends.
- **Forbidden**: any public method, event, or option whose contract changes
  based on the active backend. "Throws on Canvas2D" is a contract change.
- **Allowed**: capability-detection helpers (e.g., `getRendererCapabilities()`)
  that let an app gracefully degrade UI when it picks the lighter backend.

### T5 — Visual Feature Parity Across Backends
**Every public visual feature renders on every shipped backend.** If WebGL2
renders connect-drag handles, reroute handles, and endpoint circles, Canvas2D
renders them too. A backend that drops a public visual feature is incomplete
and may not be the default.
- **Forbidden**: shipping a backend as "stable" while it silently omits a
  documented feature (handles, status badges, animated edges, etc.).
- **Allowed**: prefixing a backend with `experimental` in `rendererKind` and
  publishing the parity gaps under "Known limitations" in CHANGELOG. Experimental
  backends never become the default.

### T6 — Performance Tier
**Benchmark targets (SwiftShader headless, the floor we publish):**
- 1,000 nodes ≥ 60 fps
- 5,000 nodes ≥ 60 fps target, 30 fps floor
- 10,000 nodes ≥ 30 fps floor

A PR that drops any tier below its floor is a regression, regardless of
feature value. Benchmarks live in `packages/core/PERFORMANCE.md`.
- **Forbidden**: merging a change that lowers a tier without an explicit
  user-approved tenet-exception entry in HISTORY.md.

### T7 — Accessibility
**WCAG 2.2 AA, axe-clean, keyboard-complete.** `role="application"`,
`aria-keyshortcuts` (valid token grammar), `aria-live` announcements,
`ariaLabel` on every interactive node — these are not optional polish.
- **Forbidden**: introducing an interactive surface without keyboard reachability
  or without an `aria-*` description.
- **Allowed**: changing the wording of announcements, provided the axe tests
  in `__tests__/a11y-axe.test.ts` still pass.

---

## Reference
- React Flow API design: https://reactflow.dev/learn
