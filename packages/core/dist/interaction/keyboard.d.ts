export interface KeyboardOptions {
    onDelete: () => void;
    onEscape: () => void;
    onSelectAll: () => void;
    onUndo: () => void;
    onRedo: () => void;
}
export declare class KeyboardHandler {
    private readonly canvas;
    private readonly onKeyDown;
    constructor(canvas: HTMLElement, opts: KeyboardOptions);
    dispose(): void;
}
//# sourceMappingURL=keyboard.d.ts.map