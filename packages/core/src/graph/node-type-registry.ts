import type { NodeData } from './node'

/**
 * Where this node-type is rendered.
 *
 *   - `'builtin'` — the four hardcoded SDF shapes (`rectangle`,
 *     `circle`, `diamond`, `hexagon`) baked into the WebGL fragment
 *     shader and the Canvas2D switch. Same fast path as before 0.9.0.
 *     Plugin authors cannot register new `'builtin'` types; the SDF
 *     branches are compiled and immutable at runtime. The registry
 *     auto-registers them at chart construction so consumers can
 *     query a uniform list.
 *   - `'group'` — the existing collapsible parent-group node type.
 *     Reserved name; behaves like a special builtin.
 *   - `'html'` — DOM overlay. The chart mounts a `<div>` per node
 *     instance inside the chart container, positioned over the
 *     world-space rect via `viewport.worldToScreen`. The renderer
 *     paints **no** WebGL geometry for the node body (handles, labels,
 *     and status badges still render through the existing paths
 *     unless the type opts out). External plugins ship as
 *     `category: 'html'`.
 *
 * Why no `'canvas2d'` category — the Canvas2D renderer already covers
 * every built-in shape and the WebGL path doesn't gain a per-node
 * Canvas2D fallback without significant atlas/composition work.
 * Plugin authors get the HTML escape hatch instead.
 */
export type NodeTypeCategory = 'builtin' | 'group' | 'html'

/**
 * Render hook for a `'html'` node-type. Called every time the node
 * mounts, on every prop change (including position via `viewport`
 * change), and every time the node's `data` mutates through
 * `updateNodeData`. The implementation should write idempotently to
 * `container` — usually by setting `innerHTML` from a template, or
 * mutating a small set of inner elements.
 *
 * `container` is the per-node `<div>` the chart has positioned. The
 * implementation owns its content. The chart does NOT clear `container`
 * between calls — that's the renderer's responsibility, because some
 * consumers will want to preserve DOM identity to keep focus / form
 * state / animation in place across data ticks.
 */
export type HtmlNodeRenderFn = (
  container: HTMLDivElement,
  node: NodeData,
  ctx: { zoom: number; selected: boolean; readOnly: boolean },
) => void

/** Optional hit-test override. World coords (wx, wy) and the node bbox. */
export type NodeHitTestFn = (node: NodeData, wx: number, wy: number) => boolean

export interface NodeTypeDefinition {
  /**
   * Where this type is rendered. Pre-existing builtin / group names
   * (`rectangle`, `circle`, `diamond`, `hexagon`, `group`) cannot be
   * re-registered. External plugins must register as `'html'`.
   */
  category: NodeTypeCategory
  /** Render hook — required for `'html'`, ignored for `'builtin'`/`'group'`. */
  render?: HtmlNodeRenderFn
  /**
   * Default `width` / `height` applied when `addNode` is called without
   * explicit sizing. Optional.
   */
  defaultSize?: { width: number; height: number }
  /** Optional hit-test override. When omitted, AABB hit test is used. */
  hitTest?: NodeHitTestFn
  /**
   * Default CSS class applied to the `<div>` container of every node of
   * this type. The chart's `sanitizeClassName` strips non-`A-Za-z0-9_- `
   * characters; supply your own SSOT here.
   */
  className?: string
  /**
   * Optional teardown — called when a node of this type is removed or
   * the chart is disposed. Useful for canceling ResizeObservers or
   * outstanding fetches the `render` set up.
   */
  destroy?: (container: HTMLDivElement, node: NodeData) => void
}

const RESERVED_NAMES = new Set(['rectangle', 'circle', 'diamond', 'hexagon', 'group'])

/**
 * Single source of truth mapping `NodeData.type` → renderer behaviour.
 *
 * The chart constructs one registry per instance. Four `'builtin'` and
 * one `'group'` entry are auto-registered. External plugins register
 * additional `'html'` types through `chart.registerNodeType(name, def)`.
 *
 * Why per-instance and not module-level: two charts in the same page
 * should be able to register conflicting type names without clobbering
 * each other, and tests should not bleed registered types into each
 * other. Plugins that want to register globally can call
 * `chart.registerNodeType(...)` themselves at app startup.
 */
export class NodeTypeRegistry {
  private types = new Map<string, NodeTypeDefinition>()

  constructor() {
    // Built-in shapes — these names are recognised by the WebGL2 SDF
    // fragment shader and the Canvas2D switch. They participate in the
    // registry only so consumer code can query a single source of truth
    // and so plugin authors get a clean "already in use" error instead
    // of a confusing render bug.
    this.types.set('rectangle', { category: 'builtin' })
    this.types.set('circle',    { category: 'builtin' })
    this.types.set('diamond',   { category: 'builtin' })
    this.types.set('hexagon',   { category: 'builtin' })
    this.types.set('group',     { category: 'group' })
  }

  register(name: string, def: NodeTypeDefinition): void {
    if (!name || typeof name !== 'string') {
      throw new Error('[NodeTypeRegistry] register: name must be a non-empty string')
    }
    if (RESERVED_NAMES.has(name)) {
      throw new Error(`[NodeTypeRegistry] register: '${name}' is reserved for a built-in type`)
    }
    if (def.category !== 'html') {
      throw new Error(`[NodeTypeRegistry] register: external types must be category: 'html' (got '${def.category}')`)
    }
    if (typeof def.render !== 'function') {
      throw new Error(`[NodeTypeRegistry] register: 'html' types require a render function`)
    }
    if (this.types.has(name)) {
      // Replace silently — the host may legitimately want to re-register
      // a type after a hot-reload. Warn so accidental collisions surface.
      // eslint-disable-next-line no-console
      console.warn(`[NodeTypeRegistry] '${name}' was already registered — replacing.`)
    }
    this.types.set(name, def)
  }

  unregister(name: string): boolean {
    if (RESERVED_NAMES.has(name)) return false
    return this.types.delete(name)
  }

  get(name: string): NodeTypeDefinition | undefined {
    return this.types.get(name)
  }

  has(name: string): boolean {
    return this.types.has(name)
  }

  list(): string[] {
    return [...this.types.keys()]
  }

  /** Custom (html) types only — what host apps usually want to iterate. */
  listCustom(): string[] {
    return [...this.types.entries()].filter(([, d]) => d.category === 'html').map(([k]) => k)
  }
}
