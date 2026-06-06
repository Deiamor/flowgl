import type { NodeData } from '../graph/node';
import type { Viewport } from '../viewport/viewport';
export declare class HtmlOverlay {
    private container;
    private entries;
    constructor(parent: HTMLElement);
    sync(nodes: NodeData[], viewport: Viewport): void;
    dispose(): void;
}
//# sourceMappingURL=html-overlay.d.ts.map