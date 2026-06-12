# AGENTS.md

## Agent Catalog

| Agent | Role | Authorities | Prohibitions |
|-------|------|-------------|--------------|
| main | Architecture, API design, orchestration | All files | — |
| design-system-ui | UI components (demo page only) | Read design system, write demo CSS | Modify core library source |
| reviewer | Code review of PRs / diffs | Read all source | Write to source |
| tester | Run build / type-check / tests | Bash (build commands) | Modify source |
| documenter | Generate HISTORY.md entries, README sections | Read source, write docs | Modify source |
| migrator | Bulk file transformations | Edit/Write with worktree isolation | Merge to main directly |

---

## Tenet Guardrails

The Core Value Tenets are defined in `PRODUCT.md`. This section is the
operational rulebook every agent — and every PR — must satisfy before merging.
A tenet violation is a **hard stop**: the work pauses, the agent reports the
violation to the user, and merge only resumes after explicit user approval (the
canonical phrase: `"Proceed as planned?"`). No silent waivers.

### T1 — GPU-First Rendering
| Pre-merge check | Where it lives |
|---|---|
| `makeRenderer()` falls back to `new WebGL2Renderer()` when `rendererKind` is unspecified | `packages/core/src/flowchart.ts` |
| Demo `?renderer=` URL parameter treats WebGL2 as the default branch, not the named branch | `demo/index.html` |
| README hero copy describes WebGL2 as the rendering path, Canvas2D as the fallback | `README.md` |
| CHANGELOG never advertises a non-WebGL2 default | `CHANGELOG.md` |

**Anti-patterns flagged by this guardrail**:
- "Switch default to Canvas2D to avoid the atlas CJK bug" — fix the bug, don't flip the default.
- "Add a `preferCanvas2D: true` autodetect when WebGL2 supports atlas write but `navigator.language` starts with `ko`" — same anti-pattern, dressed up.

### T2 — Zero Runtime Dependencies (core)
| Pre-merge check | Where it lives |
|---|---|
| `pnpm why <pkg> --filter @flowgl/core` returns nothing for every non-self package | enforced via lint / CI |
| `packages/core/package.json` has no `dependencies` key — only `devDependencies` | `packages/core/package.json` |
| Wrapper packages declare only their host framework as a peerDependency | `packages/{react,vue,svelte}/package.json` |

### T3 — Framework-Agnostic Core
| Pre-merge check | Where it lives |
|---|---|
| `grep -rE "from ['\"]react['\"]\|from ['\"]vue['\"]\|from ['\"]svelte['\"]" packages/core/src` returns nothing | enforced via lint / CI |
| `tsconfig.json` for core has no `jsx` setting | `packages/core/tsconfig.json` |

### T4 — Renderer-Backend Interchangeability
| Pre-merge check | Where it lives |
|---|---|
| Every method on `FlowChart` either works identically on every backend or returns capability info; no method throws "not supported by backend X" | `packages/core/src/flowchart.ts` |
| Public types do not contain `webgl2: ...` / `canvas2d: ...` discriminants | `packages/core/src/types.ts` |

### T5 — Visual Feature Parity Across Backends
| Pre-merge check | Where it lives |
|---|---|
| The `Renderer` interface enumerates every feature that must be drawn; both `WebGL2Renderer` and `Canvas2DRenderer` implement every method without TODOs | `packages/core/src/renderer/*` |
| Backends missing a feature are flagged `experimental` in `rendererKind`'s JSDoc and listed in CHANGELOG "Known limitations" | `packages/core/src/flowchart.ts` (option JSDoc), `CHANGELOG.md` |

**Currently shipped**:
- `WebGL2Renderer` — full feature set (default).
- `Canvas2DRenderer` — opt-in fallback. Known gaps: handle-program connect-drag circles, reroute handles, endpoint circles. These gaps mean Canvas2D **cannot become the default** until parity is met (T1 + T5 compound). Until then, Canvas2D is opt-in only and its gaps are listed in CHANGELOG "Known limitations".

### T6 — Performance Tier
| Pre-merge check | Where it lives |
|---|---|
| `pnpm bench` (or equivalent) confirms 1K / 5K / 10K tiers against floors in PRODUCT.md T6 | `packages/core/PERFORMANCE.md` |
| Bench numbers in PERFORMANCE.md are refreshed on every release | `packages/core/PERFORMANCE.md` |

### T7 — Accessibility
| Pre-merge check | Where it lives |
|---|---|
| `axe-core` test suite passes (no violations) | `packages/core/src/__tests__/a11y-axe.test.ts` |
| Keyboard-only walkthrough reaches every interactive surface and announces it via `aria-live` | manual + automated mix |

---

## Tenet-Violation Escalation Protocol

When an agent (or a PR) discovers that a planned change would violate a tenet:

1. **Stop implementation.** Do not commit. Do not stage.
2. **Surface the conflict** in the agent's next message to the user: state which
   tenet, which guardrail check, and the proposed change in one paragraph.
3. **Offer concrete alternatives.** Usually one of: (a) fix the underlying
   problem inside the tenet boundary; (b) ship the change behind an opt-in flag
   so the tenet still holds for the default path; (c) escalate the tenet itself
   for amendment.
4. **Wait for the canonical approval phrase** `"Proceed as planned?"` →
   `"Proceed."`. Anything less specific (a 👍, a "ok") is not approval.
5. **If approved**, record the tenet-exception in `HISTORY.md` with the
   approval timestamp and the rationale. Future audits read that line, not
   the chat log.

---

## Notes for the `main` agent

- The seven tenets above are not aspirational copy. Every time you sit down
  to plan a change, the first question is "which tenet does this touch?"
  If the answer is "none" you may proceed. If the answer names a tenet,
  the guardrail check for that tenet is part of the Definition of Done.
- "Make the test pass" is not a reason to violate a tenet.
- "Unblock the release" is not a reason to violate a tenet.
- A tenet held only when convenient is not a tenet.
