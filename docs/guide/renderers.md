# Renderers

flowgl ships two renderer backends behind a single `Renderer` interface.
Pick one via `rendererKind`:

```ts
new FlowChart({
  container,
  rendererKind: 'webgl2',    // default
  // rendererKind: 'canvas2d', // opt-in fallback
  // rendererKind: myCustomRenderer, // any object satisfying the Renderer interface
})
```

## WebGL2 (default)

The reason flowgl exists. Instanced draw calls for nodes, packed VBO for
edge tessellation, fragment-shader text atlas, frustum culling. Renders
10,000 nodes at 60+ fps on real GPUs.

Pick WebGL2 when:

- You're not sure which to pick — it's the default for a reason.
- Your workload approaches or exceeds ~1,000 nodes.
- You're hitting the limit of an SVG-based diagramming library.

WebGL2 is supported in every modern browser; see
[Install & first chart § Browser requirements](./getting-started#browser-requirements)
for minimum versions.

## Canvas 2D (opt-in fallback)

A CPU-rendered fallback behind the same `Renderer` interface. Useful when:

- The host environment doesn't have WebGL2 available (embedded browsers,
  headless rasterizers without GPU acceleration).
- You're rendering server-side and want to use a Canvas polyfill rather
  than a WebGL one.

Canvas 2D is **opt-in only**. The default stays WebGL2 (T1 in
[PRODUCT.md](https://github.com/Deiamor/flowgl/blob/master/PRODUCT.md)).

### Known parity gaps

Canvas 2D does not yet render some of the WebGL-specific overlays:

- Connect-drag handles (the WebGL `HandleProgram` circles)
- Reroute handles
- Endpoint circles on edges

These are tracked under T5 (Visual Feature Parity Across Backends) and are
listed in the
[CHANGELOG Known limitations](https://github.com/Deiamor/flowgl/blob/master/CHANGELOG.md).
Canvas 2D won't become the default until parity is closed.

## Custom Renderer

The `Renderer` interface is one function and a couple of lifecycle hooks:

```ts
interface Renderer {
  render(graph, viewport, frame): void
  dispose(): void
  // ...
}
```

You can plug in your own implementation by passing it to `rendererKind`
directly. This is the path forward for WebGPU, server-side PNG renderers,
embedded canvas variants, etc.

The interface contract is stable from 0.4.0 onward — additions go in
behind capability flags so existing implementations keep working.

## Switching at runtime

flowgl does not currently support hot-swapping the renderer on an existing
chart — `rendererKind` is read at constructor time. If you need to switch,
`dispose()` the existing chart and construct a new one in the same
container.

## Reading the active renderer

```ts
chart.getRendererKind() // 'webgl2' | 'canvas2d' | 'custom'
```

For feature gating, the public API itself is renderer-agnostic (T4) —
every method works identically on every shipped backend. The Canvas 2D
gaps surface as missing visuals, not as thrown methods.
