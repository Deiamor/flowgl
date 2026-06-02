/**
 * Web Worker entry point for layout computation.
 * Runs hierarchicalLayout / forceLayout / gridLayout off the main thread.
 *
 * Bundlers that support the `?worker` import syntax (Vite, esbuild) can
 * import this file directly. Alternatively, consumers can inline the URL
 * via `URL.createObjectURL(new Blob([...], { type: 'text/javascript' }))`.
 */
import { hierarchicalLayout, forceLayout, gridLayout } from '../layout/auto-layout'
import type { NodeData } from '../graph/node'
import type { EdgeData } from '../graph/edge'

export type LayoutAlgorithm = 'hierarchical' | 'force' | 'grid'

export interface LayoutWorkerRequest {
  id:        number
  algorithm: LayoutAlgorithm
  nodes:     NodeData[]
  edges:     EdgeData[]
  gapX?:     number
  gapY?:     number
  gap?:      number
  iterations?: number
}

export interface LayoutWorkerResponse {
  id:      number
  result:  { id: string; x: number; y: number }[]
  error?:  string
}

self.addEventListener('message', (e: MessageEvent<LayoutWorkerRequest>) => {
  const { id, algorithm, nodes, edges, gapX, gapY, gap, iterations } = e.data
  try {
    let layoutMap: Map<string, { x: number; y: number }>
    switch (algorithm) {
      case 'force':
        layoutMap = forceLayout(nodes, edges, iterations ?? 300)
        break
      case 'grid':
        layoutMap = gridLayout(nodes, gap ?? 40)
        break
      default:
        layoutMap = hierarchicalLayout(nodes, edges, gapX ?? 100, gapY ?? 60)
    }
    const result: { id: string; x: number; y: number }[] = []
    for (const [nodeId, pos] of layoutMap) result.push({ id: nodeId, ...pos })
    const response: LayoutWorkerResponse = { id, result }
    self.postMessage(response)
  } catch (err) {
    const response: LayoutWorkerResponse = { id, result: [], error: String(err) }
    self.postMessage(response)
  }
})
