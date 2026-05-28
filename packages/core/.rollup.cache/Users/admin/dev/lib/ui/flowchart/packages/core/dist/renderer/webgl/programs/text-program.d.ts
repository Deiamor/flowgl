import type { TextAtlas } from '../atlas/text-atlas';
import type { NodeData } from '../../../graph/node';
export declare class TextProgram {
    private gl;
    private program;
    private vao;
    private vertexBuffer;
    private atlas;
    private uMatrix;
    private uAtlas;
    constructor(gl: WebGL2RenderingContext, atlas: TextAtlas);
    render(nodes: NodeData[], matrix: Float32Array): void;
    dispose(): void;
}
//# sourceMappingURL=text-program.d.ts.map