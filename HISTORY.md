# HISTORY.md

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
