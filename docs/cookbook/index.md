# Cookbook

One-page solutions to common tasks. Each recipe links to a runnable
example where applicable.

> Status: scaffolding. The recipes below are tracked on the
> [roadmap](https://github.com/Deiamor/flowgl/blob/master/ROADMAP.md) —
> if your use case isn't yet covered, please open a Discussion describing
> it and we'll prioritize.

## Wiring & state

- **Auto-connect on handle drag** — listen to `connect` and push the
  resulting `EdgeData` into your store. Pattern in the
  [vanilla guide](../guide/vanilla#reacting-to-events).
- **Wire to Redux / Zustand / Jotai / Pinia / Svelte store** — controlled
  props + callback, just like any React Flow / form library setup.
- **Optimistic updates with a server source of truth** — mutate locally,
  rollback in the `nodeUpdate` / `edgeUpdate` handler on server reject.

## Rendering & nodes

- **Custom HTML inside a node** — set `NodeData.htmlContent` and pass a
  `sanitizeHtml` option to the chart constructor for untrusted input.
- **Custom node shapes beyond the built-in five** — use the
  `htmlContent` overlay today; a node-type registry is on the
  [roadmap](https://github.com/Deiamor/flowgl/blob/master/ROADMAP.md).
- **Status badges** — `setNodeStatus(id, 'error' | 'warning' | 'success' | 'info' | null)`.
- **Tooltips on hover** — `NodeData.tooltip`.

## Layout

- **Hierarchical layout** — `hierarchicalLayout(nodes, edges, opts)`
  returns a new node array with positions; pass it back through
  `chart.setNodes`.
- **Circular layout** — `circularLayout(nodes, { radius })`.
- **Async layout in a worker** — `LayoutWorkerClient` for hierarchical;
  generalised worker contract on the roadmap.
- **Programmatic + animated** — `chart.animateLayout(targets, duration)`
  smoothsteps each node to its target.

## Import / export

- **PNG / SVG export** — `chart.exportPNG()` / `chart.exportSVG()`.
- **SVG → PDF** — render the SVG into a `<canvas>` (or to a server-side
  PDF library) then download.
- **Validate untrusted JSON** — `chart.fromJSON` and `chart.importJSON`
  reject malformed input + dangerous `htmlContent` (script tags,
  `javascript:` URLs, inline event handlers) by default. Don't pass
  `skipValidation: true` on untrusted data.

## Performance

- **Disable autosave between many mutations** — wrap in
  `chart.batchUpdate(fn)`.
- **Limit history depth** — pass `historyLimit: 50` (or lower) for
  huge graphs.
- **Profile atlas eviction** — see [Performance](../guide/performance).

## SSR

- **Next.js / Nuxt / SvelteKit** — the wrappers defer chart construction
  to the client. No `<ClientOnly>` is required.
- **Server-side static PNG preview** — coming with a separate renderer
  backend; subscribe to the
  [roadmap](https://github.com/Deiamor/flowgl/blob/master/ROADMAP.md).

## Contributing a recipe

Each recipe is a single Markdown page under `docs/cookbook/`. Open a PR
with the new page and add it to the cookbook index in
`docs/.vitepress/config.ts`.
