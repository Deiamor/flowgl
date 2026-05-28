export type EdgeType = 'bezier' | 'straight' | 'step';
export interface EdgeStyle {
    color: string;
    width: number;
    dashArray?: [number, number];
}
export interface EdgeData {
    id: string;
    source: string;
    target: string;
    sourceHandle?: 'top' | 'right' | 'bottom' | 'left';
    targetHandle?: 'top' | 'right' | 'bottom' | 'left';
    type?: EdgeType;
    label?: string;
    style?: Partial<EdgeStyle>;
    data?: Record<string, unknown>;
}
export declare const DEFAULT_EDGE_STYLE: EdgeStyle;
//# sourceMappingURL=edge.d.ts.map