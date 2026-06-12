# Versioning & API Stability

flowgl follows [Semantic Versioning 2.0](https://semver.org/) once it
reaches **1.0**. Until then it follows the **0.x convention** described
below.

## 0.x convention (current)

While `MAJOR = 0`, the second number is the **minor** release and the
third is the **patch**:

```
0.MINOR.PATCH
```

| Bump | When |
| --- | --- |
| `0.MINOR.0` | New public API surface (e.g. a new overlay, edge variant, data hook). May contain documented behavior changes — they ship with a CHANGELOG entry and, where mechanical, a codemod. |
| `0.minor.PATCH` | Bug fixes, internal refactors, doc improvements. Never breaks documented public API. The 0.8.1 edge-geometry consolidation is a representative example: every consumer rerouted through one helper, no public-API rename. |

Both wrappers (`@flowgl/react`, `@flowgl/vue`, `@flowgl/svelte`) and
`@flowgl/core` share one version number per release. A bump in `core`
implies the same bump in every wrapper.

## Public API surface

Only the symbols listed below are covered by this policy. Anything
imported via a deep path (e.g.
`@flowgl/core/dist/interaction/drag.js`) is **not** public and may
change in any release.

### Covered

- Every type / class / function exported from the package's top-level
  `index` — i.e. anything you can write `import { Foo } from '@flowgl/core'`
  for.
- The shape of every event payload accessible via `chart.on(name, fn)`.
- The JSON shape produced by `chart.toJSON()` and accepted by
  `chart.fromJSON(input)`.
- The contract of `Renderer` (you can swap your own implementation
  through `FlowChartOptions.rendererKind`).

### Not covered

- The interaction layer classes (`NodeDrag`, `ConnectDrag`,
  `EdgeWaypoint`, …) — they're internal even though they're exported
  for testability.
- Internal helpers under `renderer/webgl/util/` — they exist to keep
  the renderer code shared but are not a stable surface.
- Internal cache implementation details (atlas slab size, edge strip
  layout, fingerprint format).
- Bundle file paths and sourcemap structure inside `dist/`.

## Deprecation policy

When a covered API needs to change:

1. The new shape ships alongside the old one in some `0.MINOR.0`.
2. The old symbol is marked with a JSDoc `@deprecated` tag explaining
   the migration target.
3. The CHANGELOG entry for that release calls out both the new shape
   and the deprecation under a `### Deprecated` heading.
4. The deprecated symbol stays callable for **at least two minor
   releases** before removal.
5. Removal happens in a documented `0.MINOR.0` (never a `.PATCH`).
   The CHANGELOG entry for the removing release reiterates the
   migration target.

`@deprecated since X — use Y. Removed in Z.` is the canonical comment
form. Examples already in the codebase:

```ts
/** @deprecated since 0.2.0 — use `setSelection({ nodes })`. Removed in 1.0. */
setSelectedIds(ids: string[]): void

/** @deprecated since 0.2.0 — use the public mutation methods. Removed in 1.0. */
public graph: Graph
```

## Pre-1.0 stability tiers

Within the covered surface, individual APIs sit in one of three tiers:

| Tier | Bar to change | Examples |
| --- | --- | --- |
| **stable** | breaking change requires a deprecation cycle | `FlowChart` constructor, `addNode`, `addEdge`, `setSelection`, every event payload, `chart.toJSON` / `fromJSON` |
| **provisional** | may change in any `0.MINOR.0` with a clear CHANGELOG note (no deprecation cycle required); these are explicitly labelled in the docs | `EdgeToolbar` align values, `HelperLinesOptions.show` semantics, `ProximityConnectOptions.generateEdgeId` signature |
| **internal** | not covered; may change in any release | anything under `not covered` above |

If a docstring does **not** say `@provisional` or live under "not
covered", treat the symbol as **stable**.

## How we mark stability in code

- Stable: no marker (the default). Covered by the deprecation cycle.
- Provisional: a JSDoc `@provisional` tag plus a one-line rationale
  for what is still being tuned.
- Internal but exported (e.g. for tests): underscore prefix or a
  JSDoc `@internal` tag.

```ts
/**
 * @provisional 0.8.0 — the snap/show threshold units may switch
 *   from world units to screen pixels in 0.10. Track #N for the
 *   discussion.
 */
export interface HelperLinesOptions { ... }
```

## 1.0 plan

We will publish 1.0 when **all three** are true:

1. The "stable" tier has been deprecation-cycle-frozen for two
   consecutive minor releases (no breaking changes, no new
   provisional APIs that landed without a tracking issue).
2. Cross-browser CI (Chromium + Firefox + WebKit) has stayed green
   on every PR for an entire minor cycle.
3. Either ≥ 3 external production deployments are publicly known
   (Show & Tell discussions), or an external pair of maintainers has
   signed off on the public API.

The 1.0 release itself drops every `@deprecated` symbol still in the
codebase and ships a clean v1 codemod for the four removed APIs we
already have on the books (`setNodeBorderColor`,
`setNodeBackgroundColor`, `setSelectedIds`, `setSelectedEdgeIds`).

## Reporting an unexpected break

If a `0.minor.PATCH` release breaks a documented public API for you,
that is a release bug — please file an issue with the exact symbol
and a minimal repro. Patch breakages get a follow-up `0.minor.PATCH+1`
within 48 hours.

## Related documents

- [`CHANGELOG.md`](./CHANGELOG.md) — every release entry includes
  `### Added` / `### Changed` / `### Fixed` / `### Deprecated`
  sections where applicable.
- [`SECURITY.md`](./SECURITY.md) — vulnerability disclosure process.
- [`ROADMAP.md`](./ROADMAP.md) — upcoming work + items deferred or
  declined.
