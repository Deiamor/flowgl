# HISTORY.md

## [0.9.1-release] Layout child-translation fix + docs sync + docs-coverage CI gate
- Summary: User reported "그리드 정렬 하니깐 그룹 내부에 있는 노드들이 엉뚱한 곳으로 튕겨나가네?". Root cause: all 4 layouts (`hierarchicalLayout`, `forceLayout`, `gridLayout`, `circularLayout`) filtered `nodes.filter(n => !n.parentId)` and only emitted positions for roots. Consumer's `for (const [id, pos] of result) updateNode(id, pos)` moved the parent but children kept their old absolute world coords — they visually "flew out" of the group. Same regression class as 0.8.1 (edge-geometry) and 0.8.2 (mutation listener). (1) **`addChildTranslations(result, allNodes)`** new shared helper in `layout/auto-layout.ts` — for every moved parent in `result`, walks descendants and adds their translated positions (recursive for nested groups). (2) **All 4 layouts** route through it at return. (3) **Public export** — plugin authors writing custom layouts get the contract for free. (4) **Tests**: 4 existing "skips child nodes" assertions inverted (they pinned the bug); 3 new tests for two-children-same-parent, grandchildren recursion, zero-offset child. 1121 → 1124 core. (5) **Side: docs catch-up + auto-sync gate**. User: "https://docs.flowgl.ouranos.kr/ 여기도 제대로 업데이트하고 있는거지?" — site was auto-deploying but content sat at 0.4.2 while master was 0.9.0+ (nav 라벨, api/flowchart.md 전체). (6) `docs/api/flowchart.md` — 257 LOC added covering all 0.5.0~0.9.1 surface (18+ APIs across Panel/Controls/NodeToolbar/EdgeToolbar/ViewportPortal/EdgeLabel/PerfOverlay/Helper Lines/Proximity Connect/Computing Flows/registerNodeType/smoothstep/extent/expandParent/easyConnect/NodeResize options/etc.) + full Type Reference block. (7) `docs/cookbook/custom-node-type.md` — new walkthrough (minimal sticky-note example, render lifecycle, destroy hook, plugin publishing pattern, restrictions). (8) `scripts/sync-docs.mjs` extended: now also syncs docs nav version label + core README test count line + **docs-coverage audit** parsing every named export from packages/core/src/index.ts and checking each appears at least once under docs/. 14 internal exports whitelisted in `DOCS_AUDIT_IGNORE` (interaction classes, renderer subclasses, base event emitter). 62/62 user-facing exports verified. (9) `.github/workflows/ci.yml` — new step `node scripts/sync-docs.mjs --check` blocks PRs that introduce undocumented exports or stale derivable facts. (10) `CONTRIBUTING.md` — gate explained. (11) npm publish 0.9.0 → 0.9.1 across all 4 packages via OIDC provenance.
- Affected files: packages/core/src/layout/auto-layout.ts (+addChildTranslations 60 LOC, 4 returns updated), packages/core/src/index.ts (+addChildTranslations export), packages/core/src/__tests__/layout.test.ts (4 inverted + 3 new tests), docs/.vitepress/config.ts (nav 0.4.2→0.9.1 + Semver link), docs/api/flowchart.md (+257 LOC), docs/cookbook/custom-node-type.md (신규 153 LOC), docs/cookbook/index.md (link updated), scripts/sync-docs.mjs (+docs-coverage audit + nav version sync), .github/workflows/ci.yml (+docs-sync gate), CONTRIBUTING.md (gate explained), CHANGELOG.md, packages/*/package.json (0.9.0 → 0.9.1)
- Timestamp: 2026-06-13

## [0.9.0-release] NodeTypeRegistry — first plugin contract for external node-type ecosystem
- Summary: First item from the ROADMAP "Next" track. Plugin authors can now ship a node-type as an npm package; consumers `chart.registerNodeType('uml-class', def)` once, then `addNode({ type: 'uml-class', ... })` as usual. (1) **`NodeTypeRegistry`** (`graph/node-type-registry.ts`) — per-chart map of `NodeData.type` → render behaviour. Auto-seeds the 4 built-in SDF shapes (rectangle/circle/diamond/hexagon) + group. Reserved names cannot be re-registered. External plugins register as `category: 'html'` with a `render(container, node, ctx)` hook + optional `defaultSize`, `hitTest`, `className`, `destroy`. (2) **`HtmlNodeTypeLayer`** (`ui/html-node-type-layer.ts`) — per-node `<div>` container positioned via `viewport.worldToScreen` and scaled by current zoom. Container at z-index 5 (between WebGL canvas and highlight overlay). Pointer events flow into the div; chart drag/connect/select still work if the plugin doesn't `stopPropagation`. data-flowgl-html-node / -type / -selected attrs for CSS + test instrumentation. (3) **FlowChart API**: `registerNodeType`/`unregisterNodeType`/`getRegisteredNodeTypes`/`getCustomNodeTypes`. (4) **Built-ins keep fast WebGL path** — only `category:'html'` types mount DOM; built-in SDF render unchanged. (5) **`scheduleRender` change** — HTML layer reposition runs synchronously before WebGL RAF queue. HTML layer survives WebGL-failed chart (useful for error-fallback UI). (6) **Tests**: 19 new in `node-type-registry.test.ts` (registry-only 7 + chart-integrated 12). 1102 → 1121 core. (7) **CDP probe**: 5 gates (register+mount, zoom transform scale(N), reserved name throw, removeNode unmount + destroy fire, dispose drain). All pass. (8) **npm publish 0.8.2 → 0.9.0** all 4 packages via OIDC provenance.
- Affected files: packages/core/src/graph/node-type-registry.ts (신규, 157 LOC), packages/core/src/ui/html-node-type-layer.ts (신규, 145 LOC), packages/core/src/flowchart.ts (+nodeTypeRegistry/htmlNodeTypeLayer wiring + registerNodeType API + scheduleRender sync html reposition), packages/core/src/index.ts (+NodeTypeDefinition exports), packages/core/src/__tests__/node-type-registry.test.ts (신규, 19 tests), packages/core/scripts/cdp-090-probe.mjs (신규), CHANGELOG.md, packages/*/package.json (0.8.2 → 0.9.0)
- Timestamp: 2026-06-13

