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
    sourceHandle?: 'top' | 'right' | 'bottom' | 'left' | (string & {});
    targetHandle?: 'top' | 'right' | 'bottom' | 'left' | (string & {});
    type?: EdgeType;
    label?: string;
    style?: Partial<EdgeStyle>;
    data?: Record<string, unknown>;
    /** Intermediate world-space control points. When present, overrides auto bezier routing. */
    waypoints?: {
        x: number;
        y: number;
    }[];
    /** When true, the edge renders as marching-ants (animated dashes). */
    animated?: boolean;
}
export declare const DEFAULT_EDGE_STYLE: EdgeStyle;
//# sourceMappingURL=edge.d.ts.map