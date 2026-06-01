import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@flowchart/core':  resolve(__dirname, '../packages/core/src/index.ts'),
      '@flowchart/react': resolve(__dirname, '../packages/react/src/index.ts'),
    },
  },
})
