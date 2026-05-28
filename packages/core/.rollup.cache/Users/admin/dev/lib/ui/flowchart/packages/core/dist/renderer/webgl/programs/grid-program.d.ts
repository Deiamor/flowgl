import type { Viewport } from '../../../viewport/viewport';
export declare class GridProgram {
    private gl;
    private program;
    private vao;
    private quadBuf;
    private uSize;
    private uZoom;
    private uViewX;
    private uViewY;
    private uGridSize;
    private uColor;
    private uDots;
    constructor(gl: WebGL2RenderingContext);
    render(viewport: Viewport, gridSize: number, type: 'dots' | 'lines', colorStr: string): void;
    dispose(): void;
}
//# sourceMappingURL=grid-program.d.ts.map