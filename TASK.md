# TASK.md

tasks:
  # Phase 1 MVP
  - id: A-0
    title: Event emitter (lightweight pub/sub)
    status: done
    dependencies: []

  - id: A-1
    title: Project scaffolding (pnpm workspace, tsconfig, rollup, Vite demo)
    status: done
    dependencies: []

  - id: A-2
    title: Data model (NodeData, EdgeData, Graph)
    status: done
    dependencies: [A-1]

  - id: A-3
    title: Viewport / camera transform + frustum bounds
    status: done
    dependencies: [A-1]

  - id: A-4
    title: WebGL2 context init + Renderer interface + DPR handling
    status: done
    dependencies: [A-1]

  - id: A-5
    title: Node instanced renderer (shaders + VAO + frustum culling)
    status: done
    dependencies: [A-2, A-4]

  - id: A-6
    title: Edge renderer (bezier tessellation + triangle strip + culling)
    status: done
    dependencies: [A-2, A-4]

  - id: A-7
    title: Canvas texture atlas text renderer
    status: done
    dependencies: [A-4]

  - id: A-8
    title: Pan/Zoom + Touch/pinch interaction
    status: done
    dependencies: [A-3]

  - id: A-9
    title: Node drag interaction
    status: done
    dependencies: [A-2, A-3, A-10]

  - id: A-10
    title: CPU AABB hit testing
    status: done
    dependencies: [A-2, A-3]

  - id: A-11
    title: Node selection (click, Cmd+click, box select) + ConnectDrag
    status: done
    dependencies: [A-5, A-6]

  - id: A-12
    title: Bundle build + Vite demo page
    status: done
    dependencies: [A-0, A-2, A-3, A-4, A-5, A-6, A-7, A-8, A-9, A-10, A-11]

  # Production hardening
  - id: B-1
    title: Touch support (drag, connect, pan-zoom)
    status: done
    dependencies: [A-12]

  - id: B-2
    title: Multi-line text + RTL text support
    status: done
    dependencies: [A-7]

  - id: B-3
    title: Keyboard navigation (Tab, Arrow keys, shortcuts)
    status: done
    dependencies: [A-12]

  - id: B-4
    title: Granular events (nodeAdd/nodeRemove/nodeUpdate/edgeAdd/edgeRemove/historyChange)
    status: done
    dependencies: [A-0]

  - id: B-5
    title: aria-live accessibility
    status: done
    dependencies: [A-12]

  - id: B-6
    title: SSR guard (window/document undefined safety)
    status: done
    dependencies: [A-12]

  - id: B-7
    title: TextAtlas 2-pass render (flicker fix)
    status: done
    dependencies: [A-7]

  - id: B-8
    title: Edge labels (bezier midpoint rendering)
    status: done
    dependencies: [A-6, A-7]

  - id: B-9
    title: Arrow key move debounce (400ms, undo pollution fix)
    status: done
    dependencies: [B-3]

  - id: B-10
    title: Test suite (127 tests, 10 files)
    status: done
    dependencies: [A-12]

  - id: B-11
    title: API reference README
    status: done
    dependencies: [A-12]

  - id: B-12
    title: Production obfuscation build (javascript-obfuscator)
    status: done
    dependencies: [A-12]

  - id: B-13
    title: npm distribution config (files, sideEffects, prepublishOnly)
    status: done
    dependencies: [A-12]

  # Phase 3 — Release & Deploy
  - id: C-1
    title: npm 0.1.1 배포 — 버그픽스 + API 확장 (4개 패키지)
    status: done
    dependencies: [B-13]

  - id: C-2
    title: 데모 사이트 배포 — Cloudflare Workers (dev.flowgl.ouranos.kr)
    status: done
    dependencies: [C-1]

  - id: C-3
    title: README GitHub/Demo 링크 추가, 테스트 배지 최신화
    status: done
    dependencies: [C-1, C-2]

  - id: C-4
    title: 0.1.4 — inline label edit 텍스트 미반영 버그 수정 (BLEND restore + IME guard + public updateNode 라우팅)
    status: done
    dependencies: [C-1]

  - id: D-1
    title: 0.1.5 Phase 1 — Security/Distribution 하드닝 (XSS sink + CSS injection + SVG attribute injection + dist test artifact 제거)
    status: done
    dependencies: [C-4]

  - id: D-2
    title: 0.2.0 Phase 2 — API/Architecture 정리 (Renderer interface 정직화, graph private화, setNode* 통합)
    status: done
    dependencies: [D-1]

  - id: D-3
    title: 0.2.2 Phase 3 (부분) — God Class 분해 (SVG export 추출) + fromJSON 스키마 검증
    status: done
    dependencies: [D-2]

  - id: D-4
    title: Phase 4 — Docs & A11y (cookbook + migration guide + WCAG + ARIA 강화)
    status: done
    dependencies: [D-2]

  - id: D-5
    title: Phase 5 — Playwright E2E + 채택성 신호 강화
    status: pending
    dependencies: [D-3]

  # Phase 4 — Bug fixes & UX (0.2.6)
  - id: E-1
    title: 0.2.6 — WebGL2 텍스트 좌측 쏠림 fix (text-atlas textAlign='center')
    status: done
    dependencies: []

  - id: E-2
    title: 0.2.6 — Group 더블클릭 collapse 옵션화 (groupDoubleClickCollapses, 기본 OFF)
    status: done
    dependencies: []

  - id: E-3
    title: 0.2.6 — 거버넌스 문서에 Core Value Tenets + 가드레일 + 회귀 차단 체크 정비
    status: done
    dependencies: []

  # CJK 작업 — 0.4.0~0.4.2 시리즈
  - id: F-1
    title: |
      0.4.0 — WebGL2 atlas CJK glyph drop root-cause verification.
      Result: 0.2.6's per-entry OffscreenCanvas + drawImage strategy already
      eliminated the pixel drop at the source. CDP-driven diagnostic at
      packages/core/scripts/atlas-cjk-diag.mjs confirms pixel parity with
      isolated reproduction (5/5 samples) on Brave 149 / dpr=2. Workaround
      not removed — it IS the structural fix. Known-limitation entry
      removed from CHANGELOG.
    status: done
    dependencies: [E-1]

  - id: F-2
    title: |
      0.4.1 (hotfix) — atlas eviction race that 0.4.0 surfaced.
      0.4.0 mis-mapped labels (ASCII nodes rendered CJK label fragments)
      because Pass 1 pre-warm in text-program.ts could trigger eviction
      mid-loop; the frame-start generation check was too early to invalidate
      cached quads. Fix: (a) Pass 1 끝에서 atlas.generation 재확인 →
      변경 시 quadCache/nodeRefCache clear + 전체 노드를 dirty로 강제,
      (b) ATLAS_SIZE 1024 → 2048 복구 (per-entry workaround로 인해 2048
      corruption 가설이 무효화됨), (c) 50%-row wrap 폐기. 0.4.0은 4 packages
      모두 npm deprecate. atlas-cjk-diag에 ENTRY MAPPING gate 추가 — 40개
      stress 노드로 atlas overflow 강제 + 모든 라벨이 자기 entry와 일치하는지
      검증. 통과 후 4 packages npm publish.
    status: done
    dependencies: [F-1]

  - id: F-3
    title: |
      0.4.2 (hotfix) — multi-line label flatten via single-line <input>.
      LabelEditor가 <input type="text">를 썼는데, HTMLInputElement.value
      setter는 \n을 무성하게 제거. 더블클릭 → input.value = node.label 시점에
      이미 멀티라인 라벨이 단일 라인으로 짜부러지고, blur가 그걸 commit. Fix:
      <textarea>로 교체 + value.trim() (양 끝만 trim, interior \n 보존) +
      rows attribute로 줄 수 자동 매칭. Keybind: Enter=commit (single-line UX
      유지), Shift+Enter=새 줄, Esc=cancel, blur=commit, IME 보호 유지. 5개
      회귀 테스트 추가 (\n 보존 / blur 라운드트립 / rows / Shift+Enter /
      평Enter). 4 packages npm publish.
    status: done
    dependencies: [F-2]
