import type { Graph } from '../graph/graph'
import type { NodeData } from '../graph/node'
import type { EdgeData } from '../graph/edge'
import { edgeControlPoints } from '../renderer/webgl/util/bezier'
import { handleXY } from '../renderer/webgl/util/handle-xy'
import { edgeMidpoint, edgePathPoints } from '../renderer/webgl/util/edge-geometry'
import { safeColor, safeNumber, safeDashArray } from './safe-css'

/**
 * Render the current `Graph` as a standalone SVG string.
 *
 * All style fields (colors, widths, dash arrays) supplied by chart data go
 * through whitelist validators — invalid input falls back to the documented
 * defaults so the exported SVG cannot be used as an attribute-injection vector.
 */
export function exportGraphAsSvg(graph: Graph, padding = 40): string {
  const nodes = graph.getNodes()
  const edges = graph.getEdges()
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  if (nodes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${padding * 2} ${padding * 2}" width="${padding * 2}" height="${padding * 2}"></svg>`
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.width); maxY = Math.max(maxY, n.y + n.height)
  }
  const vx = minX - padding, vy = minY - padding
  const vw = (maxX - minX) + padding * 2, vh = (maxY - minY) + padding * 2

  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">`]
  parts.push('<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#555"/></marker></defs>')

  // Draw group nodes first so child shapes sit on top
  const sorted = [...nodes].sort((a, b) => (a.type === 'group' ? -1 : 1) - (b.type === 'group' ? -1 : 1))

  for (const n of sorted) renderNode(parts, n)
  for (const e of edges) renderEdge(parts, e, nodeMap)

  parts.push('</svg>')
  return parts.join('\n')
}

function renderNode(parts: string[], n: NodeData): void {
  const s = { backgroundColor: '#fff', borderColor: '#1a73e8', borderWidth: 2, borderRadius: 8, textColor: '#1a1a1a', fontSize: 14, ...n.style }
  const bg     = safeColor(s.backgroundColor, '#fff')
  const border = safeColor(s.borderColor,     '#1a73e8')
  const text   = safeColor(s.textColor,       '#1a1a1a')
  const bw     = safeNumber(s.borderWidth, 2)
  const br     = safeNumber(s.borderRadius, 8)
  const fs     = safeNumber(s.fontSize, 14)
  const cx = n.x + n.width / 2, cy = n.y + n.height / 2
  const shape = s.shape ?? 'rectangle'

  if (shape === 'circle') {
    parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${n.width/2}" ry="${n.height/2}" fill="${bg}" stroke="${border}" stroke-width="${bw}"/>`)
  } else if (shape === 'diamond') {
    const pts = `${cx},${n.y} ${n.x+n.width},${cy} ${cx},${n.y+n.height} ${n.x},${cy}`
    parts.push(`<polygon points="${pts}" fill="${bg}" stroke="${border}" stroke-width="${bw}"/>`)
  } else if (shape === 'hexagon') {
    const qw = n.width / 4
    const pts = `${n.x+qw},${n.y} ${n.x+n.width-qw},${n.y} ${n.x+n.width},${cy} ${n.x+n.width-qw},${n.y+n.height} ${n.x+qw},${n.y+n.height} ${n.x},${cy}`
    parts.push(`<polygon points="${pts}" fill="${bg}" stroke="${border}" stroke-width="${bw}"/>`)
  } else {
    parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${br}" fill="${bg}" stroke="${border}" stroke-width="${bw}"/>`)
  }
  if (n.label) {
    parts.push(`<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="${text}" font-size="${fs}" font-family="system-ui,sans-serif">${svgEscape(n.label)}</text>`)
  }
}

function renderEdge(parts: string[], edge: EdgeData, nodeMap: Map<string, NodeData>): void {
  const src = nodeMap.get(edge.source); const tgt = nodeMap.get(edge.target)
  if (!src || !tgt) return
  const [sx, sy] = handleXY(src, edge.sourceHandle)
  const [ex, ey] = handleXY(tgt, edge.targetHandle)
  const st = { color: '#555555', width: 2, ...edge.style }
  const color = safeColor(st.color, '#555555')
  const width = safeNumber(st.width, 2)

  // Path d-attribute. For bezier (the only smooth case) the SVG cubic
  // command preserves the exact curve; for every other case we walk the
  // shared polyline and emit straight `L` commands. Pre-0.8.1 this branch
  // only handled bezier + straight + waypoints — step and smoothstep
  // fell through to bezier rendering, which did not match the on-screen
  // shape.
  let d: string
  if (edge.type === 'bezier' || edge.type == null) {
    if (edge.waypoints && edge.waypoints.length > 0) {
      const pts: [number, number][] = [[sx, sy], ...edge.waypoints.map(w => [w.x, w.y] as [number, number]), [ex, ey]]
      d = `M${pts.map(p => `${p[0]},${p[1]}`).join(' L')}`
    } else {
      const [c1x, c1y, c2x, c2y] = edgeControlPoints(sx, sy, edge.sourceHandle, ex, ey, edge.targetHandle)
      d = `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${ex},${ey}`
    }
  } else {
    const pts = edgePathPoints(edge, src, tgt)
    d = `M${pts.map(p => `${p[0]},${p[1]}`).join(' L')}`
  }

  const dashStr = safeDashArray(st.dashArray)
  const dash = dashStr ? `stroke-dasharray="${dashStr}"` : ''
  parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" marker-end="url(#arrow)" ${dash}/>`)

  if (edge.label) {
    // Label at the rendered-path midpoint, not the source→target straight
    // midpoint. (Same fix shape as the other label consumers.)
    const [mx, my] = edgeMidpoint(edge, src, tgt)
    parts.push(`<rect x="${mx-24}" y="${my-9}" width="48" height="18" rx="3" fill="rgba(255,255,255,0.92)"/>`)
    parts.push(`<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-family="system-ui,sans-serif" fill="#374151">${svgEscape(edge.label)}</text>`)
  }
}

export function svgEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Re-export the canonical validators from services/safe-css so callers
// outside this module (label-edit, future code paths) share the same
// allow-list rather than duplicating it.
export { safeColor, safeNumber, safeDashArray } from './safe-css'
