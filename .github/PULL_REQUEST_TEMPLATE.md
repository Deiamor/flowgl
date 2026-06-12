<!--
Thanks for the PR. The checklist below mirrors what a reviewer would
verify — doing it yourself short-circuits a round of review.
-->

## What changed

<!-- One paragraph: what is different in the codebase after this PR? -->

## Why

<!-- One paragraph: what problem does this solve, or what value does it add?
     Bug fix? Link the issue. Behavior change? Link the discussion. -->

## How (notable implementation choices)

<!-- Optional. Anything a reviewer should know that the diff doesn't
     make obvious — alternatives considered, performance tradeoffs,
     edge cases handled. -->

## Tenet impact

<!-- Which of PRODUCT.md's Core Value Tenets does this touch?
     Mark all that apply. If a box is ticked, the AGENTS.md guardrail
     row for that Tenet is part of the merge gate. -->

- [ ] T1 — GPU-First Rendering (default renderer / WebGL2)
- [ ] T2 — Zero Runtime Dependencies (`@flowgl/core` deps)
- [ ] T3 — Framework-Agnostic Core (no framework imports in core)
- [ ] T4 — Renderer-Backend Interchangeability (public API contract)
- [ ] T5 — Visual Feature Parity Across Backends (WebGL2 + Canvas2D)
- [ ] T6 — Performance Tier (1K / 5K / 10K fps floors)
- [ ] T7 — Accessibility (WCAG 2.2 AA, axe-clean)
- [ ] None — this is documentation / internal refactor / test-only

## Checklist

- [ ] `pnpm typecheck` passes (0 errors across all 4 packages)
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [ ] `node scripts/sync-docs.mjs --check` passes
- [ ] If atlas / text-program touched: CDP regression gate passes
      (`node packages/core/scripts/atlas-cjk-diag.mjs http://localhost:5173`
      → `CJK PARITY OK` and `ENTRY MAPPING OK`)
- [ ] `CHANGELOG.md` entry added under `[Unreleased]` (Added / Changed
      / Fixed / Deprecated / Removed / Security — Keep a Changelog format)
- [ ] If public behavior changed: `SPEC_CHECKLIST.md` regression gate
      row added and `HISTORY.md` append entry written
- [ ] New public API has at least one unit test; bug fix has a
      regression test reproducing the original failure
- [ ] No new runtime dep added to `@flowgl/core` (T2). If you did need
      one, link the discussion where it was approved.

## Screenshots / demo (renderer or UI changes only)

<!-- Drop screenshots, recordings, or a CodeSandbox link if this changes
     anything visual. Visual regressions slip past test suites every
     time — one image saves a release. -->

## Related

<!-- Issues / discussions / earlier PRs this is a follow-up to. -->
