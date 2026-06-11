import type { NodeData } from '../graph/node'
import type { EdgeData } from '../graph/edge'

const MAX_LABEL_LEN = 10_000
const MAX_HTML_LEN  = 100_000
const MAX_TOOLTIP_LEN = 1_000

/**
 * Pattern that flags the obvious XSS shapes — <script> tags, javascript: URLs,
 * and inline event-handler attributes (on*=). Not an exhaustive XSS filter;
 * its purpose is to catch unsanitized payloads at the JSON boundary so the
 * caller is forced to either register `FlowChartOptions.sanitizeHtml` or
 * opt out via `{ skipValidation: true }`.
 */
const SCRIPT_PATTERN = /<script[\s>]|javascript:|\bon[a-z]+\s*=/i

export interface ChartJsonInput {
  version?: number
  nodes: unknown[]
  edges: unknown[]
  viewport?: unknown
}

export interface ValidatedChartJson {
  version?: number
  nodes: NodeData[]
  edges: EdgeData[]
  viewport?: { x: number; y: number; zoom: number }
}

/**
 * Validate untrusted JSON before loading into the chart.
 *
 * Rejects:
 * - non-array nodes/edges
 * - missing/non-string `id`
 * - non-finite numeric fields
 * - non-string `label` / `htmlContent` / `tooltip`
 * - over-length text fields (10 k label, 100 k htmlContent, 1 k tooltip)
 * - dangerous prototype-pollution keys (`__proto__`, `constructor`, `prototype`)
 *
 * Returns the sanitized object with only known fields preserved.
 */
export function validateChartJson(input: unknown): ValidatedChartJson {
  if (!isPlainObject(input)) throw new TypeError('Chart JSON must be an object')

  const obj = input as Record<string, unknown>
  if (!Array.isArray(obj.nodes)) throw new TypeError('Chart JSON `nodes` must be an array')
  if (!Array.isArray(obj.edges)) throw new TypeError('Chart JSON `edges` must be an array')

  const nodes: NodeData[] = obj.nodes.map((raw, i) => validateNode(raw, i))
  const edges: EdgeData[] = obj.edges.map((raw, i) => validateEdge(raw, i))

  const result: ValidatedChartJson = { nodes, edges }
  if (typeof obj.version === 'number' && Number.isFinite(obj.version)) {
    result.version = obj.version
  }
  if (isPlainObject(obj.viewport)) {
    const vp = obj.viewport as Record<string, unknown>
    if (isFiniteNumber(vp.x) && isFiniteNumber(vp.y) && isFiniteNumber(vp.zoom) && (vp.zoom as number) > 0) {
      result.viewport = { x: vp.x as number, y: vp.y as number, zoom: vp.zoom as number }
    }
  }
  return result
}

