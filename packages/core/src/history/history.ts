import type { NodeData } from '../graph/node'
import type { EdgeData } from '../graph/edge'

export interface Snapshot {
  nodes: NodeData[]
  edges: EdgeData[]
}

/** Snapshot-based undo/redo history. */
export class History {
  private past:   Snapshot[] = []
  private future: Snapshot[] = []

  constructor(private readonly limit = 100) {}

  /** Capture the current state before a mutation. */
  save(snapshot: Snapshot): void {
    this.past.push(snapshot)
    this.future = []
    if (this.past.length > this.limit) this.past.shift()
  }

  /** Restore the previous state. Returns the snapshot to apply, or null if none. */
  undo(current: Snapshot): Snapshot | null {
    if (!this.past.length) return null
    this.future.push(current)
    if (this.future.length > this.limit) this.future.shift()
    return this.past.pop()!
  }

  /** Re-apply a previously undone state. Returns the snapshot to apply, or null if none. */
  redo(current: Snapshot): Snapshot | null {
    if (!this.future.length) return null
    this.past.push(current)
    return this.future.pop()!
  }

  canUndo(): boolean { return this.past.length > 0 }
  canRedo(): boolean { return this.future.length > 0 }

  clear(): void { this.past = []; this.future = [] }
}
