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

## Doc Update Map

When code changes, the docs that depend on it have to follow. Without an
explicit map, "I'll update PROJECT.md later" turns into permanent drift —
the kind that shipped 0.4.0 with a stale CHANGELOG entry and a phantom
"Known limitations" line. Two-tier system: tier 1 is the computer's job,
tier 2 is yours.

### Tier 1 — Automated (`scripts/sync-docs.mjs`)

These derive directly from `package.json` / `clover.xml` and have no
business being hand-edited. The script reads the source of truth and
rewrites the destination lines.

| Source of truth | Synced into |
|---|---|
| `packages/*/package.json` `version` | `DEPLOY.md` 배포된 패키지 table |
| `packages/core` test count (live vitest) + wrapper counts | `README.md` tests badge + `PROJECT.md` tech stack + Build Commands |
| `packages/core/coverage/clover.xml` statements % | `README.md` coverage badge |

Commands:

```bash
node scripts/sync-docs.mjs            # write any drift in place
node scripts/sync-docs.mjs --check    # exit 1 on drift — CI / pre-commit gate
```

Adding a fact: open `scripts/sync-docs.mjs`, add an entry to the `tasks`
array with the source reader and the regex that selects the doc line.

### Tier 2 — Human-decided (this table)

These are content changes, not derived numbers. The agent making the
change is responsible for touching every row that matches.

| Code change | Docs to update in the same PR |
|---|---|
| Add / rename / delete source file under `packages/core/src/` | `PROJECT.md` directory tree |
| Add new public API (method, option, event) | `README.md` API section + `CHANGELOG.md` Added + a regression test |
| Change public behavior (default, signature, event shape) | `CHANGELOG.md` Changed + `HISTORY.md` append entry + `SPEC_CHECKLIST.md` regression gate |
| Fix a bug | `CHANGELOG.md` Fixed + `HISTORY.md` append entry + regression test + (if visual/UX) `SPEC_CHECKLIST.md` Visual Rendering or Release Verification Gates |
| Add new external runtime dependency to `@flowgl/core` | **T2 violation** — stop, follow Tenet-Violation Escalation Protocol |
| Change `makeRenderer` default | **T1 violation** — stop, follow Escalation Protocol |
| Add new Renderer backend | `PRODUCT.md` T5 parity audit + `CHANGELOG.md` Known limitations (until parity is closed) + `SPEC_CHECKLIST.md` Visual Rendering Regression Gates row |
| Add / amend / retire a Tenet | All three of `PRODUCT.md` (definition) + `AGENTS.md` (this file's guardrail row) + `SPEC_CHECKLIST.md` (regression gate) — never one without the other two |
| Bump version | `scripts/sync-docs.mjs` handles `DEPLOY.md`; you still write the `CHANGELOG.md` entry and the `HISTORY.md` append entry by hand |

### Release-time checklist

Before `gh workflow run Release ...`:

1. `node scripts/sync-docs.mjs` — apply any pending tier-1 sync
2. `node scripts/sync-docs.mjs --check` — must exit 0
3. Every applicable tier-2 row covered (CHANGELOG / HISTORY / SPEC_CHECKLIST)
4. Every box in `SPEC_CHECKLIST.md` § "Release Verification Gates" ticked
5. Then dispatch the release workflow

---

## Notes for the `main` agent

- The seven tenets above are not aspirational copy. Every time you sit down
  to plan a change, the first question is "which tenet does this touch?"
  If the answer is "none" you may proceed. If the answer names a tenet,
  the guardrail check for that tenet is part of the Definition of Done.
- "Make the test pass" is not a reason to violate a tenet.
- "Unblock the release" is not a reason to violate a tenet.
- A tenet held only when convenient is not a tenet.
