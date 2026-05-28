# SPEC_CHECKLIST.md

## Phase 1 MVP Checklist

### Rendering
- [ ] Nodes render as rounded rectangles with border
- [ ] Node color, border color, border radius configurable per node
- [ ] Edges render as smooth bezier curves
- [ ] Edge width configurable per edge
- [ ] Node labels render centered inside node
- [ ] Text legible at zoom 1x
- [ ] All renders complete in single rAF callback (no partial frames)

### Performance
- [ ] 1,000 nodes render at 60 fps
- [ ] 10,000 nodes render at 30+ fps
- [ ] Only dirty nodes/edges trigger re-upload (incremental VBO update)
- [ ] Off-screen nodes are culled before upload

### Viewport
- [ ] Mouse wheel zoom centered on cursor
- [ ] Mouse drag pans the canvas
- [ ] Pinch-to-zoom works on touch devices
- [ ] fitView() frames all nodes with padding
- [ ] Zoom clamped to [0.1, 4]

### Interaction
- [ ] Click on node fires `nodeClick` event
- [ ] Drag node updates position in Graph and re-renders
- [ ] `nodeDragEnd` event fires with final position
- [ ] Clicking empty space fires `paneClick` event

### API
- [ ] addNode / removeNode / updateNode work and trigger re-render
- [ ] addEdge / removeEdge work and trigger re-render
- [ ] setViewport / getViewport roundtrip
- [ ] dispose() tears down WebGL context, removes canvas, unbinds all events

### WebGL
- [ ] WebGL2 context created successfully
- [ ] Graceful error thrown when WebGL2 unavailable
- [ ] DPR applied (canvas physicalSize = cssSize × devicePixelRatio)
- [ ] resize() updates canvas size and viewport
