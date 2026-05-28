export declare class DynamicBuffer {
    readonly buffer: WebGLBuffer;
    private gl;
    private capacityBytes;
    constructor(gl: WebGL2RenderingContext, initialBytes?: number);
    upload(data: Float32Array): void;
    dispose(): void;
}
//# sourceMappingURL=dynamic-buffer.d.ts.map