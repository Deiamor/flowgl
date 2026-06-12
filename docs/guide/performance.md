# Performance & atlas

flowgl is built for graphs that overflow SVG-based libraries. The
benchmarks live in
[PERFORMANCE.md](https://github.com/Deiamor/flowgl/blob/master/packages/core/PERFORMANCE.md);
this page is the working guide for hitting them in your own app.

## Headline numbers

| Graph size | Target | Floor | Current (SwiftShader headless) |
| --- | --- | --- | --- |
| 1,000 nodes | 60 fps | 60 fps | 120 fps |
| 5,000 nodes | 60 fps | 30 fps | 113.6 fps |
| 10,000 nodes | 30 fps | 30 fps | 114.1 fps |

SwiftShader is the *floor* of what's available — real GPUs do
substantially better. We publish the SwiftShader numbers because that's
what a CI runner without a discrete GPU produces, and we'd rather
under-promise.

## Eight critical optimizations

The current numbers come from the following stack, in roughly
decreasing-impact order:

1. **Instanced rendering for nodes** — one draw call, an `InstancedArray`
   for per-node attributes. Adding a node is a `bufferSubData` call, not
   a new draw.
2. **Per-frame VBO packing for edges** — bezier tessellated on CPU,
   triangle strip uploaded as one packed VBO. Edge count drives memory,
   not draw calls.
3. **Frustum culling** — nodes and edges outside the viewport are
   dropped before upload. Zoomed-in graphs pay the cost of what's
   visible, not what exists.
4. **Text atlas with shelf packing** — every unique (label, font,
   color) cached in a 2048×2048 atlas, looked up in O(1) per frame.
5. **Pass-1 atlas pre-warm + generation re-check** — `text-program` writes
   all entries to the atlas before computing any quads. Eviction
   re-checked at the end of pre-warm; if it fired, every quad rebuilds
   so no UV is stale (the 0.4.1 fix).
6. **Per-entry OffscreenCanvas + drawImage for atlas writes** — every
   glyph is rasterized in a fresh isolated canvas and `drawImage`'d into
   the live atlas. Isolates the write from any cumulative ctx state
   (the 0.2.6 structural fix for the CJK glyph drop).
7. **Render-time caches** — `cachedTextNodes`, `cachedHasAnimated`,
   `nodeEdgeIndex` eliminate per-frame `filter` / `some` calls.
8. **2-pass text render** — pre-warm fills the atlas, then a second
   pass generates vertices. Prevents mid-frame atlas eviction from
   showing a half-baked frame.

## Performance Tenet (T6) — what we promise

From [PRODUCT.md](https://github.com/Deiamor/flowgl/blob/master/PRODUCT.md):

> A PR that drops any tier below its floor is a regression, regardless of
> feature value.

There is no "we'll optimize it later" — a PR that ships at 25 fps for
10k nodes does not merge until it's back above the floor or has an
explicit Tenet-exception entry approved by the maintainer and recorded
in HISTORY.md.

## What you can do to keep fps up

- **Don't drive thousands of nodes through React reconciliation every
  frame.** The framework wrappers diff their props at the chart's level,
  not through the framework's render tree. Incremental mutations via
  `chart.addNode()` / `chart.updateNode()` / `chart.removeNode()` are
  cheaper than rewriting an entire `nodes` array.
- **Set `animated: true` only on edges that actually need to animate.**
  Animated edges fall outside the cache and re-tessellate each frame.
- **Keep `historyLimit` reasonable** (default 100). Each undo snapshot
  is a full graph copy — at 50k nodes that's expensive memory.
- **Use `batchUpdate(fn)` for multi-mutation operations**. Layout,
  import, import-merge — wrap them in `batchUpdate` so they create one
  history entry and one render flush instead of many.

## Atlas eviction (the thing that bit 0.4.0)

The atlas is 2048×2048 and holds however many entries fit. When you add a
new unique label that doesn't fit, the atlas evicts every entry and
starts over. Eviction is correct (the rendered output stays right) but
costs a full text re-pack.

A reasonable rule: **if your visible graph has more than a few hundred
distinct labels with distinct (font, color, line-height) combinations**,
profile to confirm eviction isn't the bottleneck. The DevTools
Performance tab will show repeated `getImageData` + `drawImage` calls in
the same frame.

When in doubt, the
[`atlas-cjk-diag.mjs`](https://github.com/Deiamor/flowgl/blob/master/packages/core/scripts/atlas-cjk-diag.mjs)
script overflows the atlas on purpose and verifies every label still
maps correctly. It's the same script the release gate runs.

## Reporting a performance regression

Open a bug. Include:

- `chart.getNodes().length` / `getEdges().length`
- Browser + GPU (in Chrome, paste `chrome://gpu` summary)
- Frame timeline from DevTools Performance (a screenshot is fine)
- Whether the same scene is fine in an older version (if so, which)

`pnpm dev` + the bundled `demo/benchmark.html` is a deterministic
starting point — we can usually narrow a regression by running it on the
same revision.
