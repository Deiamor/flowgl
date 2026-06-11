import type { Graph } from '../graph/graph'

interface AnimState {
  targets: Map<string, { fx: number; fy: number; tx: number; ty: number }>
  start: number
  dur:   number
}

/**
 * Drive a smoothstep-interpolated x/y animation toward a target layout.
 *
 * Lives outside `FlowChart` so the animation lifecycle (cancel on dispose, no
 * RAF leak) can be tested in isolation. The caller wires in `Graph` access and
 * a render callback.
 */
export class LayoutAnimator {
  private graph: Graph
  private scheduleRender: () => void
  private state: AnimState | null = null
  private rafId: number | null = null

  constructor(graph: Graph, scheduleRender: () => void) {
    this.graph = graph
    this.scheduleRender = scheduleRender
  }

  /**
   * Animate the given nodes to the target positions over `duration` ms.
   * If the target is a group parent, its descendant nodes are translated by
   * the same delta unless they already have an explicit target.
   */
  animate(
    targets: { id: string; x: number; y: number }[] | Map<string, { x: number; y: number }>,
    duration = 400,
  ): void {
    this.cancel()

    const entries: [string, { x: number; y: number }][] = targets instanceof Map
      ? [...targets.entries()]
      : targets.map(({ id, x, y }) => [id, { x, y }])

    const all = new Map<string, { x: number; y: number }>(entries)
    for (const [id, pos] of entries) {
      const parent = this.graph.getNode(id)
      if (!parent) continue
      const dx = pos.x - parent.x
      const dy = pos.y - parent.y
      for (const child of this.graph.getNodes().filter(n => n.parentId === id)) {
        if (!all.has(child.id)) {
          all.set(child.id, { x: child.x + dx, y: child.y + dy })
        }
      }
    }

    const map = new Map<string, { fx: number; fy: number; tx: number; ty: number }>()
    for (const [id, { x, y }] of all) {
      const node = this.graph.getNode(id)
      if (!node) continue
      map.set(id, { fx: node.x, fy: node.y, tx: x, ty: y })
    }
    if (map.size === 0) return

    this.state = { targets: map, start: performance.now(), dur: duration }
    this.tick()
  }

  /** Stop any in-flight animation. Safe to call when no animation is running. */
  cancel(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.state = null
  }

  dispose(): void { this.cancel() }

  private tick(): void {
    if (!this.state) return
    const { targets, start, dur } = this.state
    const elapsed = performance.now() - start
    const raw = Math.min(elapsed / dur, 1)
    const t = raw * raw * (3 - 2 * raw)   // smoothstep

    for (const [id, { fx, fy, tx, ty }] of targets) {
      this.graph.updateNode(id, {
        x: fx + (tx - fx) * t,
        y: fy + (ty - fy) * t,
      })
    }
    this.scheduleRender()

    if (raw < 1) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null
        this.tick()
      })
    } else {
      this.state = null
    }
  }
}
