# ROADMAP

flowgl is a community-funded MIT library. There's no commercial backlog, no
"Pro tier" gating decisions, and no internal-only milestones. The roadmap
below is the same one the maintainer works from.

This document is a **direction of travel**, not a release commitment. Items
move between sections as priorities and outside contributions land. The
Keep a Changelog-style record of what actually shipped lives in
[CHANGELOG.md](./CHANGELOG.md); the append-only ledger lives in
[HISTORY.md](./HISTORY.md).

## Now (active — 0.5.x window)

Items here are likely to ship within the next two or three releases.
After the 0.4.2 → docs / examples / infra sweep all five original "Now"
items landed; new ones live below them.

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

- **Benchmark dashboard page** — small static page in `docs/` that
  renders the `docs/data/benchmarks.json` time-series. The workflow
  already writes the data; the visualization is missing.
- **Cookbook recipe pages** — the cookbook index lists 7 planned
  recipes but each one is still a placeholder. Each recipe = one
  Markdown page under `docs/cookbook/<slug>.md` with a runnable
  snippet and (where possible) a link into the examples gallery.
- **Seed Discussions** — pin Welcome posts in Q&A / Ideas / Show & Tell
  / Announcements pointing at the relevant docs page. Empty channels
  intimidate contributors.

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