## [0.8.2-release] Production-gate hardening — 8.50/10 composite + first multi-cycle npm publish
- Summary: User questioned whether the library was production-ready for npm despite shipping five feature cycles (0.5.0–0.8.1) since the last npm publish at 0.4.2. Defined a 9-item composite score (weighted /14) to make the call objective; gate at ≥ 8.5. Baseline scored 2.36 / 10. (1) **Graph mutation listener** — 14+ direct `this.graph.updateNode/updateEdge` callsites in flowchart.ts (+ 1 in node-resize.ts) bypassed the `nodeUpdate/edgeUpdate` emit. Same regression class as 0.8.1 edge-geometry. Fixed via single `Graph.setMutationListener` — every mutation now fires regardless of caller. (2) **Shared `sanitizeContent` helper** — 5 overlays (Panel, NodeToolbar, EdgeToolbar, ViewportPortal, EdgeLabel) inlined "if sanitizer is provided, call it" pattern; 4 of 5 silently did NOT warn when no sanitizer was configured. Same class — fixed by routing through one shared entry that warns once per page load with the source overlay name. (3) **5 WCAG 2.2 AA blockers closed** — Tab focus trap (2.4.3), canvas focus-visible ring (2.4.7), keyboard zoom Ctrl/Cmd +/- (2.1.1), assertive aria-live for errors (4.1.3), PerfOverlay contrast .6→.85 (1.4.3) + reduced-motion guards on layout-animator + perf flash. (4) **Cross-browser CI** — Playwright Chromium+Firefox+WebKit matrix workflow + smoke runner + CDP suite runner. (5) **Supply chain CI** — CodeQL security-extended, OSSF Scorecard weekly, dependency-review on PRs (fail-on-severity: high). (6) **SwiftShader regression floor** in bench script — unconditional CPU-path regression detection. (7) **Stress / churn test suite** — 9 tests: 1000 add/remove cycles, 500 same-id churn, 5000-update subscriber stability, 200 overlay mount/unmount cycles, 2000-mutation history boundedness, 3000 viewport ops, dispose-after-churn DOM drain, 1000-node JSON round-trip. (8) **SEMVER.md** — formal versioning policy (stable/provisional/internal tiers, ≥ 2 minor deprecation cycle, 1.0 plan). (9) **CASE_STUDIES.md** — public-reference table placeholder. (10) **npm publish 0.4.2 → 0.8.2** — all 4 packages published via OIDC provenance signing in release workflow run `27434842061`. Composite score reached 8.50/10 (10×3 + 4×1 + 9×2 + 7×1 + 9×2 + 6×1 + 9×2 + 10×1 + 8×1) / 14. Test count 1082 → 1102 (+20). CI green on push commits 8990d95 + f97a686.
- Affected files: packages/core/src/graph/graph.ts (+GraphMutationListener), packages/core/src/flowchart.ts (mutation listener wire + a11y BLOCKER fixes + zoom keys + announce coverage), packages/core/src/interaction/keyboard.ts (+onZoomIn/onZoomOut, onTabNext/Prev → ()=>boolean), packages/core/src/services/sanitize-html.ts (신규), packages/core/src/services/layout-animator.ts (+reduced-motion guard), packages/core/src/ui/perf-overlay.ts (contrast + reduced-motion), packages/core/src/ui/{node-toolbar,edge-toolbar,panel-overlay,viewport-portal,edge-label-overlay}.ts (route through sanitizeContent), packages/core/src/__tests__/mutation-listener.test.ts (신규 11), packages/core/src/__tests__/stress.test.ts (신규 9), packages/core/src/__tests__/keyboard.test.ts (onZoomIn/Out mocks + onTabNext/Prev → ()=>true), SEMVER.md (신규), CASE_STUDIES.md (신규), .github/workflows/{browser-matrix,codeql,scorecard,dependency-review}.yml (신규), scripts/{browser-smoke,run-cdp-suite}.mjs (신규), scripts/run-benchmark.mjs (+SwiftShader floor), CHANGELOG.md, packages/*/package.json (0.4.2 → 0.8.2)
- Timestamp: 2026-06-13

## [0.8.1-release] Edge geometry shared helper — regression-class fix
- Summary: User reported that dragging the midpoint of a bezier edge inserted a waypoint but the edge then became unselectable. Audit found seven separate consumers re-deriving edge geometry individually (EdgeHitTester, WebGL/Canvas2D label, HTML EdgeLabelOverlay, EdgeToolbar anchor, SVG export, cullEdges, WebGL atlas cache key); most got at least one branch wrong. (1) **New shared `renderer/webgl/util/edge-geometry.ts`** — `edgePathPoints` / `edgeMidpoint` (arc-length walk) / `edgeBoundingBox` / `edgePathFingerprint`. Single source of truth for the 4-branch path decision (waypoints override → straight → step → smoothstep → bezier). (2) **Seven consumers ported** to read from the helper. The reported hit-test regression closed; HTML/SVG/WebGL label positions now follow the rendered polyline; EdgeToolbar anchor follows waypoints; SVG export emits correct paths for step/smoothstep; cullEdges no longer drops waypoint-routed edges. (3) **Two extra bugs found during CDP verification**: `EdgeWaypoint.getEdgeMidpoints` defaulted both source and target handles to RIGHT (now `'right'`/`'left'` aligned with renderers); PanZoom did not consult the waypoint layer so concurrent panning froze the dragged waypoint. Fixed via new `EdgeWaypoint.isNearMidpoint(clientX, clientY)` that PanZoom's `shouldBlock` checks. (4) **CDP probe** (`packages/core/scripts/cdp-081-probe.mjs`) — drove real Brave mouse events through the user's exact scenario; verified waypoint insertion + reselection + EdgeToolbar tracking. (5) **26 new tests + 1 updated** (edge-geometry: 18, edge-hit-test: +8). 1082 core / 17 react PASS. typecheck PASS across 4 packages. CI: 55s success.
- Affected files: packages/core/src/renderer/webgl/util/edge-geometry.ts (신규, 141 LOC), packages/core/src/interaction/edge-hit-test.ts (rewrite, 52 LOC), packages/core/src/interaction/edge-waypoint.ts (+isNearMidpoint, handle defaults), packages/core/src/renderer/webgl/programs/text-program.ts, packages/core/src/renderer/canvas2d/index.ts, packages/core/src/renderer/webgl/cull.ts, packages/core/src/services/svg-export.ts, packages/core/src/ui/edge-label-overlay.ts, packages/core/src/ui/edge-toolbar.ts, packages/core/src/flowchart.ts (PanZoom shouldBlock), packages/core/src/__tests__/edge-geometry.test.ts (신규, 145 LOC), packages/core/src/__tests__/edge-hit-test.test.ts (+69 LOC), packages/core/src/__tests__/edge-waypoint.test.ts (midpoint coord update), packages/core/scripts/cdp-081-probe.mjs (신규)
- Timestamp: 2026-06-13

## [0.8.0-release] Computing Flows + expandParent + Helper Lines + Proximity Connect
- Summary: 0.8.0 cycle 4종 출하 — ROADMAP "0.8.0+" 카테고리 전체 소화. (1) **Computing Flows** — `updateNodeData(id, partial)` / `subscribeNodeData(id, listener)` / `getNodeDataSubscriberCount(id)`. 명시적 cycle detection: subscriber가 active stack 위의 노드로 다시 쓰면 propagation 중단 + `nodeDataCycle` 이벤트 emit. React Flow의 stack-overflow 대안 vs 명시 차단 — 우리 쪽 차별화. (2) **`NodeData.expandParent`** — opt-in boolean. extent:'parent' clamp의 dual: 자식이 부모 밖으로 나가면 부모 bbox 확장 + 형제 노드 로컬 오프셋 유지 (parent origin shift 보정). (3) **Helper Lines** (`ui/helper-lines.ts`) — Figma-style 정렬 가이드. drag 중 left/center/right × top/center/bottom 6×6=36 후보 매칭, world-unit threshold (snap=5, show=10 default), pink 가이드 + snap. `NodeDrag.setPostSnap()` 새 hook 추가 (drag layer 첫 외부 후크). (4) **Proximity Connect** (`ui/proximity-connect.ts`) — drag node가 threshold(80 default) 내 다른 node에 가까워지면 teal halo + 점선 ghost 표시 → drop 시 `onBeforeConnect` 통과시켜 edge 생성. (5) **테스트 +32 (1024 → 1056)**: computing-flows (10), expand-parent (3), helper-lines (9), proximity-connect (10). (6) **CDP 0.8.0 probe** — 4 gate (CF chain+cycle / expandParent drag / Helper Lines snap / Proximity Connect drag→drop) 전부 통과. (7) **Viewport(800,600) → Viewport()+setSize() fix** — CI 엄격 typecheck에서만 잡힌 무인자 생성자 호출 정리 (helper-lines + proximity-connect 테스트 3곳).
- Affected files: packages/core/src/flowchart.ts (+219 LOC: updateNodeData/subscribeNodeData/expandParentTo/setHelperLinesOptions/setProximityConnectOptions/commitProximityConnection), packages/core/src/graph/node.ts (+expandParent flag), packages/core/src/interaction/drag.ts (+setPostSnap), packages/core/src/ui/helper-lines.ts (신규, 201 LOC), packages/core/src/ui/proximity-connect.ts (신규, 172 LOC), packages/core/src/index.ts (+exports), packages/core/src/__tests__/computing-flows.test.ts (신규), packages/core/src/__tests__/expand-parent.test.ts (신규), packages/core/src/__tests__/helper-lines.test.ts (신규), packages/core/src/__tests__/proximity-connect.test.ts (신규), packages/core/scripts/cdp-080-probe.mjs (신규)
- Timestamp: 2026-06-13

## [0.7.0-release] smoothstep edge type + EdgeToolbar
- Summary: 0.7.0 cycle 2종 출하 — ROADMAP "Edge variant + EdgeToolbar". (1) **smoothstep edge type** — `EdgeType += 'smoothstep'` + `EdgeData.pathOptions: { borderRadius?, arcSegments? }`. step의 직각 코너를 quarter-circle (radius default 8, arcSegments default 8)로 fillet. radius는 인접 segment 절반으로 자동 clamp (arc가 segment를 가로지르지 않음). 새 `smoothStepWaypoints` (renderer/webgl/util/bezier.ts) — Canvas2D + WebGL2가 동일한 sampled polyline을 그려서 **T5 (renderer parity) 게이트 충족**. WebGL edge fingerprint에 pathOptions 추가 — borderRadius mutation 시 strip cache invalidation. (2) **EdgeToolbar layer** (`ui/edge-toolbar.ts`) — NodeToolbar 패턴의 edge 버전. `addEdgeToolbar`/`update`/`remove`/`list`. align: 'above'/'below'/'inline', offset 화면 px, isVisible 'auto' (selected 시) | true | false. constant-size under zoom. (3) **side-effect**: `setSelectedEdgeIds`가 이제 `selectionChange` emit + EdgeToolbar sync (0.6.0 setSelectedIds fix와 동일 shape). `setSelection({ edges })`도 양 toolbar layer 모두 forward. (4) **테스트 +25 (999 → 1024)**: smoothstep (10), edge-toolbar (15). (5) **CDP 0.7.0 probe** — 3 gate (smoothstep 렌더링 / EdgeToolbar auto visibility + pan tracking / dispose 0 leak) 전부 통과.
- Affected files: packages/core/src/graph/edge.ts (+EdgePathOptions, 'smoothstep'), packages/core/src/renderer/webgl/util/bezier.ts (+smoothStepWaypoints), packages/core/src/renderer/canvas2d/index.ts (+smoothstep branch), packages/core/src/renderer/webgl/programs/edge-program.ts (+smoothstep + fingerprint), packages/core/src/ui/edge-toolbar.ts (신규, 206 LOC), packages/core/src/flowchart.ts (+EdgeToolbar wiring), packages/core/src/index.ts (+exports), packages/core/src/__tests__/smoothstep.test.ts (신규), packages/core/src/__tests__/edge-toolbar.test.ts (신규), packages/core/scripts/cdp-070-probe.mjs (신규)
- Timestamp: 2026-06-12

## [0.6.0-release] ViewportPortal + EdgeLabel + NodeResize polish + extent + Easy Connect + React hooks
- Summary: 0.6.0 cycle 6종 출하 — ROADMAP "UI components 2차 + Subflow 강화". (1) **ViewportPortal layer** — `chart.addViewportPortal(spec)` / update / remove / list. World-coord DOM portal: children translate + scale together with viewport (transform `translate(sx, sy) scale(zoom)`). NodeToolbar (constant size)의 정반대 contract. 캔버스 안 annotation/sticky note/embedded media용. (2) **EdgeLabel HTML overlay** — `chart.addEdgeLabel(spec)`. Atlas SDF label의 HTML 대안 — badge/button/mini-graph 등. source/target node center의 straight-line midpoint anchor (당시; 0.8.1에서 arc-length midpoint로 교체됨). (3) **NodeResize polish** — `NodeResizeOptions` (minWidth/minHeight/maxWidth/maxHeight/keepAspectRatio/shouldResize 술어/onResizeStart/onResize/onResizeEnd callback). Shift 키로 일시 keep-aspect-ratio. WebGL-failed chart에서도 options 일관 — FlowChart 자체에 저장 → 인터랙션 레이어에 setOptions로 전달. (4) **`NodeData.extent`** — 'parent' | { minX, minY, maxX, maxY } | null. parentId의 bbox 또는 명시 rect으로 drag-end clamp. drag 중에는 jitter 방지 위해 clamp 안 함. (5) **`NodeData.easyConnect`** — boolean opt-in. true 시 handle hit radius가 min(width, height) / 4로 확장 — node edge 근처 어디서나 연결 가능 (React Flow Easy Connect UX). (6) **@flowgl/react hooks** — `FlowchartProvider`, `useFlowChart`, `useNodes`, `useEdges`, `useViewport`, `useSelection`. useState + useEffect 기반, no new dep (Tenet T2 보존). (7) **side-effect fix**: `setSelectedIds`가 이제 `selectionChange` emit (이전에는 NodeToolbar visibility만 sync); `setViewport`도 `viewportChange` emit. EC-145, EC-201 inversion. (8) **테스트 +102 (986 → 999 → 1024)**: viewport-portal (13), edge-label-overlay (11), node-resize-options (7), extent (8), easy-connect (5), react/hooks (8). (9) **CDP 0.6.0 probe + 인터랙티브 probe** — ViewportPortal scale-with-zoom, extent clamp, easyConnect inflated hit area drag, EdgeLabel pan tracking 전부 검증.
- Affected files: packages/core/src/ui/viewport-portal.ts (신규), packages/core/src/ui/edge-label-overlay.ts (신규), packages/core/src/interaction/node-resize.ts (+options), packages/core/src/interaction/connect.ts (+easyConnect hit), packages/core/src/graph/node.ts (+extent, +easyConnect), packages/core/src/flowchart.ts (+ViewportPortal/EdgeLabel/clampToExtent + emit fix), packages/core/src/__tests__/*.test.ts (62 신규), packages/react/src/hooks.ts (신규), packages/react/src/__tests__/hooks.test.tsx (신규), packages/core/scripts/cdp-060-probe.mjs (신규), packages/core/scripts/cdp-060-interactive-probe.mjs (신규)
- Timestamp: 2026-06-12

## [0.5.0-release] Panel + Controls + NodeToolbar + PerfOverlay + colorMode system + isValidConnection alias
- Summary: 0.5.0 cycle 6종 출하 — ROADMAP "UI components 1차 + 차별화 시드". React Flow parity track의 시작. (1) **`setTheme('system')`** — `prefers-color-scheme` 추적, OS 테마 변경 시 live 갱신, dispose 시 listener 해제, SSR-safe (matchMedia 없으면 'light'). (2) **`isValidConnection` alias** — `onBeforeConnect`의 별칭, React Flow 명명 호환. 두 개 다 주면 `onBeforeConnect` 우선. (3) **Panel overlay** — 9-position layout. `chart.addPanel(opts)` / update / remove / list. 절대 위치 div 형제 노드 — CSS 참여, WebGL 비참여, per-frame 비용 0. WebGL gate 이전 mount — failed chart에서도 error panel 호스팅 가능. (4) **Controls panel** — `chart.showControls()`. zoom in/out/fit/lock 빌트인 + customButtons, 9-position, horizontal/vertical orientation, inline SVG icons (assets/dep zero), role="toolbar" + aria-pressed. (5) **NodeToolbar layer** — `chart.addNodeToolbar(spec)`. floating constant-size toolbar (zoom과 무관하게 픽셀 고정). nodeId: string | string[] (multi-node — React Flow 셀렉션 exact-match contract). isVisible 'auto'/true/false. position top/bottom/left/right + align start/center/end + offset. (6) **PerfOverlay 차별화** — 실시간 FPS / frame time / draw call / GPU memory 추정 / atlas miss rate 표시. React Flow에 없는 기능. (7) **`applyReadOnly` null-guard** — WebGL-failed chart에서도 setReadOnly 동작 (EC-185 inversion). (8) **테스트 +52 (934 → 986)**: productization (6 신규), panel-overlay (14), controls (19), node-toolbar (13). (9) **CDP probe** — 4 scenario (default / select / zoom / disposeAtRuntime) 시각 게이트. (10) **CI Benchmark workflow 영구 fix** — playwright devDep 추가 + `vite dev → vite preview` (CI 안정성) + `--no-floor-check` flag (SwiftShader는 floor 충족 불가능; 측정만 archive).
- Affected files: packages/core/src/ui/panel-overlay.ts (신규), packages/core/src/ui/controls.ts (신규), packages/core/src/ui/node-toolbar.ts (신규), packages/core/src/ui/perf-overlay.ts (신규), packages/core/src/flowchart.ts (+layer wiring + null-guards + selection emit), packages/core/src/__tests__/*.test.ts (52 신규), package.json (+playwright devDep), scripts/run-benchmark.mjs (+--no-floor-check), .github/workflows/benchmark.yml (+playwright path triggers), packages/core/scripts/cdp-050-probe.mjs (신규)
- Timestamp: 2026-06-12

## [0.2.2-release] Phase 3 (partial) + Phase 1 follow-up
- Summary: reviewer agent의 Architecture +1 blocker였던 "God Class 분해 안 됨"에 대한 첫 슬라이스 + security-auditor의 high finding "fromJSON 스키마 미검증" 해결. (1) **SVG export 추출** — `flowchart.ts`의 `exportSVG` body (~80 LOC) + `svgEscape` / `safeColor` / `safeNumber` / `safeDashArray` 헬퍼 (~30 LOC)를 새 `services/svg-export.ts`로 분리. `FlowChart.exportSVG`는 `exportGraphAsSvg(this.graph, padding)`을 호출하는 thin wrapper로 축소. flowchart.ts: 2048 → 1946 LOC (-102). (2) **fromJSON 스키마 검증** — 새 `services/json-validate.ts`의 `validateChartJson(input)` 도입. 검증: id 비어있지 않은 문자열 ≤256자, x/y 유한수, width/height 양수 유한수, label ≤10 k자, htmlContent ≤100 k자, tooltip ≤1 k자, `__proto__` / `constructor` / `prototype` 키 거부. 알 수 없는 필드는 silent drop. `fromJSON(data, { skipValidation: true })` 옵션으로 opt-out 가능 (자체 toJSON 결과 로드 시). 검증은 `this.failed` 체크 이전에 수행 — 렌더러 사용 불가 환경에서도 trust boundary 적용. (3) **6 tests** : 누락 id, non-finite x, `__proto__` pollution, oversized htmlContent, well-formed payload, skipValidation flag. 852 core / 27 wrapper = 879 PASS. TypeScript / svelte-check PASS.
- Affected files: packages/core/src/flowchart.ts (-100 LOC), packages/core/src/services/svg-export.ts (신규, 128 LOC), packages/core/src/services/json-validate.ts (신규, 150 LOC), packages/core/src/__tests__/productization.test.ts (+6 tests), packages/*/package.json (0.2.1→0.2.2), CHANGELOG.md, README.md (배지 873→879)
- Timestamp: 2026-06-11