function validateNode(raw: unknown, index: number): NodeData {
  if (!isPlainObject(raw)) throw new TypeError(`nodes[${index}] must be an object`)
  const r = raw as Record<string, unknown>
  rejectDangerousKeys(r, `nodes[${index}]`)

  if (typeof r.id !== 'string' || r.id.length === 0 || r.id.length > 256) {
    throw new TypeError(`nodes[${index}].id must be a non-empty string ≤256 chars`)
  }
  if (!isFiniteNumber(r.x) || !isFiniteNumber(r.y)) {
    throw new TypeError(`nodes[${index}].(x|y) must be finite numbers`)
  }
  if (!isFiniteNumber(r.width) || !isFiniteNumber(r.height) || (r.width as number) <= 0 || (r.height as number) <= 0) {
    throw new TypeError(`nodes[${index}].(width|height) must be positive finite numbers`)
  }
  if (r.label !== undefined && (typeof r.label !== 'string' || r.label.length > MAX_LABEL_LEN)) {
    throw new TypeError(`nodes[${index}].label must be a string ≤${MAX_LABEL_LEN} chars`)
  }
  if (r.htmlContent !== undefined && (typeof r.htmlContent !== 'string' || r.htmlContent.length > MAX_HTML_LEN)) {
    throw new TypeError(`nodes[${index}].htmlContent must be a string ≤${MAX_HTML_LEN} chars`)
  }
  if (typeof r.htmlContent === 'string' && SCRIPT_PATTERN.test(r.htmlContent)) {
    throw new TypeError(`nodes[${index}].htmlContent contains a <script> tag, javascript: URL, or inline event handler. If you've registered a sanitizer (FlowChartOptions.sanitizeHtml) and trust this input, load via fromJSON(..., { skipValidation: true })`)
  }
  if (r.tooltip !== undefined && (typeof r.tooltip !== 'string' || r.tooltip.length > MAX_TOOLTIP_LEN)) {
    throw new TypeError(`nodes[${index}].tooltip must be a string ≤${MAX_TOOLTIP_LEN} chars`)
  }

  // Whitelist known optional fields; drop unknown keys silently.
  const node: Record<string, unknown> = {
    id:     r.id,
    x:      r.x,
    y:      r.y,
    width:  r.width,
    height: r.height,
    label:  typeof r.label === 'string' ? r.label : '',
  }
  if (typeof r.htmlContent === 'string')  node.htmlContent = r.htmlContent
  if (typeof r.tooltip === 'string')      node.tooltip     = r.tooltip
  if (typeof r.type === 'string')         node.type        = r.type
  if (typeof r.parentId === 'string')     node.parentId    = r.parentId
  if (typeof r.collapsed === 'boolean')   node.collapsed   = r.collapsed
  if (typeof r.locked === 'boolean')      node.locked      = r.locked
  if (typeof r.status === 'string')       node.status      = r.status
  if (isPlainObject(r.style))             node.style       = r.style
  if (Array.isArray(r.ports))             node.ports       = r.ports
  return node as unknown as NodeData
}

function validateEdge(raw: unknown, index: number): EdgeData {
  if (!isPlainObject(raw)) throw new TypeError(`edges[${index}] must be an object`)
  const r = raw as Record<string, unknown>
  rejectDangerousKeys(r, `edges[${index}]`)

  if (typeof r.id !== 'string' || r.id.length === 0 || r.id.length > 256) {
    throw new TypeError(`edges[${index}].id must be a non-empty string ≤256 chars`)
  }
  if (typeof r.source !== 'string' || r.source.length === 0) {
    throw new TypeError(`edges[${index}].source must be a non-empty string`)
  }
  if (typeof r.target !== 'string' || r.target.length === 0) {
    throw new TypeError(`edges[${index}].target must be a non-empty string`)
  }
  if (r.label !== undefined && (typeof r.label !== 'string' || r.label.length > MAX_LABEL_LEN)) {
    throw new TypeError(`edges[${index}].label must be a string ≤${MAX_LABEL_LEN} chars`)
  }

  const edge: Record<string, unknown> = {
    id:     r.id,
    source: r.source,
    target: r.target,
  }
  if (typeof r.label === 'string')        edge.label        = r.label
  if (typeof r.sourceHandle === 'string') edge.sourceHandle = r.sourceHandle
  if (typeof r.targetHandle === 'string') edge.targetHandle = r.targetHandle
  if (typeof r.type === 'string')         edge.type         = r.type
  if (typeof r.animated === 'boolean')    edge.animated     = r.animated
  if (isPlainObject(r.style))             edge.style        = r.style
  if (Array.isArray(r.waypoints))         edge.waypoints    = r.waypoints
  return edge as unknown as EdgeData
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isFiniteNumber(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v)
}

function rejectDangerousKeys(r: Record<string, unknown>, path: string): void {
  if (Object.prototype.hasOwnProperty.call(r, '__proto__'))   throw new TypeError(`${path} contains forbidden key __proto__`)
  if (Object.prototype.hasOwnProperty.call(r, 'constructor')) throw new TypeError(`${path} contains forbidden key constructor`)
  if (Object.prototype.hasOwnProperty.call(r, 'prototype'))   throw new TypeError(`${path} contains forbidden key prototype`)
}
