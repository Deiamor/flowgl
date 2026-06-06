import type { EdgeData } from '../../../graph/edge';
import type { NodeData } from '../../../graph/node';
export declare class EdgeProgram {
    private gl;
    private program;
    private vao;
    private vertexBuffer;
    private colorCache;
    private stripCache;
    private prevValidIds;
    private prevCombinedFloats;
    private drawBatches;
    private scratch;
    private uMatrix;
    private uDashed;
    private uDashLen;
    private uGapLen;
    private uDashOffset;
    constructor(gl: WebGL2RenderingContext);
    render(edges: EdgeData[], nodeMap: Map<string, NodeData>, matrix: Float32Array, selectedEdgeIds?: Set<string>, dashOffset?: number): void;
    dispose(): void;
}
//# sourceMappingURL=edge-program.d.ts.map