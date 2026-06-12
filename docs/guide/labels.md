# Labels (CJK + multi-line)

Node and edge labels are rendered through a WebGL2 texture atlas — a
shared 2048×2048 `OffscreenCanvas` whose glyph entries are packed via
shelf-packing and uploaded as a single GPU texture. The atlas is what
makes label rendering keep up with thousands of nodes.

## Simple cases

ASCII, single-line, no fuss:

```ts
{ id: 'a', x: 0, y: 0, width: 120, height: 50, label: 'Source' }
```

The label centers horizontally and vertically within the node, picks up
the node's `style.textColor` / `fontSize` / `fontFamily` if set, and falls
back to system defaults otherwise.

## CJK / Hangul / Japanese / Chinese

Fully supported. The atlas write path is verified by a CDP-driven
regression gate (`packages/core/scripts/atlas-cjk-diag.mjs`) on every
release — it draws `한국어`, `日本語`, `中文测试`, and mixed strings and
asserts the live atlas pixels match an isolated reproduction within tight
tolerance.

```ts
[
  { id: 'a', x: 0,   y: 0, width: 140, height: 50, label: '한국어' },
  { id: 'b', x: 160, y: 0, width: 140, height: 50, label: '日本語' },
  { id: 'c', x: 320, y: 0, width: 140, height: 50, label: '中文测试' },
  { id: 'd', x: 480, y: 0, width: 200, height: 50, label: 'Mixed 한글 test' },
]
```

If you do hit a CJK rendering issue, please open a bug with the exact
label string and a screenshot — the regression gate has been tight since
0.4.1 but real-world fonts are wide territory.

## Multi-line labels

Use `\n` in the label string. The atlas wraps each line independently and
the editor preserves newlines on round-trip:

```ts
{ id: 'multi', x: 0, y: 0, width: 200, height: 100,
  label: '여러줄\nテスト\n测试' }
```

**Rule of thumb for height:** a multi-line label needs

```
node.height >= lineCount × fontSize × lineHeight + 2 × textPadding
```

For the defaults (`fontSize` 14, `lineHeight` 1.4, padding ~16), three
lines fit comfortably in `height: 100`. Too-short nodes don't crash —
the label overflows the top of the node visually. The
[examples gallery](/examples/) shows the right sizing rule of thumb.

## Editing a label

Double-click a node to open the inline editor. The editor is a
`<textarea>` so multi-line labels round-trip correctly — opening,
viewing, and blurring without edits all preserve the original `\n`s.

Keyboard:

- **Enter** commits (single-line UX preserved)
- **Shift+Enter** inserts a newline
- **Escape** cancels
- **Blur** (clicking outside) commits

IME composition (Korean / Japanese / Chinese input methods) is handled
correctly — finalising a composition with Enter does not prematurely
commit the edit.

To disable the inline editor globally:

```ts
new FlowChart({ container, labelEditable: false })
```

The `nodeDoubleClick` event still fires when `labelEditable: false`, so
you can route to your own editor.

## Styling labels

Per-node style overrides:

```ts
{ id: 'a', x: 0, y: 0, width: 140, height: 50, label: 'Heading',
  style: {
    textColor:  '#1a73e8',
    fontSize:   16,
    fontFamily: 'Inter, system-ui',
    lineHeight: 1.6,
  } }
```

Global defaults flow through theme tokens — see [Performance](./performance)
for a note on what affects atlas eviction.

## Edge labels

Edges get a midpoint label via `EdgeData.label`. The label renders
through the same atlas, on a small white background pill:

```ts
{ id: 'e1', source: 'a', target: 'b', label: 'validated' }
```

Edge labels are single-line.

## Atlas eviction

When the total label count exceeds what fits in the 2048×2048 atlas, the
atlas evicts and rebuilds. From 0.4.1 onward this is invisible — the
`text-program` re-checks the atlas generation after pre-warming and
rebuilds every cached quad if eviction fired mid-frame. Older versions
(0.4.0 specifically) mis-mapped labels after eviction; upgrade to 0.4.1+.
