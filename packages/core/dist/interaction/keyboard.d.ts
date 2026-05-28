type ArrowDirection = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
export interface KeyboardOptions {
    onDelete: () => void;
    onEscape: () => void;
    onSelectAll: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onTabNext: () => void;
    onTabPrev: () => void;
    onArrowKey: (direction: ArrowDirection) => void;
}
export declare class KeyboardHandler {
    private readonly canvas;
    private readonly onKeyDown;
    constructor(canvas: HTMLElement, opts: KeyboardOptions);
    dispose(): void;
}
export {};
//# sourceMappingURL=keyboard.d.ts.map