export type NodeShape = 'rectangle' | 'circle' | 'diamond' | 'hexagon';
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
    style?: Partial<NodeStyle>;
    data?: Record<string, unknown>;
    /**
     * Raw HTML rendered inside an overlay div positioned over the node.
     * When set, the WebGL text label is suppressed; the HTML provides content.
     */
    htmlContent?: string;
}
export declare const DEFAULT_NODE_STYLE: NodeStyle;
export declare function shapeToFloat(shape: NodeShape | undefined): number;
//# sourceMappingURL=node.d.ts.map