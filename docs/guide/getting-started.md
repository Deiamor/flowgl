# Install & first chart

flowgl ships as four npm packages: a framework-agnostic core and three thin
wrappers. Pick whichever set matches your stack — they share the same
`FlowChart` API underneath, so switching frameworks later doesn't mean
rewriting your editor.

## Install

::: code-group

```bash [pnpm]
pnpm add @flowgl/core             # vanilla TS / JS
pnpm add @flowgl/react            # React 17+ wrapper
pnpm add @flowgl/vue              # Vue 3 wrapper
pnpm add @flowgl/svelte           # Svelte 4+ wrapper
```

```bash [npm]
npm install @flowgl/core
npm install @flowgl/react
npm install @flowgl/vue
npm install @flowgl/svelte
```

```bash [yarn]
yarn add @flowgl/core
yarn add @flowgl/react
yarn add @flowgl/vue
yarn add @flowgl/svelte
```

:::

Wrappers depend on `@flowgl/core` automatically — no need to install both
explicitly unless you want to pin a specific core version.

## Verify the install

Every published tarball is signed with npm provenance attestations. To
verify the build provenance of what you just installed:

```bash
npm audit signatures @flowgl/core
```

Expected output: `verified registry signatures` and `verified attestations`.
If either is missing, the package wasn't built by the official CI workflow.

Every tarball also ships a CycloneDX 1.5 `sbom.json` listing exactly the
components that went into the build. `@flowgl/core`'s SBOM lists only the
package itself — there are no runtime dependencies. See
[SECURITY.md](https://github.com/Deiamor/flowgl/blob/master/SECURITY.md)
for the full supply-chain story.

## Browser requirements

WebGL2 is required for the default renderer. Supported browsers:

| Browser | Minimum |
| --- | --- |
| Chrome / Edge | 56+ |
| Firefox | 51+ |
| Safari | 15+ |

When WebGL2 is unavailable the `onError` callback is invoked — no silent
crash. You can also opt into the Canvas 2D fallback explicitly with
`rendererKind: 'canvas2d'`. See [Renderers](./renderers) for the trade-offs.

## Your first chart

Pick the framework and follow the link.

- [Vanilla JS / TypeScript](./vanilla)
- [React](./react)
- [Vue 3](./vue)
- [Svelte](./svelte)

All four guides land on the same shape: a `<div>` container, a `FlowChart`
instance (or wrapper component), an array of nodes, an array of edges. The
event names, options, and methods are identical across frameworks — the
wrapper code is intentionally thin.

## What's next

- Read [Why flowgl](./why-flowgl) for the comparison with React Flow / mermaid
  and the design rationale.
- Read [Renderers](./renderers) to understand when to use Canvas 2D instead
  of WebGL2.
- Browse the [Cookbook](/cookbook/) for one-page solutions to common tasks.
- Browse the [examples gallery](/examples/) for runnable scenarios.
