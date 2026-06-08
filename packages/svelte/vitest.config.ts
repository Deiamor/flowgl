import { defineConfig } from 'vitest/config'
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [
    svelte({
      preprocess: vitePreprocess(),
      hot: false,
    }),
  ],
  resolve: {
    // Use browser exports so Svelte's onMount (and other lifecycle hooks)
    // load the DOM client runtime instead of the SSR no-op version
    conditions: ['browser'],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/__tests__/**/*.test.ts'],
  },
})
