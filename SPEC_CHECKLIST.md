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
- [x] 1,000 nodes @ 60fps (benchmark: 120fps SwiftShader headless)
- [x] 5,000 nodes @ 60fps (benchmark: 113.6fps SwiftShader headless)
- [x] 10,000 nodes @ 30fps (benchmark: 114.1fps SwiftShader headless)

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

---

## Phase 2 Extended API (Stage 9-12)

### Events & Viewport
- [x] nodeDoubleClick / edgeDoubleClick / edgeClick 이벤트
- [x] nodeDragStart 이벤트
- [x] edgeUpdate 이벤트 (updateEdge 시 emit)
- [x] nodeResize 이벤트 (NodeResize onResizeEnd 콜백)
- [x] nodeHover / edgeHover 이벤트 (mousemove, null로 나갈 때도 emit)
- [x] zoomIn / zoomOut / zoomTo (ZOOM_STEPS=[0.1,0.25,0.5,0.75,1,1.25,1.5,2,3,4])
- [x] fitViewToSelection
- [x] panTo(worldX, worldY) — 캔버스 중심 기준 이동
- [x] getNodesBounds(ids?) — AABB 반환, 빈 경우 null
- [x] scrollToNode(id, padding)

### Style & Appearance
- [x] setNodeShape(id, shape) — rectangle/circle/diamond/hexagon
- [x] setEdgeStyle(id, style) — style 병합
- [x] setTheme('light'|'dark') — 배경색 + 그리드 색 프리셋
- [x] animated edge — EdgeData.animated 플래그, dashOffset RAF 루프, 스냅샷 정지

### Node Status Badges
- [x] NodeData.status?: NodeStatus('error'|'warning'|'success'|'info')
- [x] setNodeStatus(id, status|null) — null 시 replaceNode로 optional field 삭제
- [x] 2D canvas overlay (z-index:2) — 우상단 r=7 색상 원형, 흰색 테두리 2px
- [x] renderStatusBadges() — 뷰포트 변환 → 스크린 좌표 계산

### History & Batch
- [x] clearHistory() — history.clear() + historyChange emit
- [x] batchUpdate(fn) — batching/batchMutSaved 플래그, 단일 히스토리 엔트리
- [x] undo/redo 일관성 — 공개 mutation API 전체(setNodeStyle/Size/lock/collapse/group/updateNode/updateEdge/setEdges/alignNodes 등) beforeMutation() 보장
- [x] ungroupNodes() — replaceNode 패턴으로 parentId 제거

### Search & Highlight
- [x] searchNodes(query) — 레이블 대소문자 무시 검색 + highlightedNodeIds 갱신
- [x] setHighlightedNodes(ids) / clearHighlights()
- [x] highlight overlay (z-index:1) — 황색 파선 rect, 뷰포트 변환 동기화

### Graph Analysis
- [x] getIncomers / getOutgoers / getConnectedNodes — nodeEdgeIndex O(degree) 활용
- [x] getEdgesForNode — nodeEdgeIndex 활용
- [x] hasCycle() — DFS 3색 탐색
- [x] findPaths() — DFS, 최대 100경로 cap

### Import/Export
- [x] importJSON(data, mode='replace'|'merge') — merge 시 beforeMutation + addNode/addEdge
- [x] getEdgesBetween(sourceId, targetId) — 양방향 포함
- [x] swapEdgeDirection(id) — beforeMutation + graph.updateEdge + edgeUpdate emit
- [x] exportPNG(scale?) — offscreen canvas 업스케일
- [x] exportSVG(padding?) — 바운딩박스 계산, edge 베지어/직선/웨이포인트

### Group & Layout
- [x] collapseNode / expandNode / toggleCollapse (그룹 타입 전용, undo 지원)
- [x] groupNodes / ungroupNodes (undo 지원)
- [x] alignNodes(axis) / distributeNodes(axis) (undo 지원)
- [x] circularLayout(nodes, radius?)
- [x] animateLayout(targets, duration) — smoothstep RAF 보간

