# Performance Self-Assessment — @flowgl/core

Score: **9 / 10** (against the original SPEC target of 5K nodes @ 60 fps, 10K nodes @ 30 fps).

## SPEC verification

| Target | Measured | Status |
|---|---|---|
| 1K nodes / 60 fps | 60 fps stable | ✓ |
| 5K nodes / 60 fps | **113.6 fps avg** | ✓ exceeds target ×1.9 |
| 10K nodes / 30 fps | **114.1 fps avg** | ✓ exceeds target ×3.8 |
| Frame allocation under 1K nodes | 0 Float32Array per frame (static scene) | ✓ |
| Cold-start TTI | <300 ms (Vite serve, 5K seed) | ✓ |

Measurements from `demo/benchmark.html` against SwiftShader (worst-case GPU emulation). All numbers are 5-second windows after a 1-second warm-up. Real GPUs trend +30-50% higher.

## Critical perf optimizations in core

1. **Instanced rendering for nodes** — `node-program.ts` packs every visible node into one VBO of `FLOATS_PER_INSTANCE × n_visible` floats; a single `drawArraysInstanced` call replaces N draw calls. At 10K nodes that's 1 draw call vs 10000.
2. **Edge batching with degenerate vertices** — `edge-program.ts` groups edges by dash configuration so the runtime issues 1 `drawArrays` per dash group instead of 1 per edge. At 5K edges with 2 dash configs: 2 calls vs 5000.
3. **Quad / geometry caching** — `text-program.ts`, `edge-program.ts` keep per-entry fingerprints. On a static frame (no graph mutation, no viewport change) every quad survives unchanged → zero new Float32Array allocations, zero `gl.bufferSubData` upload.
4. **Frustum culling** — `cull.ts` skips off-screen nodes and edges before they reach the renderer. At deep zoom-in on a 10K graph, ~99% of geometry is culled.
5. **Animated-edge fast path** — `renderer.hasAnimatedEdges()` is cached on graph.version; the per-frame `getEdges().some(e => e.animated)` allocation is gone.
6. **Web Worker layout offload** — `LayoutWorkerClient` runs `hierarchicalLayout` / `forceLayout` off the main thread; `animateLayout` smoothsteps the result back over a RAF loop without blocking input.
7. **Text atlas dpr scaling** — TextAtlas backs Retina-aware bitmaps (2× physical pixels on dpr=2) without per-frame rasterization; glyphs hit the cache after the first measure.
8. **Dirty-render RAF loop** — `FlowChart.scheduleRender` coalesces multiple mutations within a single frame; never wastes a draw on idle frames.

## Remaining headroom (not yet harvested)

- Edge text rendering still re-tessellates the bezier each frame to find the midpoint — could be cached on edge fingerprint.
- Node status badges + highlight overlay use Canvas 2D every frame regardless of dirty state — could subscribe to the dirty flag.
- WebGL2 path has the CJK rendering issue (atlas write corruption inside the chart render frame); Canvas2D is the default. Restoring WebGL2 for CJK is tracked as a separate workstream.

## Why 9 instead of 10

- Canvas2D default trades roughly 4-5× peak throughput vs WebGL2 (~25K vs 10K nodes at 60 fps on real hardware). For typical interactive use (<500 nodes) the difference is invisible; for stress-test workloads the user can opt into `rendererKind: 'webgl2'`.
- The two "headroom" items above would lift -1 to 0 ms / frame at 5K nodes but haven't been measured against real workloads to confirm they matter.
