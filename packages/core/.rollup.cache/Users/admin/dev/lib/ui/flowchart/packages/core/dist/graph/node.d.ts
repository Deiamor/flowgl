export interface NodeStyle {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    textColor: string;
    fontSize: number;
    fontFamily: string;
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
}
export declare const DEFAULT_NODE_STYLE: NodeStyle;
//# sourceMappingURL=node.d.ts.map