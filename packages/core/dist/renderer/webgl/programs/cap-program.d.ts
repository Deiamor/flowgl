import type { EdgeData } from '../../../graph/edge';
import type { NodeData } from '../../../graph/node';
export declare class CapProgram {
    private gl;
    private program;
    private vao;
    private buf;
    private uMatrix;
    private colorCache;
    constructor(gl: WebGL2RenderingContext);
    render(edges: EdgeData[], nodeMap: Map<string, NodeData>, matrix: Float32Array, selectedEdgeIds: Set<string>, pixelsPerUnit: number): void;
    dispose(): void;
}
//# sourceMappingURL=cap-program.d.ts.map