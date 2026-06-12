---
layout: home

hero:
  name: flowgl
  text: GPU-accelerated flowchart library
  tagline: WebGL2 · zero dependencies · framework-agnostic. Smooth at 10,000 nodes.
  image:
    light: /logo.svg
    dark: /logo-dark.svg
    alt: flowgl
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/Deiamor/flowgl
    - theme: alt
      text: Live demo
      link: https://dev.flowgl.ouranos.kr/

features:
  - title: WebGL2 instanced rendering
    details: Nodes, edges, labels, and minimap all draw through one shared GL context. Instanced draw calls, frustum culling, fragment-shader text atlas. 10k nodes at 60+ fps on real GPUs.
  - title: Zero runtime dependencies
    details: '@flowgl/core ships as a single ES module with no dependencies field in package.json — auditable, supply-chain friendly, every release signed with npm provenance.'
  - title: Framework-agnostic core
    details: Vanilla TS, React, Vue, Svelte — same API surface, thin wrapper packages. Switch frameworks without rewriting your editor.
  - title: Two renderer backends
    details: WebGL2 by default; Canvas2D as an opt-in fallback for environments without WebGL2. Same Renderer interface, same public API.
  - title: Accessibility built in
    details: role="application", aria-keyshortcuts, aria-live announcements on focus, axe-clean test suite. Keyboard-only flows reach every interactive surface.
  - title: Production safety
    details: 919 tests, 93.75% statement coverage, CycloneDX SBOM in every tarball, provenance attestations, CDP-driven CJK regression gate.
---

## Why flowgl

Diagramming libraries today are either DOM/SVG-based and bottleneck at ~1k
nodes, or they require buying into a single framework. flowgl renders the
whole graph — nodes, edges, text, minimap — through one WebGL2 context, and
the same `FlowChart` class is the public API whether you use it from vanilla
TS, React, Vue, or Svelte. A Canvas 2D fallback ships behind the same
`Renderer` interface for environments without WebGL2.

```ts
import { FlowChart } from '@flowgl/core'

const chart = new FlowChart({
  container: document.getElementById('app')!,
  nodes: [
    { id: 'a', x: 100, y: 100, width: 140, height: 60, label: 'Source' },
    { id: 'b', x: 320, y: 100, width: 140, height: 60, label: 'Transform' },
    { id: 'c', x: 540, y: 100, width: 140, height: 60, label: 'Sink' },
  ],
  edges: [
    { id: 'e1', source: 'a', target: 'b' },
    { id: 'e2', source: 'b', target: 'c', animated: true },
  ],
})

chart.on('connect', ({ sourceId, targetId }) => {
  console.log('connected', sourceId, '→', targetId)
})
```

## Where to next

- **New here?** Start with [Get started](/guide/getting-started).
- **Coming from React Flow?** See [Why flowgl](/guide/why-flowgl) for the
  comparison and the migration notes.
- **Looking for a specific recipe?** Check the [Cookbook](/cookbook/).
- **Want to see it run?** The [examples gallery](/examples/) has every
  built-in feature in 30 lines or fewer.

## Open source, MIT

flowgl is MIT-licensed and community-funded. There is no Pro tier, no
gating, no commercial path planned. If you want to keep maintenance
flowing, the GitHub Sponsors button is on the repo and on the maintainer's
profile.

The roadmap is [public](https://github.com/Deiamor/flowgl/blob/master/ROADMAP.md);
contributions through PRs, Discussions, and issues are all welcome. The
[contribution guide](https://github.com/Deiamor/flowgl/blob/master/CONTRIBUTING.md)
has the full flow.
