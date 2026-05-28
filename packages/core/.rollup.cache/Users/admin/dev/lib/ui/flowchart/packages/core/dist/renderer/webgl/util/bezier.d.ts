export declare const EDGE_FLOATS_PER_VERT = 7;
export declare const BEZIER_SEGMENTS = 32;
/**
 * Compute cubic bezier control points that respect handle exit/entry directions.
 *
 * Each handle side defines the direction the curve leaves (source) or enters (target):
 *   right  → exits/enters rightward  (+x)
 *   left   → exits/enters leftward   (-x)
 *   bottom → exits/enters downward   (+y)
 *   top    → exits/enters upward     (-y)
 *
 * Magnitude is clamped to [50, 150] world units so short connections always
 * produce a visible arc even when the two endpoints are very close.
 */
export declare function edgeControlPoints(sx: number, sy: number, sourceHandle: string | undefined, ex: number, ey: number, targetHandle: string | undefined): [number, number, number, number];
export declare function cubicBezierPoint(t: number, p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number): [number, number];
export declare function buildBezierStrip(sx: number, sy: number, c1x: number, c1y: number, c2x: number, c2y: number, ex: number, ey: number, r: number, g: number, b: number, a: number, halfWidth: number, segments?: number): Float32Array;
//# sourceMappingURL=bezier.d.ts.map