import type { LayoutAlgorithm } from './layout-worker';
import type { NodeData } from '../graph/node';
import type { EdgeData } from '../graph/edge';
export type { LayoutAlgorithm };
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
export declare class LayoutWorkerClient {
    private worker;
    private pending;
    constructor(worker: Worker);
    runLayout(algorithm: LayoutAlgorithm, nodes: NodeData[], edges: EdgeData[], options?: {
        gapX?: number;
        gapY?: number;
        gap?: number;
        iterations?: number;
    }): Promise<{
        id: string;
        x: number;
        y: number;
    }[]>;
    dispose(): void;
    private handleMessage;
}
//# sourceMappingURL=layout-client.d.ts.map