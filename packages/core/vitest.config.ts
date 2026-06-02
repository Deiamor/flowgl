import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        // GPU/WebGL — no context in test env
        'src/renderer/**',
        // Web Workers — separate runtime
        'src/workers/**',
        // DOM overlays that require real 2D canvas
        'src/ui/html-overlay.ts',
        'src/ui/minimap.ts',
        'src/ui/context-panels.ts',
        // Re-export barrel
        'src/index.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
})
