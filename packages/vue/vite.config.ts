import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry:    resolve(__dirname, 'src/index.ts'),
      name:     'FlowchartVue',
      formats:  ['es', 'cjs'],
      fileName: (fmt) => fmt === 'es' ? 'flowchart-vue.esm.js' : 'index.cjs.js',
    },
    rollupOptions: {
      external: ['vue', '@flowgl/core'],
      output: {
        globals: { vue: 'Vue' },
      },
    },
  },
})
