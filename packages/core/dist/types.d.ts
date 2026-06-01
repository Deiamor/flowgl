export interface GridConfig {
    visible: boolean;
    /** World-space cell size. Renderer auto-scales for zoom density. */
    size: number;
    type: 'dots' | 'lines';
    color: string;
}
export declare const DEFAULT_GRID_CONFIG: GridConfig;
export interface MinimapConfig {
    /** Minimap panel width in px. Default: 200. */
    width: number;
    /** Minimap panel height in px. Default: 150. */
    height: number;
    /** Corner to anchor the minimap. Default: 'bottom-right'. */
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** Panel background. Default: 'rgba(255,255,255,0.92)'. */
    background: string;
    /** Fallback node fill when node has no backgroundColor. Default: '#94a3b8'. */
    nodeColor: string;
}
export declare const DEFAULT_MINIMAP_CONFIG: MinimapConfig;
//# sourceMappingURL=types.d.ts.map