# TASK.md

tasks:
  - id: A-0
    title: Event emitter (lightweight pub/sub)
    status: pending
    dependencies: []

  - id: A-1
    title: Project scaffolding (pnpm workspace, tsconfig, rollup, Vite demo)
    status: in_progress
    dependencies: []

  - id: A-2
    title: Data model (NodeData, EdgeData, Graph)
    status: pending
    dependencies: [A-1]

  - id: A-3
    title: Viewport / camera transform + frustum bounds
    status: pending
    dependencies: [A-1]

  - id: A-4
    title: WebGL2 context init + Renderer interface + DPR handling
    status: pending
    dependencies: [A-1]

  - id: A-5
    title: Node instanced renderer (shaders + VAO + frustum culling)
    status: pending
    dependencies: [A-2, A-4]

  - id: A-6
    title: Edge renderer (bezier tessellation + triangle strip + culling)
    status: pending
    dependencies: [A-2, A-4]

  - id: A-7
    title: Canvas texture atlas text renderer
    status: pending
    dependencies: [A-4]

  - id: A-8
    title: Pan/Zoom + Touch/pinch interaction
    status: pending
    dependencies: [A-3]

  - id: A-9
    title: Node drag interaction
    status: pending
    dependencies: [A-2, A-3, A-10]

  - id: A-10
    title: CPU AABB hit testing
    status: pending
    dependencies: [A-2, A-3]

  - id: A-11
    title: Custom node/edge type registration API
    status: pending
    dependencies: [A-5, A-6]

  - id: A-12
    title: Bundle build + Vite demo page
    status: pending
    dependencies: [A-0, A-2, A-3, A-4, A-5, A-6, A-7, A-8, A-9, A-10, A-11]
