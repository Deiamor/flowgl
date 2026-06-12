# Validating untrusted JSON

When the JSON you're about to feed into `fromJSON` / `importJSON` came
from anywhere outside your codebase — a user upload, an API you don't
control, a saved file, a clipboard paste — treat it as hostile. flowgl
ships a schema validator that catches every public-API-violating shape
before it reaches the chart's mutation path.

## What the validator catches

`fromJSON(data)` and `importJSON(data, mode?)` run `validateChartJson`
internally. It rejects:

- Missing required fields (`id`, `x`, `y`, `width`, `height` on nodes;
  `id`, `source`, `target` on edges)
- Wrong types (`x: "100"` instead of `100`, etc.)
- Non-finite numbers (`Infinity`, `NaN`)
- `id`s that aren't strings, or are empty
- `source` / `target` referring to nodes that don't exist
- `htmlContent` containing `<script>` tags, `javascript:` URLs, or
  inline event handlers (`onclick=`, `onload=`, etc.)
- Cycles in `parentId` chains
- `parentId` referencing a non-existent or non-group node

Anything that passes still goes through `sanitizeHtml` (if you set one)
when the HTML eventually renders. The two layers compose.

## Default safe usage

```ts
import { FlowChart } from '@flowgl/core'

try {
  chart.fromJSON(untrusted)
} catch (e) {
  console.error('invalid graph payload:', e.message)
  showUserError("That file isn't a valid flowgl graph.")
}
```

`fromJSON` throws on validation failure with a descriptive message
("node a is missing required field 'width'", etc.).

## When the input is *yours* — skip the check

Round-tripping data you produced yourself (`toJSON` → some store →
`fromJSON`) doesn't need re-validation. The validator costs a graph
walk; for huge graphs that's measurable:

```ts
const snap = chart.toJSON()
saveToBackend(snap)
// later
chart.fromJSON(snap, { skipValidation: true })
```

**Only use `skipValidation: true` on inputs you trust.** "Came from our
backend" counts only if your backend itself validates on write. "Came
from localStorage" doesn't — your own user can edit localStorage in
DevTools.

## Merging untrusted into the current graph

`importJSON(data, 'merge')` validates by default. It will reject the
*entire* incoming payload if any single node or edge fails — partial
merges of partially-invalid payloads are not supported (intentionally;
they almost always become bug bait).

```ts
try {
  chart.importJSON(untrusted, 'merge')
} catch (e) {
  console.error(e.message)
  // The chart is unchanged. No half-committed merge to undo.
}
```

## Sanitizing `htmlContent`

The validator rejects obviously-bad HTML (script tags, `javascript:`
URLs, `on*=`). It does not catch every clever vector — escaped
fragments, mutation XSS, dangerous attribute values. For an
`htmlContent` field, the validator is necessary but not sufficient.
Always pair it with a `sanitizeHtml` function:

```ts
import DOMPurify from 'dompurify'

const chart = new FlowChart({
  container,
  sanitizeHtml: (html) => DOMPurify.sanitize(html),
})
chart.fromJSON(untrustedJsonFromTheNetwork)
```

See [SECURITY.md](https://github.com/Deiamor/flowgl/blob/master/SECURITY.md)
for the full threat model.

## Worked example — file upload flow

```ts
const fileInput = document.querySelector<HTMLInputElement>('input[type=file]')!
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0]
  if (!file) return

  if (file.size > 5 * 1024 * 1024) {  // 5 MB cap
    showUserError('File too large.')
    return
  }
  let text: string
  try {
    text = await file.text()
  } catch {
    showUserError("Couldn't read that file.")
    return
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    showUserError("That file isn't JSON.")
    return
  }
  try {
    chart.fromJSON(parsed)
  } catch (e) {
    showUserError((e as Error).message)
  }
})
```

Four error surfaces, each with a specific user message. Size cap, parse
guard, schema validation, and (if you ever turn it on) a sanitizer.

## See also

- [SECURITY.md threat model](https://github.com/Deiamor/flowgl/blob/master/SECURITY.md)
- [Custom HTML node cookbook](./html-node)
- [JSON roundtrip example](https://dev.flowgl.ouranos.kr/examples/json-roundtrip.html)
- [API reference — `fromJSON` / `importJSON`](/api/flowchart)