### Misc
- [x] autoFit 옵션 — 초기 노드 로드 후 viewport.fit() 호출
- [x] onBeforeDelete 옵션 / setOnBeforeDelete(fn|null) 런타임 setter
- [x] onBeforeConnect 옵션 + port maxConnections 제한
- [x] readOnly 옵션 / setReadOnly() — connectDrag/edgeReroute/nodeResize 비활성화
- [x] snapGrid / setSnapGrid() — 드래그 스냅
- [x] tooltip — NodeData.tooltip, mousemove 시 fixed div 표시
- [x] locked 노드 — deleteSelected 시 제외
- [x] minimap / setMinimap() — 클릭 이동 지원

---

## Production Hardening

- [x] 메모리 누수 수정 — canvas 이벤트 리스너 4개 클래스 필드로 저장/해제
- [x] ariaDesc DOM 요소 dispose()에서 제거
- [x] GPU 누수 수정 — CapProgram.dispose() 추가 + WebGL2Renderer에서 호출
- [x] 렌더 캐시 — cachedTextNodes, cachedHasAnimated(매 프레임 filter/some 제거)
- [x] Graph.getEdgesForNode() O(1) nodeEdgeIndex 공개 메서드
- [x] ungroupNodes() replaceNode 패턴 (스프레드 병합으로 optional field 삭제 불가 문제 해결)
- [x] 220 tests, 11 files — 모든 공개 API undo 일관성 + 엣지케이스 커버

---

## Tenet Regression Gates

