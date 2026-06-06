import type { NodeData } from '../graph/node'
import type { EdgeData } from '../graph/edge'

/** Top-left corner positions, matching NodeData.x / NodeData.y. */
export type LayoutResult = Map<string, { x: number; y: number }>

/**
 * Hierarchical layout (Sugiyama-style).
 *
 * 1. Assign layers using Kahn's topological sort (longest-path).
 * 2. Order nodes within each layer with the barycenter heuristic
 *    (forward + backward passes) to minimize edge crossings.
 * 3. Place layers left→right; center each layer's column vertically.
 *
 * Cycles are handled gracefully: back-edges are ignored during layer
 * assignment and any cycle-only subgraphs are placed at layer 0.
 */
export function hierarchicalLayout(
  nodes: NodeData[],
  edges: EdgeData[],
  gapX = 100,
  gapY = 60,
): LayoutResult {
  // Child nodes (parentId set) are positioned relative to their parent; skip them.
  const roots = nodes.filter(n => !n.parentId)
  if (roots.length === 0) return new Map()

  const nodeMap = new Map(roots.map(n => [n.id, n]))

  // ── Build adjacency (ignore self-loops and dangling refs) ──────────────
  const outEdges = new Map<string, Set<string>>()
  const inEdges  = new Map<string, Set<string>>()
  for (const n of roots) {
    outEdges.set(n.id, new Set())
    inEdges.set(n.id, new Set())
  }
  for (const e of edges) {
    if (nodeMap.has(e.source) && nodeMap.has(e.target) && e.source !== e.target) {
      outEdges.get(e.source)!.add(e.target)
      inEdges.get(e.target)!.add(e.source)
    }
  }

  // ── Layer assignment: Kahn's topological sort + longest-path ──────────
  const inDegree = new Map<string, number>()
  for (const n of roots) inDegree.set(n.id, inEdges.get(n.id)!.size)

  const layer = new Map<string, number>()
  const queue: string[] = []

  for (const n of roots) {
    if (inDegree.get(n.id) === 0) {
      layer.set(n.id, 0)
      queue.push(n.id)
    }
  }
  // All-cycle graph: pick minimum-in-degree node as root
  if (queue.length === 0) {
    let min = Infinity, root = roots[0]!.id
    for (const n of roots) {
      const d = inDegree.get(n.id)!
      if (d < min) { min = d; root = n.id }
    }
    layer.set(root, 0)
    queue.push(root)
  }

  const remaining = new Map(inDegree)
  let qi = 0
  while (qi < queue.length) {
    const id = queue[qi++]!
    const l  = layer.get(id)!
    for (const tgt of outEdges.get(id)!) {
      // Longest-path: only advance when this gives a deeper layer
      if ((layer.get(tgt) ?? -1) < l + 1) layer.set(tgt, l + 1)
      const rem = remaining.get(tgt)! - 1
      remaining.set(tgt, rem)
      if (rem === 0) queue.push(tgt)
    }
  }
  // Nodes unreachable from roots (pure cycles) land at layer 0
  for (const n of roots) { if (!layer.has(n.id)) layer.set(n.id, 0) }

  // ── Group nodes by layer ────────────────────────────────────────────────
  const maxLayer = Math.max(...layer.values())
  const groups: string[][] = Array.from({ length: maxLayer + 1 }, () => [])
  for (const [id, l] of layer) groups[l]!.push(id)

  // ── Barycenter heuristic (2 forward + 2 backward passes) ───────────────
  const idxIn = (group: string[], id: string): number => {
    const i = group.indexOf(id)
    return i >= 0 ? i : group.length / 2
  }

  for (let pass = 0; pass < 2; pass++) {
    // Forward: sort by avg index of in-neighbors in previous layer
    for (let l = 1; l <= maxLayer; l++) {
      const prev = groups[l - 1]!
      groups[l]!.sort((a, b) => {
        const predA = [...inEdges.get(a)!].filter(s => layer.get(s) === l - 1)
        const predB = [...inEdges.get(b)!].filter(s => layer.get(s) === l - 1)
        const bA = predA.length ? predA.reduce((s, x) => s + idxIn(prev, x), 0) / predA.length : 0
        const bB = predB.length ? predB.reduce((s, x) => s + idxIn(prev, x), 0) / predB.length : 0
        return bA - bB
      })
    }
    // Backward: sort by avg index of out-neighbors in next layer
    for (let l = maxLayer - 1; l >= 0; l--) {
      const next = groups[l + 1]!
      groups[l]!.sort((a, b) => {
        const succA = [...outEdges.get(a)!].filter(t => layer.get(t) === l + 1)
        const succB = [...outEdges.get(b)!].filter(t => layer.get(t) === l + 1)
        const bA = succA.length ? succA.reduce((s, x) => s + idxIn(next, x), 0) / succA.length : 0
        const bB = succB.length ? succB.reduce((s, x) => s + idxIn(next, x), 0) / succB.length : 0
        return bA - bB
      })
    }
  }

  // ── Coordinate assignment ──────────────────────────────────────────────
  // Compute each layer's column height and the global max height (for centering)
  const colHeight: number[] = groups.map(ids =>
    ids.reduce((h, id) => h + (nodeMap.get(id)?.height ?? 60) + gapY, 0) - gapY,
  )
  const maxColHeight = Math.max(...colHeight, 0)

  const result: LayoutResult = new Map()
  let x = 0

  for (let l = 0; l <= maxLayer; l++) {
    const ids   = groups[l]!
    const colW  = Math.max(...ids.map(id => nodeMap.get(id)?.width ?? 120))
    const startY = Math.round((maxColHeight - colHeight[l]!) / 2)
    let y = startY

    for (const id of ids) {
      const n = nodeMap.get(id)!
      result.set(id, { x, y })
      y += n.height + gapY
    }
    x += colW + gapX
  }

  return result
}

