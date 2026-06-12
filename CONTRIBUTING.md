# Contributing to flowgl

Thanks for thinking about contributing — flowgl is an open-source library that
gets better with outside eyes on it.

This document is the short version of what we expect. The longer version
(internal guardrails, Tenet escalation, doc update map) lives in
[`AGENTS.md`](./AGENTS.md), [`PRODUCT.md`](./PRODUCT.md), and
[`SPEC_CHECKLIST.md`](./SPEC_CHECKLIST.md).

## Quick start

```bash
git clone https://github.com/Deiamor/flowgl.git
cd flowgl
pnpm install
pnpm dev          # demo on http://localhost:5173
pnpm test         # vitest, 919 tests
pnpm typecheck    # all 4 packages
pnpm build        # production build
```

Node ≥ 20, pnpm ≥ 9.

## Reporting bugs

1. Reproduce on the latest release of `@flowgl/core`. Older versions don't
   get patches.
2. Open an issue using the **Bug report** template. Include:
   - Browser + OS + version
   - `rendererKind` you opted into (default `webgl2`, or `canvas2d`)
   - Minimal reproduction — a CodeSandbox / StackBlitz link is ideal, but
     a 20-line snippet that fails is also fine
   - Expected vs. actual
3. Visual regressions (label mis-mapping, flicker, alignment): attach a
   screenshot. The 0.4.0 / 0.4.2 hotfixes both came from one screenshot
   that pixel-count checks missed.

## Requesting features

Open a **Feature request** issue. The first question we'll ask is which
Core Value Tenet the feature touches (see [PRODUCT.md](./PRODUCT.md)):

- Adding a runtime dep to `@flowgl/core`? T2 violation — won't ship.
- Adding a framework-specific symbol to core? T3 violation — goes in a
  wrapper package instead.
- Renderer feature in only one backend? T5 parity gap — has to land in
  every shipped backend or get flagged `experimental`.

The Tenets aren't there to gate-keep — they're there so a yes today
doesn't become a regret in three releases.

## Submitting a PR

### Branch

Branch off `master`. Name it descriptively: `fix/atlas-eviction-race`,
`feat/dissolve-group`, `docs/getting-started-svelte`.

### Commit message

Keep the subject under 70 characters. Body explains the *why* — not the
*what* (the diff already tells us *what*). For a bug fix include a short
"why this is the right level of fix" paragraph.

### Run before you push

```bash
pnpm typecheck                                # 0 errors
pnpm test                                     # all pass
pnpm build                                    # all 4 packages build
node scripts/sync-docs.mjs --check            # docs in sync + every public export has a docs mention
```

If `sync-docs.mjs --check` reports a public export missing from `docs/`,
add at least a one-line bullet describing it under the relevant heading
in `docs/api/flowchart.md` (or the matching guide page). The audit
exists because between 0.5.0 and 0.9.1 the library shipped 18 + new
public APIs while `docs.flowgl.ouranos.kr` sat at 0.4.2 — the gate
now blocks that class of drift at PR review.

Internal exports kept available for advanced apps but not on the
user-reading path live in `DOCS_AUDIT_IGNORE` inside the script;
adding to that list should be rare and justified.

If you touched anything in `packages/core/src/renderer/webgl/atlas/` or
`packages/core/src/renderer/webgl/programs/`, also run the CDP atlas
regression gate:

```bash
pnpm dev &                                    # in one terminal
brave-debug                                   # in another (Brave / Chrome with --remote-debugging-port=9222)
node packages/core/scripts/atlas-cjk-diag.mjs http://localhost:5173
```

Both `CJK PARITY OK` and `ENTRY MAPPING OK` must print. Open
`/tmp/cjk-current.png` and look at it — pixel counts can pass while
labels render in the wrong place (this is how 0.4.0 shipped broken).

### Doc updates

Most code changes need at least one doc to follow.
[`AGENTS.md` § Doc Update Map](./AGENTS.md#doc-update-map) has the full
matrix; the short version:

| Change | Touch |
|---|---|
| New public API | README API section + `CHANGELOG.md` (Added) + a regression test |
| Public behavior change | `CHANGELOG.md` (Changed) + `HISTORY.md` (append) + `SPEC_CHECKLIST.md` |
| Bug fix | `CHANGELOG.md` (Fixed) + `HISTORY.md` (append) + a regression test |
| New source file under `packages/core/src/` | `PROJECT.md` directory tree |
| New Renderer backend / Tenet change | Stop, see Tenet Escalation Protocol in `AGENTS.md` |

### PR template

The PR template will ask you to tick a few boxes. They're not bureaucracy
— they're the same items reviewers will check, so doing it yourself
short-circuits a review round.

## Testing philosophy

- **Unit tests** (`vitest` + `happy-dom`) cover pure functions, graph
  operations, public API surface, and DOM interactions. New public API
  needs a unit test; non-trivial fixes need a regression test.
- **CDP atlas diagnostic** (`packages/core/scripts/atlas-cjk-diag.mjs`)
  covers what unit tests can't see: actual pixel output from a real
  browser. Run it for any atlas / text-program change.
- **Manual visual check** is still required for renderer changes — open
  the demo at `pnpm dev`, zoom / pan / dblclick-edit, then look. The
  bugs that ship are the ones that pass automation and only fail a human's
  eye.

## Style

- TypeScript strict, no `any` without a comment explaining why.
- Comments only when the *why* is non-obvious. Code that needs a comment
  to explain *what* it does usually needs a clearer name instead.
- Don't add error handling, fallbacks, or validation for cases that can't
  happen. Trust internal boundaries; validate user input at API edges.

## License

By contributing you agree your code is licensed under the [MIT
License](./LICENSE).

## Questions

Bug? File an issue. Open-ended question? Start a discussion in [GitHub
Discussions](https://github.com/Deiamor/flowgl/discussions). Security
issue? See [SECURITY.md](./SECURITY.md) — do *not* open a public issue.
