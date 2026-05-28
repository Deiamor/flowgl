import type { NodeData } from '../graph/node';
import type { Viewport } from '../viewport/viewport';
export declare class LabelEditor {
    private input;
    private boundBlur;
    startEdit(node: NodeData, canvas: HTMLCanvasElement, viewport: Viewport, onDone: (newLabel: string) => void): void;
    stopEdit(): void;
    dispose(): void;
}
//# sourceMappingURL=label-edit.d.ts.map