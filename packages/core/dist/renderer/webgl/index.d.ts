import type { Renderer, RendererOptions } from '../interface';
import type { Graph } from '../../graph/graph';
import type { Viewport } from '../../viewport/viewport';
import type { ConnectState } from '../../interaction/connect';
import type { RerouteState, EndpointCircle } from '../../interaction/edge-reroute';
import type { GridConfig } from '../../types';
export declare class WebGL2Renderer implements Renderer {
    private gl;
    private nodeProgram;
    private edgeProgram;
    private textProgram;
    private handleProgram;
    private gridProgram;
    private atlas;
    private dpr;
    private cachedGraphVersion;
    private cachedVpX;
    private cachedVpY;
    private cachedVpZoom;
    private cachedVpWidth;
    private cachedVpHeight;
    private cachedAllNodes;
    private cachedNodeMap;
    private cachedAllEdges;
    private cachedVisNodes;
    private cachedVisEdges;
    initialize(canvas: HTMLCanvasElement, options?: RendererOptions): boolean;
    resize(width: number, height: number): void;
    render(graph: Graph, viewport: Viewport, selectedIds?: Set<string>, connectState?: ConnectState | null, selectedEdgeIds?: Set<string>, bgColor?: string, grid?: GridConfig | null, rerouteState?: RerouteState | null, endpointCircles?: EndpointCircle[]): void;
    dispose(): void;
}
//# sourceMappingURL=index.d.ts.map