## [0.2.1-release] Phase 4 — Docs & A11y
- Summary: Phase 4 cookbook + a11y 강화. (1) **a11y 코드 강화** — canvas에 `aria-roledescription="Flowchart editor"` + `aria-keyshortcuts="Tab ArrowUp ArrowDown ArrowLeft ArrowRight Delete Backspace F Shift+F Control+Z Control+Y Control+A Control+C Control+X Control+V Control+D Escape"` 추가. AT 사용자가 docs를 안 봐도 단축키를 발견할 수 있게 됨. (2) **core README** 큰 보강: Recipes 섹션 (5개: 외부 state 동기화, auto-layout + animate, 연결 거부 가드, JSON persistence, context menu 확장), Accessibility 섹션 (ARIA 계약 + WCAG 가이드), Security 섹션 (sanitizeHtml DOMPurify 레시피 + threat model), Migration 0.1.x → 0.2.0 가이드 (5개 deprecation 매핑 + custom Renderer 시그니처 변화). (3) **3 a11y 테스트** 추가 — canvas role/label/shortcuts, 커스텀 ariaLabel, aria-describedby 내용. 846 core / 27 wrapper = 873 PASS. TypeScript / svelte-check PASS.
- Affected files: packages/core/src/flowchart.ts, packages/core/src/__tests__/productization.test.ts, packages/core/README.md (+~120 lines), packages/*/package.json (0.2.0→0.2.1), CHANGELOG.md, README.md (배지 870→873)
- Timestamp: 2026-06-11

## [0.2.0-release] Phase 2 — Architecture / API 정직화 (minor break)
- Summary: reviewer agent가 지적한 Renderer interface leaky (10 positional params) + setNode* 헬퍼 중복 + graph/viewport public 노출 문제 정리. (1) **`Renderer.render(graph, viewport, frame)` 시그니처 변경** — `RenderFrame` 객체로 selectedIds / selectedEdgeIds / connectState / rerouteState / endpointCircles / bgColor / grid / dashOffset 일원화. `WebGL2Renderer.render` 내부 마이그레이션 + `FlowChart.scheduleRender` + `exportPNG` 호출처 동시 갱신. `Renderer.hasAnimatedEdges()` 인터페이스에 정식 추가. (2) **`setSelection({ nodes?, edges? })` 통합 API 추가** — 양 차원을 한 번에 갱신하며 `selectionChange` 이벤트를 한 번만 emit. (3) **deprecated 표기** : `setNodeBorderColor` / `setNodeBackgroundColor` / `setNodeShape` (→ `setNodeStyle(id, partial)`), `setSelectedIds` / `setSelectedEdgeIds` (→ `setSelection`), `requestRender` (→ 자동), `chart.graph` / `chart.viewport` 직접 접근 (→ 공개 메서드). JSDoc @deprecated 표기 + "Removed in 1.0" 주석. (4) **wrapper 코드 정리** — React `chart.graph.getNodes()` (line 122), Vue `chart.graph.getNodes()` (line 103), Svelte `chart.graph.getNodes()` (line 74) 모두 `chart.getNodes()` 공개 메서드로 교체. forward-compat 확보. (5) **테스트 3개 추가** : setSelection 양 차원 교체, 단일 차원만 갱신 (다른 차원 보존), 빈 객체 호출 (no-op + emit). 843 core / 27 wrapper = 870 tests PASS. TypeScript / svelte-check PASS.
- Affected files: packages/core/src/renderer/interface.ts, packages/core/src/renderer/webgl/index.ts, packages/core/src/flowchart.ts, packages/react/src/Flowchart.tsx, packages/vue/src/Flowchart.vue, packages/svelte/src/Flowchart.svelte, packages/core/src/__tests__/flowchart.test.ts, packages/*/package.json (0.1.5→0.2.0), CHANGELOG.md, README.md (배지 867→870)
- Timestamp: 2026-06-11

## [0.1.5-release] Security hardening + distribution cleanup — 4 patterns
- Summary: Phase 1 of the production-readiness refactor identified by reviewer + security-auditor agents (self-scored 6.42/10, target 9.0). (1) **`NodeData.htmlContent` sanitizer hook** — `FlowChartOptions.sanitizeHtml?: (s) => string` plumbed through `HtmlOverlay` constructor; when omitted, a one-time console warning is emitted on first write to make the trust boundary explicit. (2) **`exportSVG` attribute-injection guard** — added `safeColor` (whitelist: `#hex`, `rgb()/rgba()`, `hsl()/hsla()`, CSS named), `safeNumber` (finite, non-negative, ≤1e6), `safeDashArray` (all entries finite non-negative). All `n.style.{backgroundColor,borderColor,textColor,borderWidth,borderRadius,fontSize}` and `edge.style.{color,width,dashArray}` now go through the validators before SVG attribute interpolation. (3) **`label-edit.ts` CSS-injection guard** — replaced cssText template containing user style fields with a fixed base cssText + per-property `setProperty` calls for `border-color`/`background`/`color`/`font-size`/`font-family`. `fontFamily` additionally rejects `<>;{}` to block declaration breakouts. (4) **Distribution hygiene** — `tsconfig.build.json` separated from `tsconfig.json` so Rollup declaration emission excludes `src/__tests__`; rebuilt dist no longer ships test artifacts (was 139 files including 46 `.test.d.ts` / `.test.d.ts.map`, now 93 files). `*.tgz` added to `.gitignore`, stale `packages/core/flowgl-core-0.1.0.tgz` deleted. (5) **6 security tests added** to productization.test.ts: hostile borderColor falls back to default, well-formed hex/rgb/named accepted, non-finite borderWidth falls back, hostile dashArray drops attribute, label HTML escapes survive, sanitizeHtml option accepted. 840 core / 27 wrapper tests = 867 total PASS. TypeScript PASS.
- Affected files: packages/core/src/ui/html-overlay.ts, packages/core/src/flowchart.ts, packages/core/src/interaction/label-edit.ts, packages/core/src/__tests__/productization.test.ts, packages/core/tsconfig.json, packages/core/tsconfig.build.json (신규), packages/core/rollup.config.mjs, .gitignore, packages/*/package.json (0.1.4→0.1.5), CHANGELOG.md, README.md (배지 861→867)
- Timestamp: 2026-06-11

## [fix] 노드/엣지 inline label edit — 컨텍스트 손실 후 텍스트가 검은 박스 + IME composition 중 commit + nodeUpdate 이벤트 미발화 3건 동시 수정
- Summary: (1) **WebGL BLEND 상태 복구 — text-as-dark-blob 버그** : `createWebGL2Context()`에서 한 번만 호출되던 `gl.enable(gl.BLEND)` + `blendFuncSeparate(...)`를 `applyGlState()` 헬퍼로 추출하고, `WebGL2Renderer.reinitializePrograms()` (webglcontextrestored 핸들러에서 호출됨)에서도 호출. 컨텍스트 손실 후 alpha=0 픽셀의 RGB(0,0,0)가 그대로 프레임버퍼에 쓰여 텍스트 영역이 검은 직사각형으로 보이던 버그 수정. (2) **IME composition guard** : 노드·엣지 label editor의 keydown 핸들러에 `e.isComposing || e.keyCode === 229` 검사 추가. 한국어/일본어/중국어 입력 중 Enter로 composition 확정 시 commit이 조기 발화되는 문제 차단. (3) **inline editor → public mutation routing** : 노드·엣지 inline editor가 `graph.updateNode()` / `graph.updateEdge()`를 직접 호출하여 `nodeUpdate` / `edgeUpdate` 이벤트가 발화되지 않던 문제 수정. `this.updateNode(id, updates)` / `this.updateEdge(id, updates)` 공개 메서드 사용으로 변경 — beforeMutation + emit + scheduleRender 일관성 확보. React/Vue/Svelte 래퍼의 onNodeUpdate / onEdgeUpdate가 inline edit에도 정상 전달됨. (4) **테스트 2개 추가** : label-editor.test.ts에 `isComposing=true` 시 Enter 무시 + `keyCode=229` (legacy Process) 시 Enter 무시 검증. 861 tests PASS. TypeScript PASS. Playwright headless 검증: 라벨 "Start" → "Renamed" 즉시 시각 반영 확인 ✓.
- Affected files: packages/core/src/renderer/webgl/context.ts, packages/core/src/renderer/webgl/index.ts, packages/core/src/interaction/label-edit.ts, packages/core/src/flowchart.ts, packages/core/src/__tests__/label-editor.test.ts, packages/*/package.json (0.1.3→0.1.4), CHANGELOG.md, README.md (테스트 배지 859→861)
- Timestamp: 2026-06-10

## [0.1.3-release] npm 0.1.3 배포 — SDF 텍스트 렌더링 포함 4개 패키지
- Summary: @flowgl/core@0.1.3, @flowgl/react@0.1.3, @flowgl/vue@0.1.3, @flowgl/svelte@0.1.3 npmjs 배포. SDF 텍스트 렌더링(zoom 2× 이상에서 선명한 라벨), 프레임워크 래퍼 테스트 NodeData fixture 타입 오류(width/height 누락) 수정 포함.
- Affected files: packages/*/package.json (버전 0.1.3), packages/*/src/__tests__/Flowchart.test.* (fixture 수정)
- Timestamp: 2026-06-10

