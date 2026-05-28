# HISTORY.md

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
