import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@flowgl/core':  resolve(__dirname, '../packages/core/src/index.ts'),
      '@flowgl/react': resolve(__dirname, '../packages/react/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main:      resolve(__dirname, 'index.html'),
        react:     resolve(__dirname, 'react.html'),
        benchmark: resolve(__dirname, 'benchmark.html'),
        examples:           resolve(__dirname, 'examples/index.html'),
        'examples-minimal':       resolve(__dirname, 'examples/minimal.html'),
        'examples-drag-connect':  resolve(__dirname, 'examples/drag-connect.html'),
        'examples-animated':      resolve(__dirname, 'examples/animated-edges.html'),
        'examples-cjk':           resolve(__dirname, 'examples/cjk-labels.html'),
        'examples-hierarchical':  resolve(__dirname, 'examples/hierarchical-layout.html'),
      },
    },
  },
})