/**
 * Spring-force layout (Fruchterman-Reingold approximation).
 * Works with any graph topology; useful when hierarchy is not meaningful.
 */
export function forceLayout(
  nodes: NodeData[],
  edges: EdgeData[],
  iterations = 150,
): LayoutResult {
  const roots = nodes.filter(n => !n.parentId)
  if (roots.length === 0) return new Map()

  type Vec2 = { x: number; y: number }

  const pos = new Map<string, Vec2>()
  for (const n of roots) {
    pos.set(n.id, { x: n.x + n.width / 2, y: n.y + n.height / 2 })
  }

  const k = Math.sqrt(200 * 200 * roots.length) / roots.length * 5
  let temp = k * 2

  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map<string, Vec2>()
    for (const n of roots) disp.set(n.id, { x: 0, y: 0 })

    // Repulsion
    for (let i = 0; i < roots.length; i++) {
      for (let j = i + 1; j < roots.length; j++) {
        const a = roots[i]!, b = roots[j]!
        const pa = pos.get(a.id)!, pb = pos.get(b.id)!
        const dx = pa.x - pb.x, dy = pa.y - pb.y
        const dist = Math.max(Math.hypot(dx, dy), 1)
        const f = k * k / dist
        const da = disp.get(a.id)!, db = disp.get(b.id)!
        da.x += dx / dist * f;  da.y += dy / dist * f
        db.x -= dx / dist * f;  db.y -= dy / dist * f
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const pa = pos.get(edge.source), pb = pos.get(edge.target)
      if (!pa || !pb) continue
      const dx = pb.x - pa.x, dy = pb.y - pa.y
      const dist = Math.max(Math.hypot(dx, dy), 1)
      const f = dist * dist / k
      const da = disp.get(edge.source)!, db = disp.get(edge.target)!
      da.x += dx / dist * f;  da.y += dy / dist * f
      db.x -= dx / dist * f;  db.y -= dy / dist * f
    }

    for (const n of roots) {
      const p = pos.get(n.id)!, d = disp.get(n.id)!
      const dLen = Math.max(Math.hypot(d.x, d.y), 1)
      p.x += d.x / dLen * Math.min(dLen, temp)
      p.y += d.y / dLen * Math.min(dLen, temp)
    }

    temp *= 0.95
  }

  const result: LayoutResult = new Map()
  for (const n of roots) {
    const c = pos.get(n.id)!
    result.set(n.id, { x: c.x - n.width / 2, y: c.y - n.height / 2 })
  }
  return result
}

/**
 * Arrange nodes evenly around a circle.
 * The first node is placed at the top (−π/2) and the rest follow clockwise.
 *
 * @param nodes  Nodes to arrange.
 * @param radius Circle radius in world units. Auto-sized when omitted.
 */
export function circularLayout(nodes: NodeData[], radius?: number): LayoutResult {
  const roots = nodes.filter(n => !n.parentId)
  if (roots.length === 0) return new Map()
  if (roots.length === 1) {
    return new Map([[roots[0]!.id, { x: 0, y: 0 }]])
  }

  const maxDim = Math.max(...roots.map(n => Math.max(n.width, n.height)))
  const r = radius ?? Math.max(150, roots.length * (maxDim / 2 + 20))

  const result: LayoutResult = new Map()
  const step = (2 * Math.PI) / roots.length

  for (let i = 0; i < roots.length; i++) {
    const n     = roots[i]!
    const angle = i * step - Math.PI / 2
    result.set(n.id, {
      x: Math.round(r * Math.cos(angle) - n.width  / 2),
      y: Math.round(r * Math.sin(angle) - n.height / 2),
    })
  }
  return result
}

/**
 * Arrange nodes in a uniform grid, sorted by current x position.
 */
export function gridLayout(nodes: NodeData[], gap = 40): LayoutResult {
  const roots = nodes.filter(n => !n.parentId)
  if (roots.length === 0) return new Map()

  const cols   = Math.ceil(Math.sqrt(roots.length))
  const sorted = [...roots].sort((a, b) => a.x - b.x || a.y - b.y)
  const cellW  = Math.max(...roots.map(n => n.width),  120) + gap
  const cellH  = Math.max(...roots.map(n => n.height),  60) + gap

  const result: LayoutResult = new Map()
  sorted.forEach((n, i) => {
    result.set(n.id, {
      x: (i % cols) * cellW,
      y: Math.floor(i / cols) * cellH,
    })
  })
  return result
}