These checks block every release. They restate the guardrails in `AGENTS.md` as
binary pass/fail items the agent must verify before claiming Definition of Done.
A red box here means the release is held — no tenet may be waived without a
recorded exception line in `HISTORY.md` (see AGENTS.md "Tenet-Violation
Escalation Protocol").

### T1 — GPU-First Rendering
- [x] `makeRenderer(undefined)` returns a `WebGL2Renderer` instance — verified at `packages/core/src/flowchart.ts`
- [x] Demo `index.html` defaults to WebGL2; `?renderer=canvas2d` opts into Canvas2D
- [x] README hero paragraph names WebGL2 as the rendering path, Canvas2D as fallback
- [x] CHANGELOG entries for 0.2.x do not advertise a non-WebGL2 default

### T2 — Zero Runtime Dependencies (core)
- [x] `packages/core/package.json` has no `dependencies` key
- [x] Wrapper packages list only their host framework under `peerDependencies`
- [x] CycloneDX SBOM published per package contains zero non-self runtime entries for core

### T3 — Framework-Agnostic Core
- [x] No React / Vue / Svelte imports anywhere under `packages/core/src/`
- [x] Core `tsconfig.json` has no `jsx` setting

### T4 — Renderer-Backend Interchangeability
- [x] Public `FlowChart` API surface does not throw "not supported by backend" on any method
- [x] Public types in `packages/core/src/types.ts` carry no `webgl2 | canvas2d` discriminant unions

### T5 — Visual Feature Parity Across Backends
- [x] WebGL2 renders: nodes, edges, labels, status badges, handles, reroute handles, endpoint circles, minimap, grid, highlights — all documented features
- [ ] Canvas2D parity gaps: handle-program connect-drag circles, reroute handles, endpoint circles — **listed in CHANGELOG Known limitations, opt-in only, may not become default until closed**
- [x] `rendererKind` JSDoc names every shipped backend and labels experimental ones

### T6 — Performance Tier
- [x] 1,000 nodes ≥ 60 fps (SwiftShader headless; current: 120 fps)
- [x] 5,000 nodes ≥ 60 fps target (current: 113.6 fps)
- [x] 10,000 nodes ≥ 30 fps floor (current: 114.1 fps)

### T7 — Accessibility
- [x] axe-core test suite passes with 0 violations
- [x] `aria-keyshortcuts` tokens follow the WAI grammar (single key, modifier+key, or whitespace-separated alternatives)
- [x] `aria-live` region is sr-only positioned, not visually rendered

---

## Visual Rendering Regression Gates

Catches the failure modes that 0.2.5 and 0.2.6 each shipped at least one of —
single-renderer-frame visual bugs that pass type-check and unit tests but break
the live page.

- [x] Node labels render centered horizontally inside the node — atlas glyph centroid lies on the node's `x + width/2` axis (no `textAlign: start` left-bias)
- [x] Node labels render centered vertically inside the node — atlas glyph centroid lies on the node's `y + height/2` axis
- [x] CJK / Hangul / Japanese labels render with the same alignment rule as ASCII labels
- [x] Multi-line labels (`\n`-split) render with each line independently centered, not left-aligned
- [x] Connect-drag handles render on every node in the active renderer's backend (regression test for WebGL HandleProgram → Canvas2D backend gap)
- [x] Reroute handles on edges render in the active renderer's backend
- [x] Endpoint circles on edges render in the active renderer's backend
- [x] Atlas eviction race covered — Pass 1 (`text-program.ts`) re-checks `atlas.generation` after the pre-warm loop and forces a full `quadCache` rebuild if eviction fired mid-Pass-1 (added in 0.4.1 after 0.4.0 mis-mapped ASCII labels with CJK fragments)
- [x] Multi-line label round-trip through the inline editor preserves interior `\n` — `<textarea>` instead of `<input>`, `value.trim()` strips only leading/trailing whitespace (added in 0.4.2 after `<input>` flattened multi-line labels on open)

---

## Release Verification Gates

These checks block `npm publish` (or a `gh workflow run Release` dispatch).
Static type-check + unit tests passing is *necessary* but not *sufficient* —
0.4.0 and 0.4.2 both shipped with all static checks green and were
hotfixed within hours. Every release must pass every gate below.

### 1. Static checks
- [ ] `pnpm typecheck` — 0 errors across all four packages
- [ ] `pnpm test` — all tests pass (919+ currently; refresh PROJECT.md if the number drifts)
- [ ] `pnpm build` — every package's `dist/` produces successfully

### 2. CDP atlas regression gate
- [ ] `pnpm dev` + `brave-debug` are running locally
- [ ] `node packages/core/scripts/atlas-cjk-diag.mjs http://localhost:5173` exits 0
- [ ] Both phases pass: `CJK PARITY OK — N/N samples` and `ENTRY MAPPING OK — M/M nodes`
- [ ] The screenshot written to `/tmp/cjk-current.png` shows every ASCII / CJK / multi-line node rendering the correct label at the correct position — visual inspection by a human, not just by `nz` counts. (0.4.0 lesson: pixel counts were OK while ASCII labels were mis-rendered. Always look at the screenshot.)

### 3. Interactive scenarios (manual, no automation yet)
- [ ] Single-line label: double-click → blur with no edit → label unchanged
- [ ] Multi-line label (`\n` present): double-click → blur with no edit → all interior `\n` survive
- [ ] Multi-line label: double-click → Shift+Enter inserts a newline; plain Enter commits
- [ ] Zoom in / zoom out / pan: labels do not flicker (atlas eviction is not firing every frame)
- [ ] Group node double-click: with `groupDoubleClickCollapses: false` (default), no collapse fires; with `true`, collapse fires

### 4. Live-site verification (after Cloudflare auto-deploy)
- [ ] dev.flowgl.ouranos.kr loads the new bundle hash
- [ ] `node packages/core/scripts/atlas-cjk-diag.mjs https://dev.flowgl.ouranos.kr` exits 0
- [ ] Screenshot inspection — same as gate 2 — on the live site, not just local dev

Only after every box above is checked may `gh workflow run Release ... -f package=all` be dispatched.

### Post-publish
- [ ] All four `npm view @flowgl/<pkg> version` return the new version
- [ ] `npm audit signatures @flowgl/core` confirms provenance + registry signatures
- [ ] If a regression is reported within 24 hours, the affected versions get `npm deprecate`-marked with an upgrade-to-next-patch message before any other work proceeds


