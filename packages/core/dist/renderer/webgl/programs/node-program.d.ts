import type { NodeData } from '../../../graph/node';
export declare class NodeProgram {
    private gl;
    private program;
    private vao;
    private quadBuffer;
    private instanceBuffer;
    private uMatrix;
    private scratch;
    private prevNodes;
    private prevSelectedSize;
    private prevSelectedJoined;
    private prevTargetNodeId;
    private prevInstanceCount;
    constructor(gl: WebGL2RenderingContext);
    render(nodes: NodeData[], matrix: Float32Array, selectedIds: Set<string>, targetNodeId: string | null): void;
    dispose(): void;
}
//# sourceMappingURL=node-program.d.ts.map