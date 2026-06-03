import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

export default defineConfig({
  plugins: [svelte({ compilerOptions: { runes: false } })],
  build: {
    lib: {
      entry:    resolve(__dirname, 'src/index.ts'),
      name:     'FlowchartSvelte',
      formats:  ['es', 'cjs'],
      fileName: (fmt) => fmt === 'es' ? 'flowchart-svelte.esm.js' : 'index.cjs.js',
    },
    rollupOptions: {
      external: ['svelte', '@flowgl/core'],
    },
  },
})
