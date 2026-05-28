import type { Graph } from '../graph/graph';
import type { EdgeData } from '../graph/edge';
import type { GridConfig } from '../types';
export interface PanelDeps {
    graph: Graph;
    contextMenu: {
        hide(): void;
    };
    scheduleRender(): void;
    beforeMutation(): void;
    getBackground(): string;
    setBackground(color: string): void;
    getGridConfig(): GridConfig;
    setGrid(config: Partial<GridConfig>): void;
}
export declare class ContextPanels {
    private readonly deps;
    constructor(deps: PanelDeps);
    edgeStyle(edge: EdgeData): HTMLElement;
    background(): HTMLElement;
    grid(): HTMLElement;
    autoLayout(): HTMLElement;
}
//# sourceMappingURL=context-panels.d.ts.map