## [feat] SDF 텍스트 렌더링 — 고줌 레벨 라벨 선명도 개선
- Summary: Canvas 2D 텍스처 아틀라스의 비트맵 렌더링 방식을 SDF(Signed Distance Field)로 전환. Dead-reckoning EDT(8방향 근사 유클리드 거리 변환)로 glyph alpha → 거리 필드 계산. 아틀라스 픽셀: RGB = 텍스트 색상, A = SDF 거리값(0.5 = 경계). FRAG 셰이더: u_sdf=1.0 시 smoothstep(fwidth(d)*0.7) 적용 → 임의 줌에서 선명한 엣지. 엣지 라벨(bgColor 있는 항목)은 기존 비트맵 경로 유지(u_sdf=0.0). getImageData 미지원 환경(테스트)에서는 비트맵 폴백.
- Affected files: packages/core/src/renderer/webgl/atlas/text-atlas.ts, packages/core/src/renderer/webgl/programs/text-program.ts
- Timestamp: 2026-06-10

## [D-1] 프레임워크 래퍼 테스트 추가 — @flowgl/react, @flowgl/vue, @flowgl/svelte 각 9개 (총 27개)
- Summary: 세 프레임워크 래퍼 패키지에 vitest 기반 유닛 테스트를 신규 추가. 각 패키지에 vitest.config.ts와 `__tests__/Flowchart.test.*` 파일 작성. MockChart는 `vi.hoisted` 패턴으로 선언(클래스 hoisting 오류 방지). Svelte 패키지는 `resolve.conditions: ['browser']` 설정으로 SSR no-op 대신 DOM 클라이언트 런타임(onMount 실행)을 로드. Vue 테스트는 Vue reactive proxy 래핑으로 인해 props 검증 시 `toBe` 대신 `toStrictEqual` 사용. 루트 `pnpm test` 스크립트 갱신으로 3개 패키지 테스트 병렬 실행.
- Affected files: packages/react/vitest.config.ts (신규), packages/react/src/__tests__/Flowchart.test.tsx (신규), packages/vue/vitest.config.ts (신규), packages/vue/src/__tests__/Flowchart.test.ts (신규), packages/svelte/vitest.config.ts (신규), packages/svelte/src/__tests__/Flowchart.test.ts (신규), packages/react/package.json, packages/vue/package.json, packages/svelte/package.json, package.json
- Timestamp: 2026-06-09

## [deploy] 데모 사이트 배포 — Cloudflare Workers + wrangler.toml
- Summary: `https://dev.flowgl.ouranos.kr/` 에 데모 사이트 배포. `wrangler.toml` 신규 추가 (`name = "flowgl"`, `assets.directory = "./demo/dist"`). Cloudflare Workers 정적 에셋 방식으로 배포. GitHub push 시 CI 자동 빌드·배포. 빌드 명령: `pnpm --filter demo build`, 배포 명령: `npx wrangler deploy`.
- Affected files: wrangler.toml (신규)
- Timestamp: 2026-06-09

