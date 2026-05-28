# SPEC_CHECKLIST.md

## Phase 1 MVP

### Rendering
- [x] Nodes render as rounded rectangles with border
- [x] Node color, border color, border radius configurable per node
- [x] Edges render as smooth bezier curves
- [x] Edge width configurable per edge
- [x] Node labels render centered inside node
- [x] Text legible at zoom 1x
- [x] All renders complete in single rAF callback (no partial frames)
- [x] Edge labels render at bezier midpoint with white background
- [x] Grid background rendered via grid-program
- [x] Connection handles rendered via handle-program

### Performance
- [x] Off-screen nodes are culled before upload (frustum culling)
- [x] TextAtlas 2-pass render prevents mid-frame atlas eviction flicker
- [ ] 1,000 nodes @ 60fps (not benchmarked)
- [ ] 10,000 nodes @ 30fps (not benchmarked)

### Viewport
- [x] Mouse wheel zoom centered on cursor
- [x] Mouse drag pans the canvas
- [x] Pinch-to-zoom works on touch devices
- [x] fitView() frames all nodes with padding
- [x] Zoom clamped to [0.1, 4]

### Interaction
- [x] Click on node fires nodeClick event (via granular events)
- [x] Drag node updates position in Graph and re-renders (mouse + touch)
- [x] nodeDragEnd event fires with final position
- [x] Clicking empty space fires paneClick event
- [x] Multi-select via Cmd+click
- [x] Box select (rubber-band drag on empty canvas)
- [x] ConnectDrag: handle drag → edge connection (mouse + touch)
- [x] Inline label editing on double-click
- [x] Right-click context menu
- [x] Edge rerouting (control point drag)

### Keyboard
- [x] Delete/Backspace removes selected nodes/edges
- [x] Escape clears selection
- [x] Cmd+A selects all nodes
- [x] Cmd+Z undo / Cmd+Shift+Z redo
- [x] Tab / Shift+Tab cycles through nodes
- [x] Arrow keys move selected nodes (10px step, 400ms debounce)

### API
- [x] addNode / removeNode / updateNode work and trigger re-render
- [x] addEdge / removeEdge work and trigger re-render
- [x] setNodes / setEdges batch replace
- [x] toJSON() / fromJSON() serialization roundtrip
- [x] fitView() frames all nodes
- [x] canUndo() / canRedo() / undo() / redo()
- [x] getSelectedIds() / getSelectedEdgeIds()
- [x] on() / off() event subscription
- [x] dispose() tears down WebGL context, removes canvas, unbinds all events

### Events
- [x] nodeAdd — fires with node data
- [x] nodeRemove — fires with node id
- [x] nodeUpdate — fires with updated node data
- [x] edgeAdd — fires with edge data
- [x] edgeRemove — fires with edge id
- [x] historyChange — fires with { canUndo, canRedo }
- [x] connect — fires with (sourceId, targetId, sourceHandle, targetHandle)

### Accessibility
- [x] aria-live region announces focused node label on Tab navigation
- [x] SSR-safe (no crash when window/document undefined)

### Build & Distribution
- [x] Production build obfuscated (javascript-obfuscator)
- [x] Development build readable with sourcemaps
- [x] TypeScript declarations emitted to dist/
- [x] package.json files field restricts publish to dist/ + README.md
- [x] prepublishOnly gate: typecheck → test → build

### Tests
- [x] 127 tests across 10 files (vitest + happy-dom)
- [x] FlowChart graceful degradation (WebGL unavailable)
- [x] ConnectDrag mouse + touch
- [x] PanZoom mouse + touch
- [x] NodeDrag mouse + touch
- [x] KeyboardHandler all shortcuts
- [x] BoxSelect
- [x] Graph data operations
- [x] History undo/redo
- [x] Layout algorithms
- [x] Viewport math
