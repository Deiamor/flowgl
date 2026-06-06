import type { NodeData } from '../graph/node';
import type { EdgeData } from '../graph/edge';
import type { Viewport } from '../viewport/viewport';
import type { MinimapConfig } from '../types';
export declare class Minimap {
    private canvas;
    private ctx;
    private config;
    private scale;
    private mapOffX;
    private mapOffY;
    private boundsMinX;
    private boundsMinY;
    private hasContent;
    private dragging;
    private onNavigate;
    private readonly onMouseDown;
    private readonly onMouseMove;
    private readonly onMouseUp;
    constructor(container: HTMLElement, config: Partial<MinimapConfig>, onNavigate: (wx: number, wy: number) => void);
    private positionStyle;
    private navigate;
    render(nodes: NodeData[], edges: EdgeData[], viewport: Viewport): void;
    setConfig(patch: Partial<MinimapConfig>): void;
    dispose(): void;
}
//# sourceMappingURL=minimap.d.ts.map