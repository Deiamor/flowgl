import type { TextAtlas } from '../atlas/text-atlas';
import type { NodeData } from '../../../graph/node';
import type { EdgeData } from '../../../graph/edge';
export declare class TextProgram {
    private gl;
    private program;
    private vao;
    private vertexBuffer;
    private atlas;
    private uMatrix;
    private uAtlas;
    private quadCache;
    private prevNodeIds;
    private prevAtlasGeneration;
    private scratch;
    private prevNodeDrawCount;
    private nodeRefCache;
    private edgeLabelCache;
    private prevLabeledEdgeIds;
    private prevLabelAtlasGeneration;
    private labelScratch;
    constructor(gl: WebGL2RenderingContext, atlas: TextAtlas);
    render(nodes: NodeData[], matrix: Float32Array, zoom: number): void;
    renderEdgeLabels(edges: EdgeData[], nodeMap: Map<string, NodeData>, matrix: Float32Array, zoom: number): void;
    dispose(): void;
}
//# sourceMappingURL=text-program.d.ts.map