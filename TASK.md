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
    title: 0.2.0 Phase 3 — God Class 분해 (Export/GraphAnalysis/Alignment/LayoutAnimator 추출)
    status: pending
    dependencies: [D-2]

  - id: D-4
    title: Phase 4 — Docs & A11y (cookbook + migration guide + WCAG + ARIA 강화)
    status: done
    dependencies: [D-2]

  - id: D-5
    title: Phase 5 — Playwright E2E + 채택성 신호 강화
    status: pending
    dependencies: [D-3]
