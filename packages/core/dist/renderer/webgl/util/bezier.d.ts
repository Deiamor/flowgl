export declare const EDGE_FLOATS_PER_VERT = 7;
export declare const BEZIER_SEGMENTS = 32;
/**
 * Compute waypoints for an orthogonal (step) edge.
 * The path exits source in the handle direction, turns 90°, and enters target
 * from the opposite of targetHandle's direction.
 */
export declare function stepWaypoints(sx: number, sy: number, sourceHandle: string | undefined, ex: number, ey: number, targetHandle: string | undefined): [number, number][];
/**
 * Build a triangle strip for a straight line between two points.
 */
export declare function buildStraightStrip(sx: number, sy: number, ex: number, ey: number, r: number, g: number, b: number, a: number, halfWidth: number): Float32Array;
/**
 * Build a triangle strip for a polyline (step/orthogonal routing).
 * Miters corners by computing per-vertex normals from adjacent segments.
 */
export declare function buildPolylineStrip(pts: [number, number][], r: number, g: number, b: number, a: number, halfWidth: number): Float32Array;
/**
 * Compute cubic bezier control points that respect handle exit/entry directions.
 *
 * Uses axis-aware magnitude with a "backwards boost": when the target lies
 * behind the source handle's exit direction, the control offset is increased
 * using the cross-axis distance so the inflection point moves away from t≈0/1
 * and the curve looks like a clean U-arc instead of a tight S.
 */
export declare function edgeControlPoints(sx: number, sy: number, sourceHandle: string | undefined, ex: number, ey: number, targetHandle: string | undefined): [number, number, number, number];
export declare function cubicBezierPoint(t: number, p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number): [number, number];
export declare function buildBezierStrip(sx: number, sy: number, c1x: number, c1y: number, c2x: number, c2y: number, ex: number, ey: number, r: number, g: number, b: number, a: number, halfWidth: number, segments?: number): Float32Array;
//# sourceMappingURL=bezier.d.ts.map