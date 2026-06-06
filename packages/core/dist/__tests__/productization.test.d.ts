/**
 * Productization validation tests — covers all items fixed in the production readiness pass.
 *
 * Scenarios:
 * 1. TextAtlas cache key includes color → no cross-node color bleed
 * 2. exportSVG hexagon shape → correct polygon points
 * 3. exportSVG all shapes round-trip correctly
 * 4. onContextLost / onContextRestored options are present in FlowChartOptions
 * 5. README package name consistency (via package.json verification)
 * 6. Framework wrapper event completeness (react/vue prop list)
 * 7. FlowChart onContextLost/onContextRestored options accepted without error
 * 8. TextAtlas DPR constructor parameter
 * 9. Multiple edge-case SVG scenarios (empty graph, single node, escaped chars)
 * 10. exportSVG step-edge type
 */
export {};
//# sourceMappingURL=productization.test.d.ts.map