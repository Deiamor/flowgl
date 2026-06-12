# Render custom HTML inside a node

When the built-in node shapes aren't enough (you want a status card,
a metric tile, a custom widget), set `NodeData.htmlContent` to a string
of HTML. flowgl renders it as a DOM overlay positioned over the WebGL
canvas — the WebGL node draws as the background, your HTML draws on top.

## Minimal

```ts
const chart = new FlowChart({
  container,
  nodes: [
    {
      id: 'metric',
      x: 100, y: 100, width: 220, height: 80,
      label: '',  // empty so the WebGL atlas doesn't draw a label too
      htmlContent: `
        <div style="padding:12px;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;">
            P95 latency
          </div>
          <div style="font-size:24px;font-weight:700;">142 ms</div>
        </div>
      `,
      style: { backgroundColor: '#fff', borderColor: '#e2e8f0' },
    },
  ],
})
```

The `style` of the node still controls the rounded rectangle that draws
behind your HTML. `label` is left empty because you're rendering text
yourself.

## Sanitizing untrusted HTML

`htmlContent` is written to `innerHTML`. If the string could come from
**any untrusted source** — user input, an API you don't fully control,
a database that ever accepted a string from the wire — you must pass a
`sanitizeHtml` function when constructing the chart.

```ts
import DOMPurify from 'dompurify'

const chart = new FlowChart({
  container,
  sanitizeHtml: (html) => DOMPurify.sanitize(html),
  nodes: [
    { id: 'a', x: 0, y: 0, width: 200, height: 80, label: '',
      htmlContent: userProvidedString },
  ],
})
```

Without `sanitizeHtml`:

- flowgl emits a one-time console warning on first `htmlContent` write,
  pointing you to this page.
- `fromJSON` and `importJSON` still validate against script tags,
  `javascript:` URLs, and inline `on*=` event handlers and reject the
  payload — but if you go straight to `setNodes` / `addNode` /
  `updateNode` with a raw string, the sanitizer is the only line of
  defense.

> The lightest rule: **if there's any path by which the string was
> influenced by a user, sanitize**. flowgl doesn't ship a sanitizer
> because the right one is project-specific (you may want to allow
> more, or less, than DOMPurify's default).

## Interactivity inside the HTML

The HTML overlay receives pointer events. Anything you put in there can
have its own `onclick` / `onchange` etc. — Just be aware that **events
inside the overlay do not propagate to the chart's drag / select logic**.
That's usually what you want (you don't want a button click to also
start dragging the node).

```ts
htmlContent: `
  <div style="padding:12px;display:flex;gap:8px;">
    <button data-action="restart" style="padding:4px 10px;">Restart</button>
    <button data-action="logs"    style="padding:4px 10px;">Logs</button>
  </div>
`
```

```ts
container.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  const action = target.dataset.action
  if (action === 'restart') restartService(id)
})
```

The container event listener catches everything inside any node's
overlay. Use `data-` attributes to identify which action fired.

## When NOT to use `htmlContent`

The HTML overlay has two costs you should think about:

1. **DOM mutation**: each `htmlContent` node creates real DOM elements.
   At hundreds of HTML nodes you'll start to feel layout cost on every
   scroll / pan / zoom; at thousands you'll regret it.
2. **WebGL label is wasted**: setting `label: ''` means the atlas
   doesn't draw, but the WebGL node's quad is still there. That's
   fine — it's the rounded rect background — but the atlas-text
   performance optimizations don't help you.

For high-density graphs, stick to plain `label` + node `style`. Use
`htmlContent` selectively for the few nodes where the extra information
genuinely matters.

## See also

- [Custom HTML node example](https://dev.flowgl.ouranos.kr/examples/html-node.html)
- [Cookbook index](./)
- [API reference — `sanitizeHtml` option](/api/flowchart)
