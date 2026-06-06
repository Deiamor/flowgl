export type NodeShape = 'rectangle' | 'circle' | 'diamond' | 'hexagon';
export type NodeStatus = 'error' | 'warning' | 'success' | 'info';
/** A named connection point on a node boundary. */
export interface PortDef {
    id: string;
    side: 'left' | 'right' | 'top' | 'bottom';
    /** 0–1 position along the side. 0 = start (top or left), 1 = end (bottom or right). Default: 0.5 */
    offset?: number;
    label?: string;
    /** Maximum number of edges allowed on this port. Unlimited when absent. */
    maxConnections?: number;
}
export interface NodeStyle {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    textColor: string;
    fontSize: number;
    fontFamily: string;
    textAlign: 'left' | 'center' | 'right';
    lineHeight: number;
    /** Node geometry. Default: 'rectangle'. */
    shape: NodeShape;
}
export interface NodeData {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    type?: string;
    /** When set, this node is a child of the given group node. */
    parentId?: string;
    /** When true, the group node is collapsed (children hidden). */
    collapsed?: boolean;
    /** When true, the node cannot be dragged or resized. */
    locked?: boolean;
    style?: Partial<NodeStyle>;
    ports?: PortDef[];
    data?: Record<string, unknown>;
    /**
     * Raw HTML rendered inside an overlay div positioned over the node.
     * When set, the WebGL text label is suppressed; the HTML provides content.
     */
    htmlContent?: string;
    /** Text shown in a floating tooltip when hovering over the node. */
    tooltip?: string;
    /** Visual status indicator badge rendered at the node's top-right corner. */
    status?: NodeStatus;
}
export declare const DEFAULT_NODE_STYLE: NodeStyle;
export declare function shapeToFloat(shape: NodeShape | undefined): number;
//# sourceMappingURL=node.d.ts.map