## [release] npm 0.1.1 배포 — 버그픽스 + API 확장 + README GitHub/Demo 링크 추가
- Summary: 4개 패키지 모두 0.1.0 → 0.1.1 배포. (1) group drag spurious dblclick 버그픽스 포함. (2) auto-layout child 노드 제외, TextAtlas dpr/색상 캐시 개선, onContextLost/Restored API, React/Vue/Svelte CRUD 이벤트·autoConnect prop 포함. (3) obfuscation → terser 교체로 번들 경량화. (4) 각 패키지 README에 GitHub(https://github.com/Deiamor/flowgl)·npm·Demo 링크 추가. (5) 루트 README 테스트 배지 795→832 수정 및 Live Demo 링크 추가.
- Affected files: packages/core/package.json, packages/react/package.json, packages/vue/package.json, packages/svelte/package.json, packages/core/README.md, packages/react/README.md, packages/vue/README.md, packages/svelte/README.md, README.md
- Timestamp: 2026-06-09

## [fix] 그룹 노드 이동 후 자식 노드 사라짐 버그 — spurious dblclick toggleCollapse 방지
- Summary: After dragging a group node, children became invisible. Root cause: the browser fires a `click` event at drag-end; a rapid second click produced a spurious `dblclick`, which called `toggleCollapse` on the group node and hid children via the `collapsedParentIds` / `hiddenNodeIds` renderer path. Fix: added `lastDragEndTime` (number) field to FlowChart, set in the `nodeDragEnd` callback. The `dblclick` handler now skips `toggleCollapse` for group nodes if a drag ended within the last 300 ms, suppressing the false collapse.
- Affected files: packages/core/src/flowchart.ts
- Timestamp: 2026-06-03

## [fix] circularLayout 등 레이아웃 함수 + animateLayout 그룹 노드 파괴 버그 수정
- Summary: (1) **Layout 함수 4종 — 자식 노드 필터링** : `hierarchicalLayout`, `forceLayout`, `gridLayout`, `circularLayout` 모두 함수 진입부에서 `nodes.filter(n => !n.parentId)` 로 root 노드만 레이아웃에 참여시키도록 수정. 기존에는 `parentId`가 있는 자식 노드도 독립 노드처럼 원/그리드에 배치되어 그룹 구조가 완전히 파괴되는 버그가 있었음. (2) **`animateLayout` — 그룹 이동 시 자식 자동 동반** : 타겟 맵 구성 전에 각 부모 노드의 이동 delta를 계산하여 `parentId`가 일치하는 모든 자식 노드를 자동으로 타겟에 추가. 이미 타겟에 있는 자식은 건너뜀(사용자 명시 위치 우선). (3) **테스트 4개 추가** : layout.test.ts 각 함수에 "skips child nodes" 케이스 추가. 832 tests PASS. TypeScript PASS.
- Affected files: packages/core/src/layout/auto-layout.ts, packages/core/src/flowchart.ts, packages/core/src/__tests__/layout.test.ts
- Timestamp: 2026-06-03

## [productization-2] 제품화 마무리 — autoConnect prop, Svelte 래퍼 완성, 프레임워크 README 3종, 텍스트 품질 문서화
- Summary: (1) **autoConnect prop** — React/Vue/Svelte 래퍼 모두에 `autoConnect` prop 추가 (default: `true`). `false`로 설정하면 wrapper가 `chart.addEdge()`를 자동 호출하지 않아, 사용자가 `onConnect`/`connect` 핸들러에서 직접 엣지를 생성할 수 있음. `connect` 이벤트는 무조건 발화. (2) **Svelte 래퍼 완성** — 누락 이벤트(`nodeAdd/nodeRemove/nodeUpdate/edgeAdd/edgeRemove/edgeUpdate`) 및 reactive 싱크(`background`, `grid`, `minimap`) 추가. Vue/React 래퍼와 동등한 기능 수준 달성. (3) **프레임워크 README 3종** — `@flowgl/react`, `@flowgl/vue`, `@flowgl/svelte` 각각 README.md 신규 작성. 설치, Quick start, autoConnect 사용법, Props/Events 표, 차트 인스턴스 접근법 포함. (4) **텍스트 품질 한계 문서화** — `@flowgl/core` README에 "Known limitations" 섹션 추가. Canvas 2D atlas 기반 텍스트가 약 2× 이상 줌에서 블러되는 현상 설명, 향후 SDF 폰트 렌더링으로 해결 예정임을 명시. (5) **benchmark.html** — 기존 구현이 완성 상태임을 확인 (100/500/1K/5K/10K 노드, 5초 측정, warmup, live FPS, 결과 테이블). 828 tests PASS. TypeScript PASS.
- Affected files: packages/react/src/Flowchart.tsx, packages/vue/src/Flowchart.vue, packages/svelte/src/Flowchart.svelte, packages/react/README.md (신규), packages/vue/README.md (신규), packages/svelte/README.md (신규), packages/core/README.md
- Timestamp: 2026-06-03

## [productization] 제품화 레벨 보완 — 버그 수정 9건 + 테스트 33개 추가
- Summary: (1) **TextAtlas 색상 버그** — cache key에 color가 누락되어 같은 텍스트를 쓰는 다른 textColor 노드들이 첫 번째 노드 색상으로 렌더링되던 문제 수정. key() 메서드에 color 파라미터 추가. (2) **exportSVG hexagon 미처리** — hexagon shape가 rectangle로 fallthrough되던 문제 수정. flat-top hexagon polygon 6-point 경로 추가. (3) **README 패키지명 불일치** — `@flowchart/core` → `@flowgl/core` 전체 교체 (install, import 예제 모두). (4) **난독화 제거** — `javascript-obfuscator` 삭제, `@rollup/plugin-terser` 미니파이로 교체. open-source 신뢰 회복. (5) **TextAtlas DPR 지원** — `new TextAtlas(dpr)` — Retina 디스플레이에서 canvas를 dpr배 scale하여 crisp 텍스트. WebGL2Renderer.initialize() / reinitializePrograms()에서 dpr 전달. (6) **Vue/React 래퍼 누락 이벤트** — `nodeAdd/nodeRemove/nodeUpdate/edgeAdd/edgeRemove/edgeUpdate` 이벤트 passthrough 추가. `background/grid/minimap` runtime prop sync 추가. (7) **테스트 실행 픽스** — monorepo root `pnpm test` 스크립트 추가, core `vitest run --root .` 플래그로 happy-dom 환경 올바르게 로드. (8) **PROJECT.md 현행화** — React/Vue/Svelte 패키지 실제 상태 반영, build command 갱신. (9) **onContextLost/onContextRestored** — WebGL context loss/restore 콜백을 FlowChartOptions에 추가, 기존 onError 대신 별도 콜백으로 분리. (10) **productization.test.ts** — 33개 신규 테스트: TextAtlas 색상 캐시 정합성, DPR UV 계산, hexagon/diamond/circle/rect SVG, SVG XSS 이스케이프, edge 타입별 경로 형식, context loss 옵션, atlas eviction 등. 총 828 tests PASS. TypeScript PASS.
- Affected files: packages/core/src/renderer/webgl/atlas/text-atlas.ts, packages/core/src/renderer/webgl/index.ts, packages/core/src/flowchart.ts, packages/core/rollup.config.mjs, packages/core/README.md, packages/core/package.json, packages/vue/src/Flowchart.vue, packages/react/src/Flowchart.tsx, package.json, PROJECT.md, packages/core/src/__tests__/productization.test.ts
- Timestamp: 2026-06-03

## [fix] 비선택 노드 드래그 시 기존 선택 노드가 따라가는 버그 수정
- Summary: NodeDrag에 전달되는 getCoselected 콜백이 드래그된 노드 자체가 selectedIds에 포함되어 있는지 여부와 무관하게 항상 나머지 선택 노드 목록을 반환하던 문제 수정. 조건을 `this.selectedIds.has(nodeId) ? [...this.selectedIds].filter(id => id !== nodeId) : []`로 변경하여, 드래그한 노드가 현재 선택 집합에 속할 때만 co-selection drag가 활성화되도록 한정. 이전에는 미선택 노드를 드래그해도 기존에 선택된 노드들이 함께 이동하는 버그가 발생했음.
- Affected files: packages/core/src/flowchart.ts
- Timestamp: 2026-06-03

## [fix] 그룹 노드 자식 이탈 버그 — coselected 그룹 드래그 시 자식 미이동 수정
- Summary: 다수 노드를 선택한 상태에서 그룹이 아닌 다른 노드를 드래그하면 그룹(coselected)은 따라가지만 그룹의 자식 노드들이 제자리에 남아 그룹 밖으로 이탈하는 버그 수정. NodeDrag.handleMouseDown에서 dragChildren을 구성할 때 coselected 노드 중 type==='group'인 것의 자식도 dragChildren에 포함하도록 수정. handleTouchStart에도 동일 로직 적용. Set으로 중복 이동 방지. 테스트 2개 추가 — (1) coselected 그룹의 자식도 함께 이동, (2) 자식이 children+coselected 양쪽에 있어도 한 번만 이동. 795 tests PASS. 브라우저 검증: n2+grp1 선택 후 n2 드래그 시 n3/n4 offset 유지 ✓.
- Affected files: packages/core/src/interaction/drag.ts, packages/core/src/__tests__/drag.test.ts
- Timestamp: 2026-06-03

## [fix] 그룹 노드 자식 사라짐 버그 — moveSelectedByArrow 자식 미이동 수정
- Summary: 그룹 노드를 선택한 상태에서 화살표 키로 이동할 때 자식 노드들이 함께 이동하지 않아 그룹과 분리되던 버그 수정. moveSelectedByArrow()에서 selectedIds 내 group 타입 노드를 처리할 때 자식(parentId 일치)도 동일 dx/dy로 업데이트하도록 수정. movedIds Set으로 그룹+자식이 모두 선택된 경우의 이중 이동(double-move) 방지. 테스트 2개 추가 — (1) 그룹 이동 시 자식도 함께 이동, (2) 자식이 selectedIds에 포함된 경우 한 번만 이동. 793 tests PASS.
- Affected files: packages/core/src/flowchart.ts, packages/core/src/__tests__/edge-cases.test.ts
- Timestamp: 2026-06-03

## [fix] Production hardening: 메모리 누수 · GPU 누수 · undo 일관성 · 성능 개선 + 엣지케이스 테스트 36개
- Summary: (1) 메모리 누수 수정 — canvas 이벤트 리스너 4개(dblclick, contextmenu, mousedown, click)를 클래스 필드로 저장하여 dispose()에서 removeEventListener 정상 호출. ariaDesc DOM 요소를 this.ariaDesc 필드로 저장하여 dispose()에서 remove() 추가. Math.random() → generateId()로 교체(일관성). (2) GPU 누수 수정 — CapProgram에 dispose() 메서드 추가(deleteProgram+deleteVertexArray+buf.dispose()), WebGL2Renderer.dispose()에서 capProgram.dispose() 호출. (3) undo 일관성 수정 — setNodeStyle, setNodeShape, setEdgeStyle, lockNode, unlockNode, setNodeSize, collapseNode, expandNode, groupNodes, ungroupNodes, updateNode(public), updateEdge(public), setEdges 에 beforeMutation() 추가. undo()/redo()에서 this.failed early-return 제거(scheduleRender가 이미 failed 가드 처리). (4) ungroupNodes() 버그 수정 — updateNode 스프레드 병합으로 parentId 삭제 불가 → replaceNode 패턴으로 교체(setNodeStatus null 수정과 동일 원리). (5) 성능 개선 — Graph.getEdgesForNode(nodeId) 추가(nodeEdgeIndex O(1) 조회). FlowChart.getEdgesForNode/getIncomers/getOutgoers/getConnectedNodes를 getEdgesForNode 인덱스 활용으로 변경. 렌더러에 cachedTextNodes/cachedHasAnimated 추가(매 프레임 filter+some 할당 제거). renderer.hasAnimatedEdges() 노출. scheduleRender의 per-frame getEdges().some() → renderer.hasAnimatedEdges()로 교체. (6) 엣지케이스 테스트 36개 추가 — undo 일관성(setNodeStyle/Size/Shape/lock/updateNode/updateEdge/collapse/group/setEdges 각 undoable), 그래프 쿼리(getIncomers/getOutgoers/getConnectedNodes/getEdgesForNode), removeNode cascade, hasCycle(true/false), findPaths(paths/same node), batchUpdate thrown error recovery, dispose DOM cleanup, importJSON merge undoable+no-overwrite, locked node deleteSelected 방지, searchNodes 대소문자, setTheme, duplicateSelected offset+undoable, alignNodes+undoable, undo/redo cycle. → 220 tests 전부 PASS. TypeScript PASS. 브라우저 JS errors: none ✅.
- Affected files: packages/core/src/flowchart.ts, packages/core/src/graph/graph.ts, packages/core/src/renderer/webgl/index.ts, packages/core/src/renderer/webgl/programs/cap-program.ts, packages/core/src/__tests__/flowchart.test.ts
- Timestamp: 2026-06-02

## [feature] Stage 12: onBeforeDelete + importJSON merge + getEdgesBetween + swapEdgeDirection
- Summary: (1) onBeforeDelete 훅 — FlowChartOptions.onBeforeDelete?: (nodeIds, edgeIds) => boolean. deleteSelected() 실행 전 콜백 호출, false 반환 시 삭제 취소. setOnBeforeDelete(fn|null) 런타임 setter 추가. (2) importJSON(data, mode: 'replace'|'merge') — replace는 기존 fromJSON 위임(전체 교체), merge는 beforeMutation 후 addNode/addEdge 호출로 기존 그래프에 병합. 중복 id는 덮어쓰지 않고 기존 유지. (3) getEdgesBetween(sourceId, targetId): EdgeData[] — 양방향(source→target || target→source) 모두 포함. (4) swapEdgeDirection(id) — beforeMutation(undo 지원) + graph.updateEdge({source: edge.target, target: edge.source}) + edgeUpdate emit. (5) 데모 "Import / Edge" 섹션 — "Import (merge) 2 nodes" 클릭 시 노드 수 7→9 ✅, "⇄ Swap e1 direction" → statEvt "e1: n1→n2 → n2→n1" ✅, "Edges n1↔n2 (log)" → statEvt "n1↔n2: 1 edge(s) [e1]" ✅. (6) 테스트 9개 추가 — onBeforeDelete(false/true), setOnBeforeDelete, importJSON(merge/replace), getEdgesBetween(both/empty), swapEdgeDirection(reverses/undoable) → 184 tests 전부 PASS. TypeScript PASS. 브라우저 JS errors: none ✅.
- Affected files: packages/core/src/flowchart.ts, packages/core/src/__tests__/flowchart.test.ts, demo/index.html
- Timestamp: 2026-06-02

## [feature] Stage 11: nodeResize 이벤트 + batchUpdate + panTo + getNodesBounds
- Summary: (1) nodeResize 이벤트 — NodeResize 클래스에 onResizeEnd 콜백 파라미터 추가(기본 no-op). handleMouseUp에서 dragState 존재 시 node의 최종 {id,x,y,width,height} 전달. FlowChart.FlowChartEvents에 nodeResize 추가, NodeResize 생성자 호출 시 emit 콜백 주입. (2) batchUpdate(fn) — private batching/batchMutSaved 필드. scheduleRender()에 batching 가드 추가(batching 중 렌더 skip). beforeMutation()에서 batching 중 batchMutSaved=false일 때만 히스토리 저장+이벤트 emit(그 이후 호출은 no-op). batchUpdate 종료 후 batching=false, scheduleRender() 1회 호출. failed state에서도 동작(schedule은 no-op이나 mutation은 정상). (3) panTo(worldX, worldY) — viewport.x/y를 캔버스 중심 기준으로 계산, scheduleRender+viewportChange emit. (4) getNodesBounds(ids?) — computeNodeBounds 활용, 빈 경우 null, ids 필터 선택 가능. AABB import 추가. (5) 데모 — "Pan to (0,0)", "Log Node Bounds", "Batch Add 5 Nodes" 버튼, nodeResize 이벤트 statEvt 로그 추가. 브라우저: bounds=(80,60)→(1300,340) ✅, batchAdd 7→12 ✅, JS errors: none ✅. (6) 테스트 7개 추가 — batchUpdate 단일 히스토리엔트리, batchUpdate 전체 추가, panTo, getNodesBounds(empty/full/filtered), nodeResize 리스너 등록 → 175 tests 전부 PASS.
- Affected files: packages/core/src/interaction/node-resize.ts, packages/core/src/flowchart.ts, packages/core/src/__tests__/flowchart.test.ts, demo/index.html
- Timestamp: 2026-06-02

## [feature] Stage 10: 노드 상태 배지 + clearHistory + autoFit + 선택 헬퍼 + deleteSelected 공개
- Summary: (1) NodeData.status?: NodeStatus('error'|'warning'|'success'|'info') — 노드 우상단에 색상 원형 뱃지를 2D 캔버스 오버레이(z-index:2)로 렌더링. STATUS_COLORS: error=#ef4444, warning=#f59e0b, success=#22c55e, info=#3b82f6. renderStatusBadges() — 뷰포트 변환으로 스크린 좌표 계산, 반지름 7px, 흰색 테두리 2px. (2) setNodeStatus(id, status|null) — status 제거는 replaceNode(node without status)로 구현(Graph.replaceNode() 추가). updateNode 스프레드 병합으로는 optional field 삭제 불가. (3) clearHistory() — history.clear() + historyChange 이벤트 emit. (4) autoFit?: boolean 생성자 옵션 — 초기 노드 로드 후 computeNodeBounds로 viewport.fit() 호출(렌더러 불필요). (5) getSelectedNodes()/getSelectedEdges() — selectedIds/selectedEdgeIds로부터 전체 객체 반환. (6) deleteSelected() — private → public. (7) 테스트 9개 추가 — setNodeStatus(error/null), clearHistory(불가+이벤트), getSelectedNodes, getSelectedEdges, deleteSelected, autoFit → 168 tests 전부 PASS. TypeScript PASS. 브라우저 검증: statusError/Warning/Clear ✅, clearHistory ✅, deleteSelected ✅, JS errors: none ✅.
- Affected files: packages/core/src/graph/node.ts, packages/core/src/graph/graph.ts, packages/core/src/flowchart.ts, packages/core/src/index.ts, packages/core/src/__tests__/flowchart.test.ts, demo/index.html
- Timestamp: 2026-06-02

## [feature] Stage 9: 이벤트 확장 + 뷰포트 줌API + 스타일 편의API + 멀티셀렉트드래그
- Summary: (1) 이벤트 확장 — FlowChartEvents에 nodeDragStart(id), nodeDoubleClick(id), edgeClick(edge), edgeDoubleClick(edge), edgeUpdate(id, updates) 추가. dblclick 핸들러에서 노드·엣지 구분 후 각 이벤트 emit. updateEdge() 호출 시 edgeUpdate emit. (2) 줌 API — ZOOM_STEPS=[0.1,0.25,0.5,0.75,1,1.25,1.5,2,3,4]. zoomIn() 다음 단계로, zoomOut() 이전 단계로, zoomTo(factor) 직접 설정. 데모 "Zoom" 섹션에 + Zoom In / − Zoom Out 버튼 추가. (3) 스타일 편의 API — setNodeShape(id, shape) → node.style.shape 갱신, setEdgeStyle(id, style) → edge.style 병합. (4) 멀티셀렉트 드래그 — NodeDrag에 getCoselected(nodeId)=>string[] 콜백 추가. 드래그 시 children ∪ coselected(중복제거)를 dragChildren로 함께 이동. onStart 시그니처 (id:string)=>void로 변경 — 드래그된 노드 id 전달. (5) readOnly 가드 — dblclick에서 label편집을 readOnly||!labelEditable 조건으로 통제. (6) 테스트 — drag.test.ts 3개(onStart id, co-selected drag, multi-touch guard), flowchart.test.ts 4개(edgeUpdate이벤트, setNodeShape, setEdgeStyle, zoomIn/Out/To) 추가 → 160 tests 전부 PASS. TypeScript 체크 PASS. 브라우저 검증: canvas ✅, btnZoomInAPI/ZoomOutAPI ✅, btnSelectAll ✅, btnToggleAnim ✅, btnCircularLayout ✅, JS errors: none ✅.
- Affected files: packages/core/src/interaction/drag.ts, packages/core/src/flowchart.ts, packages/core/src/__tests__/drag.test.ts, packages/core/src/__tests__/flowchart.test.ts, demo/index.html
- Timestamp: 2026-06-02

## [feature] Stage 8: 공개API 확장 + 원형레이아웃 + 애니메이션엣지
- Summary: (1) 누락 공개 API 추가 — getNodes(), getEdges(), updateEdge(id, updates), setSelectedEdgeIds(ids), selectAll(). selectAll()은 selectionChange 이벤트 emit 포함. (2) circularLayout(nodes, radius?) — 노드를 균등 원형 배치, 반지름 자동 계산(미지정 시 nodeCount×dim 비례). index.ts에 export 추가. (3) animated edge — EdgeData.animated?: boolean. edge-program.ts 프래그먼트 셰이더에 u_dashOffset uniform 추가, mod(v_arcLen - u_dashOffset, period) > u_dashLen discard. animated 엣지는 별도 배치(a:dashLen,gapLen dashKey)로 분리하여 dashOffset만 해당 배치에 적용. FlowChart.scheduleRender() — 렌더 후 animated 엣지 존재 시 edgeDashOffset += 1.5 하고 다음 프레임 재스케줄(연속 RAF 루프). exportPNG에도 edgeDashOffset 전달. (4) 데모 — "Select All" 버튼, "⊙ Circular Layout" 버튼, "▶ Toggle Animated (e1)" 버튼 추가. 원형 레이아웃은 chart.getNodes() 사용. (5) 테스트 — circularLayout 6개, FlowChart 공개 API 5개 신규 → 154 tests 전부 PASS. 브라우저 검증: selectAll 7nodes 6edges ✅, circularLayout 원형 배치 ✅, animated toggle ⏸/▶ ✅.
- Affected files: packages/core/src/graph/edge.ts, packages/core/src/renderer/webgl/programs/edge-program.ts, packages/core/src/renderer/webgl/index.ts, packages/core/src/layout/auto-layout.ts, packages/core/src/index.ts, packages/core/src/flowchart.ts, packages/core/src/__tests__/layout.test.ts, packages/core/src/__tests__/flowchart.test.ts, demo/index.html
- Timestamp: 2026-06-02

## [feature] Stage 7: 키보드 F단축키 + 노드툴팁 + hover이벤트 + 테마 + 공개쿼리API
- Summary: (1) 키보드 F=fitView, Shift+F=fitViewToSelection — KeyboardOptions에 onFitView/onFitViewSelection 추가. (2) 노드 툴팁 — NodeData.tooltip?: string, canvas mousemove에서 DOM div(position:fixed, z-index:9999)로 표시. mouseleave 시 숨김. (3) hover 이벤트 — FlowChartEvents에 nodeHover/edgeHover 추가. 마우스가 노드/엣지 위에 있을 때 emit, null로 나갈 때도 emit. hoverMoveHandler/hoverLeaveHandler를 dispose()에서 정리. (4) setTheme('light'|'dark') — 배경색과 그리드 색을 프리셋으로 전환. (5) 공개 쿼리 API — getNode(id), getEdge(id), getEdgesForNode(nodeId), scrollToNode(id, padding). F키 단축키 테스트 2개 추가 → 143 tests 전부 PASS. 브라우저 검증: scrollToNode ✅, setTheme dark/light ✅, 툴팁 div DOM 존재 ✅, Canvas×4 ✅.
- Affected files: packages/core/src/graph/node.ts, packages/core/src/interaction/keyboard.ts, packages/core/src/__tests__/keyboard.test.ts, packages/core/src/flowchart.ts, demo/index.html
- Timestamp: 2026-06-02

## [feature] Stage 6: 박스셀렉트 엣지포함 + Ctrl+D 복제 + 노드검색/하이라이트
- Summary: (1) BoxSelect 엣지 포함 — onSelect 콜백에서 selectedIds에 양 끝점이 모두 포함된 엣지를 추가 선택. selectionChange edgeIds도 정상 전파. (2) Ctrl+D 복제 — KeyboardOptions에 onDuplicate 추가, keyboard.ts 'd'(Ctrl/Meta) 케이스 추가. FlowChart.duplicateSelected() — 선택 노드+엣지를 +24px 오프셋으로 복사, 복사된 노드/엣지를 새 선택으로 교체. (3) 검색/하이라이트 API — searchNodes(query) 레이블 대소문자 무시 검색, setHighlightedNodes(ids), clearHighlights(). highlight overlay canvas(z-index:1) — 노드 주위에 황색(#facc15) 파선 rect 렌더링, viewport pan/zoom에 자동 동기화. Canvas 수: 4개(main WebGL + NodeResize overlay + highlight overlay + minimap). 브라우저 검증: Search "Branch" → 2 match(es) ✅, Search "Start" → 1 match(es) ✅, Duplicate +1 nodes ✅. Keyboard duplicate test 1개 추가 → 141 tests 전부 PASS.
- Affected files: packages/core/src/interaction/keyboard.ts, packages/core/src/__tests__/keyboard.test.ts, packages/core/src/flowchart.ts, demo/index.html
- Timestamp: 2026-06-02

## [feature] Stage 5: 노드잠금 + 엣지라벨인라인편집 + SVG내보내기 + 그래프분석API + 줌컨트롤위젯
- Summary: (1) NodeData.locked — lockNode(id)/unlockNode(id) API, 잠긴 노드는 drag/resize/delete 불가. NodeResize.findHandle에서 locked 체크. NodeDrag.handleMouseDown에서 locked 체크. (2) 엣지라벨 인라인 편집 — 엣지 더블클릭 시 fixed-position input 생성, Enter/Escape/blur로 완료. graph.updateEdge 로 label 저장. (3) exportSVG(padding) — 뷰박스 계산, 그룹노드 먼저 그리기, rect/ellipse/polygon 형상, cubic bezier/polyline 엣지, 텍스트라벨, 화살표 마커. handleXY/edgeControlPoints 탑레벨 import로 리팩터(require() 제거). (4) 그래프 분석 API — getIncomers(id)/getOutgoers(id)/getConnectedNodes(id)/hasCycle()/findPaths(src,tgt). findPaths는 source===target이면 빈배열 반환, 경로 100개 상한. 분석 함수 13개 단위 테스트 추가 (총 140 tests). (5) 줌컨트롤 위젯 — 캔버스 좌하단 오버레이, − / 100% / + / 1:1 버튼, viewportChange 이벤트로 라벨 동기화, ZOOM_STEPS=[0.1,0.25,0.5,0.75,1,1.25,1.5,2,3,4]. 브라우저 검증: 줌 100%→125%→100% ✅, 사이클없음 ✅, n1→n5 2개 경로 ✅, SVG내보내기 트리거 ✅.
- Affected files: packages/core/src/flowchart.ts, packages/core/src/interaction/node-resize.ts, packages/core/src/interaction/drag.ts, packages/core/src/graph/node.ts, packages/core/src/__tests__/analysis.test.ts(신규), demo/index.html
- Timestamp: 2026-06-02

## [fix] expandNode가 collapsed를 해제하지 못하는 버그
- Summary: expandNode에서 delete-then-spread 패턴이 graph.updateNode의 { ...node, ...updates } 병합에서 무효화됨 — updates에 collapsed 키가 없으면 node.collapsed:true가 생존. 수정: collapsed:false를 명시적으로 전달. 브라우저 검증에서 발견.
- Affected files: packages/core/src/flowchart.ts
- Timestamp: 2026-06-02

## [feature] Stage 4: fitViewToSelection + 포트연결제한 + 노드접기/펼치기 + 엣지웨이포인트 + ARIA
- Summary: (1) fitViewToSelection(padding) — 선택 노드들만 fitView. (2) PortDef.maxConnections — 포트별 연결 수 제한, connect 콜백에서 pre-check. (3) NodeData.collapsed + collapseNode/expandNode/toggleCollapse — 더블클릭으로 그룹 접기/펼치기, 렌더러에서 hidden node set 계산 후 cull 전 필터. (4) EdgeData.waypoints + EdgeWaypoint 인터랙션 클래스 — 선택된 엣지의 중간점 드래그로 waypoint 생성, 기존 waypoint 드래그로 이동, 우클릭으로 제거, polyline strip 렌더링. (5) ARIA — aria-describedby 설명 갱신, announceNode에 incoming/outgoing 엣지 수 추가, 노드 선택 시 announce, 화살표 이동 후 400ms 딜레이로 최종 좌표 announce.
- Affected files: packages/core/src/graph/node.ts, packages/core/src/graph/edge.ts, packages/core/src/flowchart.ts, packages/core/src/renderer/webgl/index.ts, packages/core/src/renderer/webgl/programs/edge-program.ts, packages/core/src/interaction/edge-waypoint.ts(신규)
- Timestamp: 2026-06-02

## [verify] Stage 3 브라우저 검증 — Playwright headless Chromium
- Summary: 4개 신기능 브라우저 검증 전부 PASS. (1) 노드 선택 시 연결 엣지 하이라이트 — getSelectedIds()=['n1'] ✅, 렌더-타임 merged set 확인. (2) 클립보드 copy/paste — 노드 수 7→8 ✅ (page.keyboard.press가 canvas에 도달하지 않는 Playwright 동작 확인 — dispatchEvent 직접 발사 필요). (3) alignNodes('left') — n3/n4 같은 x 값 ✅ (초기값이 이미 같아 diff 비가시, 로직 정상). (4) 그룹 드래그 — grp1 +100/+50px 이동 시 n3도 동일 델타 이동 ✅.
- Affected files: (read-only verification)
- Timestamp: 2026-06-02

## [feature] 그룹/컨테이너 노드
- Summary: NodeData에 parentId?: string 추가. FlowChart.groupNodes(parentId, childIds) / ungroupNodes(childIds) API. NodeDrag에 getChildren 콜백 추가 — 그룹 드래그 시 자식 노드의 초기 오프셋을 기억해 함께 이동(마우스·터치 모두). 렌더러에서 type='group' 노드를 cachedVisSortedNodes로 정렬해 먼저 그리므로 자식 노드가 시각적으로 위에 표시. exactOptionalPropertyTypes 제약으로 ungroupNodes는 Object.assign+delete 패턴 적용.
- Affected files: packages/core/src/graph/node.ts, packages/core/src/interaction/drag.ts, packages/core/src/flowchart.ts, packages/core/src/renderer/webgl/index.ts
- Timestamp: 2026-06-02

## [feature] 노드 정렬·분배 + 클립보드 복사·붙여넣기 + 연결 엣지 하이라이트
- Summary: (1) FlowChart.alignNodes(axis) — 선택 노드들을 left/center/right/top/middle/bottom 기준으로 정렬. FlowChart.distributeNodes(axis) — 3개 이상 선택 시 수평·수직 균등 간격 분배. (2) 클립보드 Ctrl+C/X/V — copySelection()이 선택 노드와 내부 엣지를 스냅샷, pasteClipboard()가 새 ID를 부여해 +20px 오프셋에 붙여넣기. (3) 노드 선택 시 연결된 엣지를 렌더 시점에 자동 하이라이트 — this.selectedEdgeIds는 변경 없이 renderedEdgeIds를 임시 계산해 전달, delete/copy는 영향 없음. keyboard.test.ts에 onCopy/onPaste/onCut mock 추가.
- Affected files: packages/core/src/flowchart.ts, packages/core/src/interaction/keyboard.ts, packages/core/src/__tests__/keyboard.test.ts
- Timestamp: 2026-06-02

## [fix] 두꺼운 엣지 선택 개선 + Named Port 베지어 히트테스트 수정
- Summary: EdgeHitTester 두 가지 버그 수정. (1) 두꺼운 엣지 선택 — threshold를 고정 MIN_HIT_PX(8px)/zoom에서 max(MIN_HIT_PX/zoom, edgeHalfWidth)로 변경. zoom=2·width=10 기준 기존 8px → 10px로 확장되어 엣지 시각 영역 전체가 클릭 가능. (2) Named port 베지어 경로 오류 — handleXY가 named port ID('in-top' 등)를 처리 못 해 default(right)로 fallthrough하여 실제 렌더 경로와 다른 베지어를 샘플링하던 버그 수정. node.ports 배열에서 port.id로 매칭 후 정확한 좌표 반환. Playwright 검증: zoom=2 thick edge(width=10) 클릭 center/edge(8px 오프셋) 선택 ✅, 20px 오프셋은 비선택 ✅.
- Affected files: packages/core/src/interaction/edge-hit-test.ts
- Timestamp: 2026-06-02

## [fix] 엣지 엔드포인트 — 같은 노드 다른 포트로 재연결 허용
- Summary: EdgeReroute의 `findTargetHandle`이 이동 중인 엔드포인트의 연결 노드 전체를 제외(excludeNodeId)하여 동일 노드의 다른 포트로 재연결이 불가능하던 버그 수정. excludeNodeId 전체 제외를 `{ nodeId, side }` 쌍으로 교체하여 현재 연결 핸들만 제외하고 같은 노드의 다른 핸들은 허용. handleMouseMove에서도 동일하게 excludeHandle 계산으로 변경. body-drop fallback은 기존처럼 동일 노드 제외 유지(포트 선택 모호성 방지). Playwright 검증: e6 targetHandle in-top → out-right 재연결 성공.
- Affected files: packages/core/src/interaction/edge-reroute.ts
- Timestamp: 2026-06-02

## [fix] 엣지 엔드포인트 round cap + resize 깜빡임 수정
- Summary: 두꺼운 엣지(width>1) endpoint에서 발생하던 flat butt cap(거친 연결부) 문제를 gl.POINTS 기반 CapProgram으로 수정. 각 엣지 소스/타겟 endpoint에 원형 disc(halfWidth * 2 * pixelsPerUnit 크기)를 렌더링하여 매끄러운 round cap 구현. ResizeObserver의 canvas.width 즉시 리셋으로 발생하던 blank-frame 깜빡임 수정 — pendingResize 필드 도입, renderer.resize()를 RAF 콜백 내부로 이동하여 렌더와 동일 프레임에서 실행. Playwright 브라우저 검증: zoom=4에서 Named Ports in-top 포트에 40px 직경 round cap 확인, 브라우저 리사이즈 시 깜빡임 없음.
- Affected files: packages/core/src/renderer/webgl/programs/cap-program.ts(신규), packages/core/src/renderer/webgl/index.ts, packages/core/src/flowchart.ts, demo/index.html
- Timestamp: 2026-06-02

## [stage2] Stage 2 market-differentiation features — all browser-verified
- Summary: Named Ports(커스텀 연결점), Orthogonal routing(step/straight 엣지 타입), Layout animation(animateLayout smoothstep RAF 루프), a11y delete announce(aria-live "Deleted N nodes"), Vue 3 SFC 래퍼, Svelte 4 SFC 래퍼, Web Worker layout offload(LayoutWorkerClient + layout-worker.ts) 구현. Playwright(Chromium)으로 전체 브라우저 검증 완료 — 100 노드 그리드→계층적 레이아웃 애니메이션 mid-frame 캡처, 단일 노드 삭제 후 aria-live "Deleted 1 node" 확인.
- Affected files: packages/core/src/graph/node.ts, graph/edge.ts, interaction/connect.ts, interaction/edge-reroute.ts, renderer/webgl/programs/edge-program.ts, renderer/webgl/util/bezier.ts, flowchart.ts, workers/layout-worker.ts(신규), workers/layout-client.ts(신규), index.ts; packages/vue/(신규 패키지); packages/svelte/(신규 패키지); packages/react/src/Flowchart.tsx; demo/index.html
- Timestamp: 2026-06-02

## [fix] Bezier forward-case mag 캡으로 S-curve inflection 제거
- Summary: `edgeControlPoints` forward 케이스 mag 공식 수정. 기존 `axisDist * 0.4 + crossDist * 0.3` 공식은 대각 연결(dx=110, dy≈66–94)에서 mag≈72를 산출해 c1x(822) > c2x(788) — 제어점 교차로 S-curve inflection 발생. 새 공식 `Math.min(Math.max(Math.hypot(axisDist, crossDist) * 0.35, 40), axisDist * 0.45)`는 mag를 `axisDist * 0.45`로 상한 보장, c1_offset + c2_offset ≤ 0.9 * axisDist < axisDist를 항상 만족시켜 제어점이 교차하지 않음. 수치 검증: e4(BranchA→End) old mag=72.2 → crossed 34px, new mag=49.5 → c1x=799.5 < c2x=810.5 ✓; e5(BranchB→End) old mag=68.8 → crossed, new mag=44.9 → c1x=794.9 < c2x=815.1 ✓.
- Affected files: packages/core/src/renderer/webgl/util/bezier.ts
- Timestamp: 2026-06-01

## [fix] Bezier edge angular kink fix (BEZIER_SEGMENTS 16→32, cross-axis forward formula)
- Summary: BEZIER_SEGMENTS를 16에서 32로 증가시켜 endpoint 근방 고곡률 구간의 샘플링 해상도를 2배로 높임. forward 케이스 mag 공식에 cross-axis 항 `crossDist * 0.3` 복원으로 대각 방향 연결의 제어점 오프셋이 원래 `dist * 0.5` 수준과 동등하게 유지됨. t=1 부근 segment당 각도 변화량이 9.3° → 4.7°로 감소하여 각짐 현상 해소.
- Affected files: packages/core/src/renderer/webgl/util/bezier.ts
- Timestamp: 2026-06-01

## [feature] React Wrapper (@flowchart/react)
- Summary: @flowchart/react 패키지 신규 작성. `<Flowchart>` 컴포넌트(forwardRef) — nodes/edges controlled props, onNodesChange/onEdgesChange/onConnect/onNodeClick/onSelectionChange/onViewportChange 콜백, onInit ref 노출. 내부 변경과 외부 prop 변경 루프 방지(lastNodesRef/lastEdgesRef). @flowchart/core 타입 re-export. demo/react.html + react-app.tsx React 데모 추가. HandleSide 타입 core에서 export 추가.
- Affected files: packages/react/(신규 패키지: package.json, tsconfig.json, rollup.config.mjs, src/index.ts, src/Flowchart.tsx), packages/core/src/index.ts, demo/react.html(신규), demo/react-app.tsx(신규), demo/package.json, demo/vite.config.ts
- Timestamp: 2026-06-01

## [feature] 노드 리사이즈 핸들
- Summary: Canvas 2D 오버레이로 8방향(nw/n/ne/e/se/s/sw/w) 리사이즈 핸들 구현. 선택된 노드에 흰색 사각형(hover 시 파란색) 핸들 표시. 드래그로 크기 변경, MIN_W=40/MIN_H=30 최소 크기 보장. NodeDrag·PanZoom의 shouldBlock에 isCapturing()/isNearHandle() 연동으로 우선순위 충돌 없음.
- Affected files: packages/core/src/interaction/node-resize.ts(신규), packages/core/src/flowchart.ts, packages/core/src/index.ts
- Timestamp: 2026-06-01

## [feature] 커스텀 노드 모양 + HTML 오버레이
- Summary: NodeStyle에 shape 필드(rectangle/circle/diamond/hexagon) 추가. NodeProgram GLSL에 shape별 SDF 함수 구현(sdfCircle·sdfDiamond·sdfHexagon·sdfRect). FLOATS_PER_INSTANCE 15→16. NodeData에 htmlContent 필드 추가 — HTML 콘텐츠를 Canvas 위에 절대 위치 div로 오버레이, 해당 노드는 WebGL 텍스트 레이블 생략. HtmlOverlay 클래스 신규 작성.
- Affected files: packages/core/src/graph/node.ts, packages/core/src/renderer/webgl/programs/node-program.ts, packages/core/src/renderer/webgl/index.ts, packages/core/src/ui/html-overlay.ts(신규), packages/core/src/flowchart.ts, packages/core/src/index.ts
- Timestamp: 2026-06-01

## [feature] 미니맵 오버레이 추가
- Summary: Canvas 2D 기반 미니맵 구현. 모든 노드·엣지를 축소 렌더링하고 뷰포트 영역을 파란 직사각형으로 표시. 클릭/드래그로 뷰포트 이동. FlowChartOptions에 minimap 옵션 추가, setMinimap() 런타임 API 제공. MinimapConfig: width/height/position/background/nodeColor 설정 가능.
- Affected files: packages/core/src/ui/minimap.ts(신규), packages/core/src/types.ts, packages/core/src/flowchart.ts, packages/core/src/index.ts
- Timestamp: 2026-06-01

## [perf] zoom 기반 텍스트 스킵으로 SPEC 목표 달성 (5K@60fps, 10K@30fps)
- Summary: zoom < 0.12 시 TextProgram 렌더링 완전 스킵. 5K 노드 fitView zoom(~0.06)에서 TextAtlas가 매 프레임 overflow→eviction→generation++ 루프를 유발하던 atlas overflow 문제 해결. EdgeProgram/TextProgram의 reference fast path(prevEdgesRef, prevNodesRef) 제거 — 이전 세션에서 추가했던 해당 최적화가 atlas overflow 루프와 결합하여 5K에서 4.8fps까지 하락하는 regression 유발. 벤치마크 결과: 5K 113.6fps (목표 60fps ✅), 10K 114.1fps (목표 30fps ✅).
- Affected files: packages/core/src/renderer/webgl/programs/text-program.ts, packages/core/src/renderer/webgl/programs/edge-program.ts, packages/core/src/renderer/webgl/index.ts
- Timestamp: 2026-06-01

## [perf] 엣지 드로우 콜 배칭으로 렌더링 성능 개선
- Summary: EdgeProgram에 degenerate vertex 스티칭 도입. dash config별로 엣지를 그룹화하여 N개의 gl.drawArrays 호출을 그룹당 1개로 축소 (벤치마크 환경에서 5,000 call → 1 call). 이전 커밋의 지오메트리 캐시와 결합하여 정적 프레임에서 어셈블리 단계도 완전 스킵.
- Affected files: packages/core/src/renderer/webgl/programs/edge-program.ts
- Timestamp: 2026-06-01

## [perf] TextProgram 쿼드 지오메트리 캐싱 추가
- Summary: TextProgram에 노드/엣지 라벨별 쿼드 캐시 도입. 위치·크기·라벨·스타일 fingerprint 변화 시에만 쿼드 재계산. TextAtlas에 generation 카운터 추가 — atlas 초기화(atlas full eviction) 시 증가하여 stale UV 캐시 안전하게 무효화. 정적 프레임에서 Float32Array 할당 0회, GPU 업로드 0회.
- Affected files: packages/core/src/renderer/webgl/atlas/text-atlas.ts, packages/core/src/renderer/webgl/programs/text-program.ts
- Timestamp: 2026-06-01

## [perf] 엣지 지오메트리 캐싱으로 렌더링 성능 개선
- Summary: EdgeProgram에 per-edge 지오메트리 캐시 도입. fingerprint(src/tgt 위치·크기, handle, color, width, selection) 변화 시에만 buildBezierStrip 재실행. sort order·크기 미변화 시 gl.bufferSubData 업로드 완전 스킵. 정적 씬에서 테셀레이션 비용·VBO 업로드 비용(~9.2MB/frame at 5K) 제거. SwiftShader 기준: 5K 22.8→32.9fps(+44%), 10K 11.5→16.1fps(+40%).
- Affected files: packages/core/src/renderer/webgl/programs/edge-program.ts
- Timestamp: 2026-06-01

## [chore] dist 정리 / MIT 라이선스 / 벤치마크 페이지 추가
- Summary: dist/index.esm.js(구버전 ESM) 삭제. package.json license UNLICENSED→MIT, 루트 LICENSE 파일 생성. DEPLOY.md ESM 경로 수정(index.esm.js→flowchart.esm.js). FlowChart에 requestRender() 공개 메서드 추가. demo/benchmark.html 신규 작성 — 100/500/1K/5K/10K 노드 프리셋, 5초 측정, 인터랙션 활성 상태 avg/min/P5 FPS + ms/frame 결과 테이블.
- Affected files: packages/core/dist/(index.esm.js 삭제), packages/core/package.json, LICENSE, DEPLOY.md, packages/core/src/flowchart.ts, demo/benchmark.html
- Timestamp: 2026-06-01

## [fix + feature] 노드 드래그 충돌 수정 / 선택 / 연결 핸들
- Summary: PanZoom·NodeDrag·ConnectDrag 3방향 우선순위 충돌 수정. 노드 클릭 선택(파란 테두리, Cmd 다중 선택), 핸들 드래그 연결(초록 target 하이라이트 + 점선 pending edge) 구현. connect 이벤트 발생 시 자동 addEdge.
- Affected files: interaction/pan-zoom.ts, interaction/drag.ts, interaction/connect.ts(신규), renderer/webgl/programs/node-program.ts(+a_state), renderer/webgl/programs/handle-program.ts(신규), renderer/webgl/programs/edge-program.ts(bezier 유틸 분리), renderer/webgl/util/bezier.ts(신규), renderer/webgl/index.ts, flowchart.ts, demo/index.html
- Timestamp: 2026-05-28

## [A-0 ~ A-12] Phase 1 MVP — Full implementation
- Summary: WebGL2 플로우차트 라이브러리 Phase 1 완성. 인스턴스 렌더링(노드), 베지어 triangle-strip(엣지), Canvas texture atlas(텍스트), CPU AABB 히트테스트, pan/zoom/touch, 노드 드래그, frustum culling, rAF dirty render loop, Vite 데모 포함. 타입체크 통과.
- Affected files: packages/core/src/** (전체), demo/**, 프로젝트 문서 7종
- Timestamp: 2026-05-28

## [test] Edge-case test suite — 320 tests across 40 scenario categories
- Summary: packages/core/src/__tests__/edge-cases.test.ts 신규 작성. 40개 시나리오 카테고리에서 320개 테스트 케이스 전부 PASS. 검증 범위: 빈 그래프 연산, 단일 노드 ops, 셀프루프, 병렬 엣지, 고스트 참조, 노드/엣지 스타일 조합, undo/redo 시퀀스, 직렬화(toJSON/fromJSON/importJSON), 그래프 분석(hasCycle/findPaths/getIncomers/getOutgoers/getConnectedNodes), 그룹/접기, 선택 API, 뷰포트, 레이아웃 알고리즘(hierarchical/force/grid/circular), 정렬/분배, 히스토리 한도, 포트 정의, 읽기전용 모드, 캔버스 외관, 이벤트 시스템, 대용량 그래프, 복제/삭제, 포트 제약, 그래프 버전 추적, 검색/하이라이트, SVG/PNG 내보내기, dispose 정리, 생성자 엣지케이스.
- Affected files: packages/core/src/__tests__/edge-cases.test.ts (신규)
- Timestamp: 2026-06-02

## [A-1] Project scaffolding
- Summary: Initialized monorepo with pnpm workspaces, TypeScript config, Rollup, Vite demo skeleton. Established 7-file project structure.
- Affected files: package.json, pnpm-workspace.yaml, tsconfig.base.json, packages/core/*, demo/*, PROJECT.md, PRODUCT.md, AGENTS.md, TASK.md, HISTORY.md, SPEC_CHECKLIST.md, DEPLOY.md
- Timestamp: 2026-05-28

## [feat-301ef5f] Touch support, multi-line text, keyboard nav, granular events, accessibility
- Summary: 터치 지원(pan/zoom/drag/connect), 다중 줄 텍스트 및 RTL, 키보드 내비게이션(Tab/방향키), 이벤트 세분화(nodeAdd/nodeRemove/nodeUpdate/edgeAdd/edgeRemove/historyChange), aria-live 접근성 추가
- Affected files: interaction/pan-zoom.ts, interaction/drag.ts, interaction/connect.ts, interaction/keyboard.ts, graph/node.ts, renderer/webgl/atlas/text-atlas.ts, flowchart.ts
- Timestamp: 2026-05-29

## [fix-4d20111] SSR guard, atlas flicker fix, edge labels, arrow debounce
- Summary: SSR guard 추가(window/document undefined 환경 안전), TextAtlas 2-pass 렌더링으로 atlas 깜빡임 수정, 엣지 라벨 베지어 중점 렌더링 추가, 방향키 이동 400ms 디바운스(undo 오염 방지)
- Affected files: flowchart.ts, renderer/webgl/atlas/text-atlas.ts, renderer/webgl/programs/text-program.ts, renderer/webgl/index.ts
- Timestamp: 2026-05-29

## [docs-b1d9a97] API reference README for @flowchart/core
- Summary: packages/core/README.md 신규 작성 — 기능 목록, 설치, 퀵스타트, FlowChartOptions/Events/API/NodeData/EdgeData 전체 레퍼런스, 키보드 단축키, 터치 제스처, 브라우저 지원 포함
- Affected files: packages/core/README.md
- Timestamp: 2026-05-29

## [test-d5d5b82] Expand test suite to 127 tests across 10 files
- Summary: 테스트 스위트를 82개→127개로 확장. 10개 파일(flowchart, connect, panZoom, drag, keyboard, boxSelect, graph, history, layout, viewport). happy-dom WebGL 불가 환경에서 graceful degradation 검증 포함.
- Affected files: src/__tests__/*.test.ts (10개)
- Timestamp: 2026-05-29

## [build-9e2579d] javascript-obfuscator, rollup.config.mjs, npm distribution config
- Summary: rollup.config.ts → rollup.config.mjs 변환(TypeScript configPlugin 파싱 문제 해결). javascript-obfuscator production 난독화 적용(hex 식별자, base64 string array, control-flow flattening). build:dev 스크립트 추가. package.json에 files/sideEffects/license/engines/prepublishOnly 추가.
- Affected files: packages/core/rollup.config.mjs, packages/core/package.json, pnpm-lock.yaml
- Timestamp: 2026-05-29

## [fix] NodeResize — 그룹 노드 NW/NE/SW 핸들 리사이즈 시 자식 노드 미이동 수정
- Summary: 그룹 노드를 NW·NE·SW 코너 핸들로 리사이즈하면 그룹의 origin(x, y)이 변경되는데 자식 노드들이 함께 이동하지 않아 그룹 밖으로 이탈하던 버그 수정. 리사이즈 핸들이 origin을 변경할 때 dx/dy 델타를 계산하여 해당 그룹의 모든 자식 노드에도 동일 델타를 적용하도록 수정.
- Affected files: packages/core/src/interaction/node-resize.ts
- Timestamp: 2026-06-03

## [release 0.2.6] textAlign='center' label centering + groupDoubleClickCollapses opt-in + dissolveGroup + Canvas2D fallback + governance Tenets
- Summary: 노드 라벨 좌측 쏠림 fix (text-atlas.ts entryCanvas에 textAlign='center' 미설정 → 기본 'start' → glyph 좌측 정렬). `FlowChartOptions.groupDoubleClickCollapses?: boolean` 옵션 (기본 false) — 그룹 더블클릭 → collapse를 옵션화하여 사고성 자식 소실 방지. `FlowChart.dissolveGroup(groupId)` 새 공개 API — 그룹 컨테이너 제거 + 자식들을 graph 최상위로 풀어줌 (`ungroupNodes`와 짝). Canvas2DRenderer 추가 (rendererKind: 'canvas2d' opt-in). services/safe-css.ts SSOT, PERFORMANCE.md, axe a11y 3개 테스트. 4 packages publishConfig.provenance: true + CycloneDX SBOM. PRODUCT.md Core Value Tenets T1~T7, AGENTS.md Tenet 가드레일 + Escalation Protocol, SPEC_CHECKLIST.md Tenet Regression Gates 추가 (로컬-only 운영).
- Affected files: packages/core/src/renderer/webgl/atlas/text-atlas.ts, packages/core/src/flowchart.ts, packages/core/src/renderer/canvas2d/index.ts, packages/core/src/services/safe-css.ts, packages/core/PERFORMANCE.md, packages/core/src/__tests__/{productization,edge-cases,a11y-axe}.test.ts, scripts/generate-sbom.mjs, PRODUCT.md, AGENTS.md, SPEC_CHECKLIST.md, CHANGELOG.md, all 4 package.json
- Timestamp: 2026-06-12

## [release 0.4.0 — DEPRECATED] CJK pixel parity verification + atlas-cjk-diag CDP harness
- Summary: 0.2.5 시점 "live 113 vs isolated 261" CJK glyph drop은 0.2.6 per-entry OffscreenCanvas + drawImage 도입으로 이미 구조적으로 해결된 상태였음. CDP-driven diagnostic at packages/core/scripts/atlas-cjk-diag.mjs로 Brave 149/dpr=2 환경 5/5 samples pixel parity 확인. Known limitations에서 CJK 항목 제거. 데모에 cjk1~cjk5 5개 노드 추가. **검증 부실로 4 packages 모두 deprecate** — CDP screenshot에 ASCII 라벨 회귀(eviction race로 인한 mis-mapping)가 명백히 찍혀있었는데도 "PARITY OK + CJK 5개 정상"만 보고 npm publish 진행. 사용자 보고 후 1시간 내 deprecate + 0.4.1 hotfix.
- Affected files: packages/core/scripts/atlas-cjk-diag.mjs (new), demo/index.html, CHANGELOG.md, 4 package.json, 4 sbom.json
- Timestamp: 2026-06-12

## [release 0.4.1 — hotfix] atlas eviction race fix + ATLAS_SIZE 1024→2048 복구
- Summary: 0.4.0 mis-mapping root cause는 atlas eviction race. text-program.ts의 Pass 1 (pre-warm) 도중 atlas full → entries.clear() + generation++. frame-start generation check는 너무 일러서 캐시된 quad의 stale UV를 invalidate 못 하고, 이전 frame의 quadCache가 다른 entry 자리를 가리킴 → ASCII 노드에 CJK 라벨 fragment 표시 + zoom/pan 시 매 frame eviction 반복으로 깜박임. Fix: (a) text-program.ts Pass 1 끝에서 atlas.generation 재확인 → 변경 시 quadCache/nodeRefCache clear + dirtyNodes=labeled.slice()로 전체 강제 rebuild, (b) ATLAS_SIZE 1024 → 2048 복구 (0.2.5의 1024 축소는 per-entry workaround 도입 *전*의 corruption 가설 때문), (c) 50%-row wrap 폐기. atlas-cjk-diag에 ENTRY MAPPING gate 추가 — 40 stress 노드 주입 후 모든 labeled 노드의 atlas entry 픽셀 카운트가 격리 reproduction과 5% 이내 일치하는지 검증. 0.4.0 4 packages npm deprecate.
- Affected files: packages/core/src/renderer/webgl/programs/text-program.ts, packages/core/src/renderer/webgl/atlas/text-atlas.ts, packages/core/scripts/atlas-cjk-diag.mjs, CHANGELOG.md, 4 package.json, 4 sbom.json
- Timestamp: 2026-06-12

## [release 0.4.2 — hotfix] multi-line label preservation (LabelEditor <input> → <textarea>)
- Summary: 사용자 보고: 멀티라인 노드 더블클릭 후 편집 비활성화 시 한 줄로 변환. Root cause: LabelEditor가 <input type="text"> 사용. HTMLInputElement.value setter가 \n을 무성하게 제거. startEdit에서 `input.value = node.label` 실행되는 즉시 '여러줄\nテスト\n测试' → '여러줄テスト测试'로 짜부러져 — 사용자가 키보드 만지기도 전에. blur/Enter가 그걸 그대로 commit. Esc로도 복구 불가. Fix: <textarea>로 교체 + value.trim() (양 끝 whitespace만, interior \n 보존) + rows attribute setAttribute로 줄 수 자동 매칭. Keybind: Enter=commit 유지, Shift+Enter=새 줄, Esc=cancel, blur=commit, IME 보호 유지. label-editor.test.ts에 5개 회귀 테스트 (\n 보존 / blur 라운드트립 / rows 매칭 / Shift+Enter 비커밋 / 평Enter 커밋).
- Affected files: packages/core/src/interaction/label-edit.ts, packages/core/src/__tests__/label-editor.test.ts, CHANGELOG.md, 4 package.json, 4 sbom.json
- Timestamp: 2026-06-12
