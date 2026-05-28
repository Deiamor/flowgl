import type { ConnectState } from '../../../interaction/connect';
import type { NodeData } from '../../../graph/node';
import type { RerouteState, EndpointCircle } from '../../../interaction/edge-reroute';
export declare class HandleProgram {
    private gl;
    private circleProgram;
    private circleVao;
    private quadBuffer;
    private circleBuffer;
    private uCircleMatrix;
    private edgeProgram;
    private edgeVao;
    private edgeBuffer;
    private uEdgeMatrix;
    private uDashLen;
    private uGapLen;
    constructor(gl: WebGL2RenderingContext);
    render(connectState: ConnectState | null, nodeMap: Map<string, NodeData>, matrix: Float32Array, zoom: number, rerouteState?: RerouteState | null, endpointCircles?: EndpointCircle[]): void;
    private renderHandles;
    private renderPendingEdge;
    private renderEndpointCircles;
    private renderRerouteEdge;
    dispose(): void;
}
//# sourceMappingURL=handle-program.d.ts.map