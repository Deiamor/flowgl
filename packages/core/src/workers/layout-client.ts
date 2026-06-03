import type {
  LayoutAlgorithm,
  LayoutWorkerRequest,
  LayoutWorkerResponse,
} from './layout-worker'
import type { NodeData } from '../graph/node'
import type { EdgeData } from '../graph/edge'

export type { LayoutAlgorithm }

let nextId = 0

interface Pending {
  resolve: (result: { id: string; x: number; y: number }[]) => void
  reject:  (err: Error) => void
}

/**
 * Thin client that proxies layout computation to a Web Worker.
 *
 * Usage (Vite / bundler with `?worker` support):
 * ```ts
 * import Worker from '@flowgl/core/layout-worker?worker'
 * const client = new LayoutWorkerClient(new Worker())
 * const positions = await client.runLayout('hierarchical', nodes, edges)
 * chart.animateLayout(positions)
 * client.dispose()
 * ```
 *
 * Without a bundler, pass a Worker created from the bundled output URL.
 */
export class LayoutWorkerClient {
  private worker: Worker
  private pending = new Map<number, Pending>()

  constructor(worker: Worker) {
    this.worker = worker
    this.worker.addEventListener('message', this.handleMessage.bind(this))
  }

  runLayout(
    algorithm: LayoutAlgorithm,
    nodes:     NodeData[],
    edges:     EdgeData[],
    options:   { gapX?: number; gapY?: number; gap?: number; iterations?: number } = {},
  ): Promise<{ id: string; x: number; y: number }[]> {
    return new Promise((resolve, reject) => {
      const id = nextId++
      this.pending.set(id, { resolve, reject })
      const msg: LayoutWorkerRequest = { id, algorithm, nodes, edges, ...options }
      this.worker.postMessage(msg)
    })
  }

  dispose(): void {
    this.worker.terminate()
    for (const { reject } of this.pending.values()) {
      reject(new Error('LayoutWorkerClient disposed'))
    }
    this.pending.clear()
  }

  private handleMessage(e: MessageEvent<LayoutWorkerResponse>): void {
    const { id, result, error } = e.data
    const p = this.pending.get(id)
    if (!p) return
    this.pending.delete(id)
    if (error) p.reject(new Error(error))
    else p.resolve(result)
  }
}
