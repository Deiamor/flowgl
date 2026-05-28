interface AtlasEntry {
    u0: number;
    v0: number;
    u1: number;
    v1: number;
    w: number;
    h: number;
}
export declare class TextAtlas {
    private readonly offscreen;
    private readonly ctx;
    private readonly entries;
    private texture;
    private shelfX;
    private shelfY;
    private shelfH;
    dirty: boolean;
    constructor();
    private key;
    getOrCreate(text: string, font: string, color: string): AtlasEntry | null;
    flush(gl: WebGL2RenderingContext): void;
    bind(gl: WebGL2RenderingContext, unit: number): void;
    dispose(gl: WebGL2RenderingContext): void;
}
export {};
//# sourceMappingURL=text-atlas.d.ts.map